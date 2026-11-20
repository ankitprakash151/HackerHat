import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { redactSecrets, sanitizeCliArgs } from '../utils/sanitizer.js';

const execFileAsync = promisify(execFile);

export class SastRunner {
  /**
   * Main entry point to run SAST Stage (Gitleaks + Semgrep)
   */
  static async runScan(targetDir, scanId, targetId) {
    logger.info(`Starting Stage 1 SAST for targetDir: ${targetDir}`);
    const findings = [];

    // 1. Run Gitleaks
    try {
      const gitleaksFindings = await this.runGitleaks(targetDir, scanId, targetId);
      findings.push(...gitleaksFindings);
    } catch (err) {
      logger.warn(`Gitleaks execution warning: ${err.message}. Running fallback secret engine.`);
      const fallbackSecretFindings = await this.fallbackSecretScanner(targetDir, scanId, targetId);
      findings.push(...fallbackSecretFindings);
    }

    // 2. Run Semgrep
    try {
      const semgrepFindings = await this.runSemgrep(targetDir, scanId, targetId);
      findings.push(...semgrepFindings);
    } catch (err) {
      logger.warn(`Semgrep execution warning: ${err.message}. Running fallback code pattern engine.`);
      const fallbackSemgrepFindings = await this.fallbackSemgrepScanner(targetDir, scanId, targetId);
      findings.push(...fallbackSemgrepFindings);
    }

    logger.info(`SAST Stage completed. Found ${findings.length} findings.`);
    return findings;
  }

  /**
   * Executes Gitleaks using safe child_process.execFile
   */
  static async runGitleaks(targetDir, scanId, targetId) {
    const reportPath = path.join(env.TEMP_UPLOAD_DIR, `gitleaks_${scanId}.json`);
    const configFile = path.join(env.RULES_DIR, 'gitleaks-custom.toml');

    const args = sanitizeCliArgs([
      'detect',
      '--source', targetDir,
      '--no-git',
      '--report-format', 'json',
      '--report-path', reportPath
    ]);

    if (fs.existsSync(configFile)) {
      args.push('--config', configFile);
    }

    try {
      // Gitleaks returns exit code 1 when leaks are found, which is normal for a scanner
      await execFileAsync(env.GITLEAKS_PATH, args, {
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024
      });
    } catch (execErr) {
      // If code is 1, it found leaks, which is expected
      if (execErr.code !== 1 && !fs.existsSync(reportPath)) {
        throw execErr;
      }
    }

    if (!fs.existsSync(reportPath)) {
      return [];
    }

    const rawContent = fs.readFileSync(reportPath, 'utf8');
    try {
      fs.unlinkSync(reportPath);
    } catch {}

    if (!rawContent.trim()) return [];

    const rawLeaks = JSON.parse(rawContent);
    return rawLeaks.map((leak) => this.normalizeGitleaksFinding(leak, scanId, targetId, targetDir));
  }

  /**
   * Normalizes Gitleaks JSON finding
   */
  static normalizeGitleaksFinding(leak, scanId, targetId, baseDir) {
    const relativeFile = path.relative(baseDir, leak.File || leak.file || 'unknown');
    const secretVal = leak.Secret || leak.Match || '';
    const redactedSnippet = redactSecrets(leak.Line || leak.Match || '');

    return {
      scanId,
      targetId,
      tool: 'gitleaks',
      ruleId: leak.RuleID || 'gitleaks-secret',
      title: `Hardcoded Secret Detected: ${leak.Description || leak.RuleID || 'Secret Key'}`,
      severity: 'CRITICAL',
      category: 'SECRETS',
      cwe: 'CWE-798: Use of Hard-coded Credentials',
      owasp: 'A07:2021 - Identification and Authentication Failures',
      plainEnglish: {
        whatItIs: `A hardcoded credential or API token was discovered in your source code (${relativeFile}).`,
        whyItMatters: 'If this code is committed to GitHub or exposed, anyone can use your API key to access paid services, steal user data, or compromise your cloud infrastructure.',
        howToFix: 'Remove the secret immediately from code, revoke the exposed key in the provider dashboard, and load it securely through environment variables (.env).'
      },
      aiPrompt: {
        role: 'Senior Application Security Engineer',
        targetFile: relativeFile,
        lineNumber: leak.StartLine || 1,
        vulnerableCode: redactedSnippet,
        instructions: `Remove the hardcoded secret and replace it with a secure call to process.env. Ensure dotenv is loaded and add .env to .gitignore.`
      },
      location: {
        file: relativeFile,
        startLine: leak.StartLine || 1,
        endLine: leak.EndLine || 1,
        column: leak.StartColumn || 1,
        evidence: redactedSnippet
      },
      rawOutput: leak
    };
  }

  /**
   * Executes Semgrep using safe child_process.execFile
   */
  static async runSemgrep(targetDir, scanId, targetId) {
    const customRulesPath = path.join(env.RULES_DIR, 'semgrep-vibe-rules.yaml');
    const args = sanitizeCliArgs([
      'scan',
      '--config', customRulesPath,
      '--json',
      '--quiet',
      '--timeout', '30',
      targetDir
    ]);

    const { stdout } = await execFileAsync(env.SEMGREP_PATH, args, {
      timeout: 45000,
      maxBuffer: 20 * 1024 * 1024
    });

    const parsed = JSON.parse(stdout);
    const results = parsed.results || [];
    return results.map((item) => this.normalizeSemgrepFinding(item, scanId, targetId, targetDir));
  }

  /**
   * Normalizes Semgrep finding into standard VibeShield Finding structure
   */
  static normalizeSemgrepFinding(item, scanId, targetId, baseDir) {
    const ruleId = item.check_id || 'semgrep-rule';
    const filePath = path.relative(baseDir, item.path || 'unknown');
    const startLine = item.start?.line || 1;
    const endLine = item.end?.line || startLine;
    const codeSnippet = item.extra?.lines ? redactSecrets(item.extra.lines.trim()) : '';
    const message = item.extra?.message || '';

    let severity = 'MEDIUM';
    const metaSev = (item.extra?.severity || '').toUpperCase();
    if (metaSev === 'ERROR') severity = 'HIGH';
    if (metaSev === 'CRITICAL') severity = 'CRITICAL';
    if (metaSev === 'WARNING') severity = 'MEDIUM';
    if (metaSev === 'INFO') severity = 'LOW';

    let category = 'MISCONFIG';
    if (ruleId.includes('password') || ruleId.includes('hash')) category = 'CRYPTO';
    if (ruleId.includes('auth') || ruleId.includes('middleware')) category = 'AUTH_BYPASS';
    if (ruleId.includes('jwt')) category = 'CRYPTO';
    if (ruleId.includes('env') || ruleId.includes('debug')) category = 'EXPOSED_FILES';

    return {
      scanId,
      targetId,
      tool: 'semgrep',
      ruleId,
      title: item.extra?.metadata?.shortDescription || `Vulnerability: ${ruleId}`,
      severity,
      category,
      cwe: item.extra?.metadata?.cwe || 'CWE-699',
      owasp: item.extra?.metadata?.owasp || 'A05:2021 - Security Misconfiguration',
      plainEnglish: {
        whatItIs: message,
        whyItMatters: 'Improper configuration or missing controls allow attackers to bypass security layers and perform unauthorized actions.',
        howToFix: 'Follow the remediation prompt to apply secure modern patterns.'
      },
      aiPrompt: {
        role: 'Senior Full-Stack & Application Security Engineer',
        targetFile: filePath,
        lineNumber: startLine,
        vulnerableCode: codeSnippet,
        instructions: `Refactor the code at ${filePath}:${startLine} to eliminate this vulnerability. Follow secure coding standards.`
      },
      location: {
        file: filePath,
        startLine,
        endLine,
        evidence: codeSnippet
      },
      rawOutput: item
    };
  }

  /**
   * Fallback Secret Engine (Recursive scanner adhering to the same Gitleaks rules)
   */
  static async fallbackSecretScanner(targetDir, scanId, targetId) {
    const findings = [];
    if (!fs.existsSync(targetDir)) return findings;

    const files = this.getFilesRecursively(targetDir);

    const secretRules = [
      {
        id: 'openai-api-key',
        title: 'Hardcoded OpenAI API Key Detected',
        regex: /(sk-[a-zA-Z0-9]{20,T3BlbkFJ[a-zA-Z0-9]{20,}|sk-proj-[a-zA-Z0-9\-_]{30,})/g,
        severity: 'CRITICAL',
        category: 'SECRETS',
        cwe: 'CWE-798: Use of Hard-coded Credentials',
        whatItIs: 'An active OpenAI API secret key was found in source code.',
        whyItMatters: 'Anyone with access to this repo can exhaust your API credits and access organization data.',
        howToFix: 'Move the API key to an environment variable (process.env.OPENAI_API_KEY) and revoke the old key.'
      },
      {
        id: 'stripe-secret-key',
        title: 'Hardcoded Stripe Secret Key Detected',
        regex: /(sk_live_[0-9a-zA-Z]{24,})/g,
        severity: 'CRITICAL',
        category: 'SECRETS',
        cwe: 'CWE-798: Use of Hard-coded Credentials',
        whatItIs: 'A live Stripe Secret Key was discovered in code.',
        whyItMatters: 'Live Stripe keys provide full administrative access to initiate refunds, charges, and customer data.',
        howToFix: 'Store the key in an environment variable and rotate it immediately in the Stripe dashboard.'
      },
      {
        id: 'mongodb-connection-uri',
        title: 'MongoDB Connection String with Embedded Password',
        regex: /mongodb(\+srv)?:\/\/[a-zA-Z0-9_\-\.%]+:[^@\s"']+@[a-zA-Z0-9_\-\.]+/gi,
        severity: 'CRITICAL',
        category: 'SECRETS',
        cwe: 'CWE-798: Hard-coded Database Credentials',
        whatItIs: 'A MongoDB connection string contains plaintext database username and password.',
        whyItMatters: 'Direct access to your production MongoDB database allows full data deletion, ransomware, and exfiltration.',
        howToFix: 'Store the connection string in .env and access via process.env.MONGODB_URI.'
      },
      {
        id: 'committed-env-file',
        title: 'Committed .env File Detected in Repository',
        regex: null, // Checked by filename
        severity: 'HIGH',
        category: 'EXPOSED_FILES',
        cwe: 'CWE-540: Inclusion of Sensitive Information in Source Code',
        whatItIs: 'A .env file containing environment configurations was committed into the repository.',
        whyItMatters: '.env files usually contain production secrets, database passwords, and third-party service tokens.',
        howToFix: 'Add .env to your .gitignore, remove it from git history, and use a .env.example template instead.'
      }
    ];

    for (const filePath of files) {
      const relPath = path.relative(targetDir, filePath);
      const filename = path.basename(filePath);

      // Check committed .env
      if (filename === '.env' || filename.startsWith('.env.')) {
        findings.push({
          scanId,
          targetId,
          tool: 'gitleaks',
          ruleId: 'committed-env-file',
          title: 'Committed .env File in Repository',
          severity: 'HIGH',
          category: 'EXPOSED_FILES',
          cwe: 'CWE-540',
          owasp: 'A05:2021 - Security Misconfiguration',
          plainEnglish: {
            whatItIs: `The file "${relPath}" appears to be committed to the repository.`,
            whyItMatters: 'Environment files contain production passwords, secret keys, and credentials that should never be in source control.',
            howToFix: 'Add .env to .gitignore and execute "git rm --cached .env" to untrack it.'
          },
          aiPrompt: {
            role: 'DevOps & AppSec Specialist',
            targetFile: '.gitignore',
            lineNumber: 1,
            vulnerableCode: `${relPath} committed`,
            instructions: 'Add .env to .gitignore, create .env.example with dummy variables, and clean git cache.'
          },
          location: { file: relPath, startLine: 1, evidence: `File exists at ${relPath}` }
        });
      }

      // Check file content for regex patterns
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          for (const rule of secretRules) {
            if (!rule.regex) continue;
            rule.regex.lastIndex = 0;
            if (rule.regex.test(line)) {
              findings.push({
                scanId,
                targetId,
                tool: 'gitleaks',
                ruleId: rule.id,
                title: rule.title,
                severity: rule.severity,
                category: rule.category,
                cwe: rule.cwe,
                owasp: 'A07:2021 - Identification and Authentication Failures',
                plainEnglish: {
                  whatItIs: rule.whatItIs,
                  whyItMatters: rule.whyItMatters,
                  howToFix: rule.howToFix
                },
                aiPrompt: {
                  role: 'Senior Application Security Engineer',
                  targetFile: relPath,
                  lineNumber: i + 1,
                  vulnerableCode: redactSecrets(line.trim()),
                  instructions: `Remove the hardcoded secret from ${relPath}:${i + 1} and load it via process.env.`
                },
                location: {
                  file: relPath,
                  startLine: i + 1,
                  evidence: redactSecrets(line.trim())
                }
              });
            }
          }
        }
      } catch {}
    }

    return findings;
  }

  /**
   * Fallback Semgrep Engine (Implements the 4 vibe-code rules natively)
   */
  static async fallbackSemgrepScanner(targetDir, scanId, targetId) {
    const findings = [];
    if (!fs.existsSync(targetDir)) return findings;

    const files = this.getFilesRecursively(targetDir).filter((f) => {
      const ext = path.extname(f).toLowerCase();
      return ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(ext);
    });

    for (const filePath of files) {
      const relPath = path.relative(targetDir, filePath);
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lineNum = i + 1;

          // 1. Weak password hashing (MD5, SHA1)
          if (line.includes("createHash('md5')") || line.includes('createHash("md5")') || line.includes('CryptoJS.MD5(')) {
            findings.push({
              scanId,
              targetId,
              tool: 'semgrep',
              ruleId: 'vibe-weak-password-hashing-md5',
              title: 'Weak MD5 Password Hashing',
              severity: 'HIGH',
              category: 'CRYPTO',
              cwe: 'CWE-328: Use of Weak Hash',
              owasp: 'A02:2021 - Cryptographic Failures',
              plainEnglish: {
                whatItIs: 'Your application is using MD5 to hash passwords or sensitive tokens.',
                whyItMatters: 'MD5 is broken. Attackers can precalculate tables (rainbow tables) to crack any standard MD5 password in seconds.',
                howToFix: 'Replace MD5 with bcrypt (salt rounds >= 12) or argon2id for hashing and validating passwords.'
              },
              aiPrompt: {
                role: 'Senior Full-Stack & Application Security Engineer',
                targetFile: relPath,
                lineNumber: lineNum,
                vulnerableCode: line.trim(),
                instructions: 'Replace MD5 hashing with bcrypt.hash(password, 12) and bcrypt.compare(password, hash).'
              },
              location: { file: relPath, startLine: lineNum, evidence: line.trim() }
            });
          }

          if (line.includes("createHash('sha1')") || line.includes('createHash("sha1")') || line.includes('CryptoJS.SHA1(')) {
            findings.push({
              scanId,
              targetId,
              tool: 'semgrep',
              ruleId: 'vibe-weak-password-hashing-sha1',
              title: 'Weak SHA1 Hashing',
              severity: 'MEDIUM',
              category: 'CRYPTO',
              cwe: 'CWE-328: Use of Weak Hash',
              owasp: 'A02:2021 - Cryptographic Failures',
              plainEnglish: {
                whatItIs: 'SHA-1 is used for hashing.',
                whyItMatters: 'SHA-1 is vulnerable to collision attacks and is no longer certified for credential verification.',
                howToFix: 'Upgrade to bcrypt or argon2 for passwords, or SHA-256 / SHA-512 for generic digests.'
              },
              aiPrompt: {
                role: 'Senior Application Security Engineer',
                targetFile: relPath,
                lineNumber: lineNum,
                vulnerableCode: line.trim(),
                instructions: 'Upgrade SHA-1 hash to SHA-256 (for checksums) or bcrypt (for passwords).'
              },
              location: { file: relPath, startLine: lineNum, evidence: line.trim() }
            });
          }

          // Plaintext password comparison
          if (line.includes('.password === req.body.password') || line.includes('.password == req.body.password') || line.includes('req.body.password === user.password')) {
            findings.push({
              scanId,
              targetId,
              tool: 'semgrep',
              ruleId: 'vibe-plaintext-password-compare',
              title: 'Plaintext Password Comparison',
              severity: 'CRITICAL',
              category: 'CRYPTO',
              cwe: 'CWE-256: Plaintext Storage of a Password',
              owasp: 'A07:2021 - Identification and Authentication Failures',
              plainEnglish: {
                whatItIs: 'User passwords are treated as plaintext strings and compared with ===.',
                whyItMatters: 'If your database is viewed or leaked, all user passwords are immediately visible without any hashing.',
                howToFix: 'Store passwords hashed using bcrypt and verify with await bcrypt.compare(req.body.password, user.passwordHash).'
              },
              aiPrompt: {
                role: 'Senior Security Engineer',
                targetFile: relPath,
                lineNumber: lineNum,
                vulnerableCode: line.trim(),
                instructions: 'Replace plaintext password equality check with bcrypt.compare(req.body.password, user.passwordHash).'
              },
              location: { file: relPath, startLine: lineNum, evidence: line.trim() }
            });
          }

          // 2. Missing Authentication Middleware on Sensitive Routes
          if (
            (line.includes("app.delete('/api/users/") || line.includes("app.get('/api/admin") || line.includes("app.post('/api/admin") || line.includes("router.delete('/users/")) &&
            !line.includes('auth') && !line.includes('verifyToken') && !line.includes('requireAuth')
          ) {
            findings.push({
              scanId,
              targetId,
              tool: 'semgrep',
              ruleId: 'vibe-missing-auth-middleware-admin',
              title: 'Missing Authentication on Sensitive Route',
              severity: 'HIGH',
              category: 'AUTH_BYPASS',
              cwe: 'CWE-306: Missing Authentication for Critical Function',
              owasp: 'A01:2021 - Broken Access Control',
              plainEnglish: {
                whatItIs: `An administrative or user deletion route is configured without authentication middleware.`,
                whyItMatters: 'Any unauthenticated user on the internet can call this endpoint to view administrative data or delete records.',
                howToFix: 'Add authentication & role authorization middleware: app.delete("/api/users/:id", authenticateToken, requireAdmin, ...).'
              },
              aiPrompt: {
                role: 'Express & Node.js Security Architect',
                targetFile: relPath,
                lineNumber: lineNum,
                vulnerableCode: line.trim(),
                instructions: 'Add authenticate and requireRole("admin") middleware before the route controller.'
              },
              location: { file: relPath, startLine: lineNum, evidence: line.trim() }
            });
          }

          // 3. Weak JWT Configuration (none algorithm, hardcoded secret)
          if (line.includes("algorithm: 'none'") || line.includes('algorithm: "none"')) {
            findings.push({
              scanId,
              targetId,
              tool: 'semgrep',
              ruleId: 'vibe-weak-jwt-none-algorithm',
              title: 'Insecure JWT "none" Algorithm Configured',
              severity: 'CRITICAL',
              category: 'CRYPTO',
              cwe: 'CWE-327: Use of a Broken or Risky Cryptographic Algorithm',
              owasp: 'A02:2021 - Cryptographic Failures',
              plainEnglish: {
                whatItIs: 'The JWT configuration explicitly permits or sets algorithm to "none".',
                whyItMatters: 'Attackers can forge valid administrative JWT tokens without possessing any secret key by setting the algorithm header to none.',
                howToFix: 'Enforce HS256 or RS256 algorithm and explicitly disallow the none algorithm.'
              },
              aiPrompt: {
                role: 'Senior AppSec Engineer',
                targetFile: relPath,
                lineNumber: lineNum,
                vulnerableCode: line.trim(),
                instructions: 'Remove algorithm: "none" and enforce algorithms: ["HS256"] in jwt.verify.'
              },
              location: { file: relPath, startLine: lineNum, evidence: line.trim() }
            });
          }

          if (
            (line.includes("'secret'") || line.includes('"secret"') || line.includes("'mysecret'") || line.includes('"123456"')) &&
            (line.includes("jwt") || content.includes("jwt.sign") || content.includes("jwt.verify"))
          ) {
            findings.push({
              scanId,
              targetId,
              tool: 'semgrep',
              ruleId: 'vibe-hardcoded-jwt-secret',
              title: 'Hardcoded JWT Secret in Code',
              severity: 'HIGH',
              category: 'SECRETS',
              cwe: 'CWE-798: Use of Hard-coded Credentials',
              owasp: 'A02:2021 - Cryptographic Failures',
              plainEnglish: {
                whatItIs: 'A trivial, hardcoded secret string is passed directly into jwt.sign or jwt.verify.',
                whyItMatters: 'Any attacker who reads this repository or guesses the default secret can forge tokens for any user or admin.',
                howToFix: 'Replace the string with process.env.JWT_SECRET and generate a 256-bit random string.'
              },
              aiPrompt: {
                role: 'Security Engineer',
                targetFile: relPath,
                lineNumber: lineNum,
                vulnerableCode: line.trim(),
                instructions: 'Replace hardcoded JWT secret with process.env.JWT_SECRET.'
              },
              location: { file: relPath, startLine: lineNum, evidence: line.trim() }
            });
          }

          // 4. Exposed Sensitive Files & Debug / Backdoor Routes
          if (line.includes('res.json(process.env)') || line.includes('res.send(process.env)')) {
            findings.push({
              scanId,
              targetId,
              tool: 'semgrep',
              ruleId: 'vibe-exposed-env-dump-route',
              title: 'Environment Variables Exposed in API Response',
              severity: 'CRITICAL',
              category: 'EXPOSED_FILES',
              cwe: 'CWE-200: Exposure of Sensitive Information',
              owasp: 'A05:2021 - Security Misconfiguration',
              plainEnglish: {
                whatItIs: 'Endpoint returns process.env directly in the HTTP response.',
                whyItMatters: 'This instantly reveals all environment variables, cloud credentials, database connection strings, and secret keys to the browser.',
                howToFix: 'Remove the endpoint immediately or return only safe public configuration keys.'
              },
              aiPrompt: {
                role: 'Application Security Engineer',
                targetFile: relPath,
                lineNumber: lineNum,
                vulnerableCode: line.trim(),
                instructions: 'Delete the route or whitelist only harmless public configuration properties.'
              },
              location: { file: relPath, startLine: lineNum, evidence: line.trim() }
            });
          }

          if (line.includes("app.get('/debug") || line.includes("app.all('/test-backdoor") || line.includes("app.post('/admin/reset-database")) {
            findings.push({
              scanId,
              targetId,
              tool: 'semgrep',
              ruleId: 'vibe-debug-backdoor-route',
              title: 'Active Debug / Backdoor Endpoint in Code',
              severity: 'MEDIUM',
              category: 'EXPOSED_FILES',
              cwe: 'CWE-489: Active Debug Code in Production',
              owasp: 'A05:2021 - Security Misconfiguration',
              plainEnglish: {
                whatItIs: 'A debug or backdoor route was identified in the codebase.',
                whyItMatters: 'Debug endpoints frequently bypass authentication or expose internal state and diagnostic tools to outsiders.',
                howToFix: 'Gate debug endpoints behind process.env.NODE_ENV !== "production" and require administrative authentication.'
              },
              aiPrompt: {
                role: 'Full-Stack Security Architect',
                targetFile: relPath,
                lineNumber: lineNum,
                vulnerableCode: line.trim(),
                instructions: 'Guard the debug route with NODE_ENV checks and admin authorization.'
              },
              location: { file: relPath, startLine: lineNum, evidence: line.trim() }
            });
          }
        }
      } catch {}
    }

    return findings;
  }

  /**
   * Helper to retrieve all non-ignored files recursively
   */
  static getFilesRecursively(dir, fileList = []) {
    const ignoredDirs = ['node_modules', '.git', '.next', 'dist', 'build', 'temp_uploads'];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (ignoredDirs.includes(entry.name)) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          this.getFilesRecursively(fullPath, fileList);
        } else {
          fileList.push(fullPath);
        }
      }
    } catch {}
    return fileList;
  }
}
