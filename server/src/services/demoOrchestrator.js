import { Scan } from '../models/Scan.js';
import { Target } from '../models/Target.js';
import { Finding } from '../models/Finding.js';
import { Report } from '../models/Report.js';
import { ScoringEngine } from './scoringEngine.js';
import { PromptGenerator } from './promptGenerator.js';
import { PdfService } from './pdfService.js';
import { logger } from '../utils/logger.js';

export class DemoOrchestrator {
  /**
   * Starts a realistic 6-to-8 second animated demo scan pipeline
   * Step 1: Verifying target ownership... (Passed)
   * Step 2: Running Gitleaks secret detection...
   * Step 3: Running Semgrep static code analysis...
   * Step 4: Spinning up isolated Docker sandbox & OWASP ZAP probe...
   * Step 5: Calculating VibeShield Security Score...
   */
  static async startDemoScan(scanId, targetId, isReScan = false) {
    logger.info(`[DemoOrchestrator] Starting 7.5s Demo Pipeline for scan: ${scanId} (isReScan: ${isReScan})`);

    // Ensure target is marked verified in Demo Mode
    await Target.updateById(targetId, {
      verified: true,
      verificationMethod: 'github_oauth',
      verifiedAt: new Date()
    });

    const target = await Target.findById(targetId);
    const targetName = target?.name || target?.url || 'Demo Application';

    // Initial state: Stage 1 - Verifying target ownership
    await Scan.updateById(scanId, {
      status: 'STAGE_1_SAST',
      currentStage: 'init',
      progress: 15,
      startedAt: new Date(),
      stageProgress: {
        sast: {
          status: 'running',
          progress: 20,
          tool: 'Ownership Gate + Gitleaks',
          findingsCount: 0,
          message: 'Verifying target ownership... (Passed)'
        },
        dast: {
          status: 'pending',
          progress: 0,
          tool: 'OWASP ZAP Sandbox',
          findingsCount: 0,
          message: 'Waiting for static analysis & secret engine'
        }
      }
    });

    await Scan.addLogMessage(
      scanId,
      'verify',
      `[DEMO MODE] Verifying ownership for "${targetName}"... Automatic bypass active. Ownership Verified (Passed).`,
      'info'
    );

    // Timeline steps (Total: ~7.4s)
    // Step 2: Gitleaks (at 1.3s)
    setTimeout(async () => {
      try {
        await Scan.updateById(scanId, {
          progress: 35,
          currentStage: 'sast',
          stageProgress: {
            sast: {
              status: 'running',
              progress: 45,
              tool: 'Gitleaks Engine',
              findingsCount: isReScan ? 0 : 2,
              message: 'Running Gitleaks secret detection...'
            }
          }
        });
        await Scan.addLogMessage(
          scanId,
          'gitleaks',
          'Running Gitleaks secret detection: scanning repository commits, env files & API tokens...',
          'info'
        );
        if (!isReScan) {
          await Scan.addLogMessage(
            scanId,
            'gitleaks',
            'Gitleaks alert: Found hardcoded Stripe Secret Key and OpenAI API Token in project source.',
            'warn'
          );
        } else {
          await Scan.addLogMessage(
            scanId,
            'gitleaks',
            'Gitleaks clean: All previously flagged secrets have been safely moved to environment variables.',
            'info'
          );
        }
      } catch (err) {
        logger.error(`Demo step 2 error: ${err.message}`);
      }
    }, 1300);

    // Step 3: Semgrep (at 2.8s)
    setTimeout(async () => {
      try {
        await Scan.updateById(scanId, {
          progress: 55,
          currentStage: 'sast',
          stageProgress: {
            sast: {
              status: 'running',
              progress: 75,
              tool: 'Semgrep SAST',
              findingsCount: isReScan ? 0 : 3,
              message: 'Running Semgrep static code analysis...'
            }
          }
        });
        await Scan.addLogMessage(
          scanId,
          'semgrep',
          'Running Semgrep static code analysis: evaluating AST against OWASP vibe-rules ruleset...',
          'info'
        );
        if (!isReScan) {
          await Scan.addLogMessage(
            scanId,
            'semgrep',
            'Semgrep alert: Detected legacy MD5 password hashing in auth.js (CWE-328).',
            'warn'
          );
        } else {
          await Scan.addLogMessage(
            scanId,
            'semgrep',
            'Semgrep clean: Passwords correctly hashed using modern bcrypt (salt factor >= 12).',
            'info'
          );
        }
      } catch (err) {
        logger.error(`Demo step 3 error: ${err.message}`);
      }
    }, 2800);

    // Step 4: Docker ZAP Sandbox (at 4.4s)
    setTimeout(async () => {
      try {
        await Scan.updateById(scanId, {
          status: 'STAGE_2_DAST',
          currentStage: 'dast',
          progress: 75,
          stageProgress: {
            sast: {
              status: 'completed',
              progress: 100,
              tool: 'Gitleaks + Semgrep',
              findingsCount: isReScan ? 0 : 3,
              message: 'Static analysis and secrets detection completed'
            },
            dast: {
              status: 'running',
              progress: 60,
              tool: 'OWASP ZAP Docker (512MB Sandbox)',
              findingsCount: isReScan ? 1 : 2,
              message: 'Spinning up isolated Docker sandbox & OWASP ZAP probe...'
            }
          }
        });
        await Scan.addLogMessage(
          scanId,
          'dast',
          'Spinning up isolated Docker sandbox & OWASP ZAP probe (512MB RAM, 0.5 CPU limit)...',
          'info'
        );
        await Scan.addLogMessage(
          scanId,
          'dast',
          'Injecting dynamic baseline HTTP probes: inspecting CSP, HSTS, X-Frame-Options...',
          'info'
        );
      } catch (err) {
        logger.error(`Demo step 4 error: ${err.message}`);
      }
    }, 4400);

    // Step 5: Scoring Engine (at 6.0s)
    setTimeout(async () => {
      try {
        await Scan.updateById(scanId, {
          status: 'ANALYZING',
          currentStage: 'analysis',
          progress: 92,
          stageProgress: {
            dast: {
              status: 'completed',
              progress: 100,
              tool: 'OWASP ZAP Docker',
              findingsCount: isReScan ? 1 : 2,
              message: 'Dynamic container probe finished successfully'
            }
          }
        });
        await Scan.addLogMessage(
          scanId,
          'scoring',
          'Calculating VibeShield Security Score & synthesizing Cursor / Claude AI Fix Prompts...',
          'info'
        );
      } catch (err) {
        logger.error(`Demo step 5 error: ${err.message}`);
      }
    }, 6000);

    // Final Step: Complete scan, save findings and report (at 7.4s)
    setTimeout(async () => {
      try {
        await this.finalizeDemoScan(scanId, targetId, isReScan);
      } catch (err) {
        logger.error(`Failed to finalize demo scan: ${err.message}`);
      }
    }, 7400);
  }

  /**
   * Finalizes the scan and saves findings, score, and report
   */
  static async finalizeDemoScan(scanId, targetId, isReScan) {
    const target = await Target.findById(targetId);
    const targetName = target?.name || target?.url || 'Demo Application';

    // Prepare realistic findings
    const findings = isReScan
      ? this.getReScanFindings(scanId, targetId)
      : this.getInitialFindings(scanId, targetId);

    // Save findings to database / memory store
    await Finding.insertMany(findings);

    // Initial scan score: 45/100 | Re-scan score: 95/100
    const finalScore = isReScan ? 95 : 45;
    const finalGrade = isReScan ? 'A+' : 'F';

    // Calculate score delta from previous scan
    const previousScans = await Scan.findByTargetId(targetId);
    const previousScan = previousScans.find(
      (s) => String(s._id) !== String(scanId) && s.status === 'COMPLETED' && s.score !== null
    );

    const scoreDelta = previousScan ? finalScore - previousScan.score : null;

    const summary = {
      criticalCount: 0,
      highCount: isReScan ? 0 : 2,
      mediumCount: isReScan ? 0 : 1,
      lowCount: isReScan ? 1 : 1,
      infoCount: 0,
      totalCount: findings.length
    };

    const executiveSummary = isReScan
      ? 'Outstanding improvement! After applying the AI fix prompts, all critical secrets, password hashing vulnerabilities, and security headers were successfully resolved. Security score upgraded to 95/100 (A+).'
      : 'Critical action required: Your application scored 45/100. Automated analysis detected hardcoded production API credentials, insecure MD5 password hashing, and missing Content-Security-Policy headers. Apply the One-Click AI Fix Prompts below to remediate immediately.';

    // Update Scan record
    const updatedScan = await Scan.updateById(scanId, {
      status: 'COMPLETED',
      currentStage: 'done',
      progress: 100,
      score: finalScore,
      scoreDelta,
      previousScanId: previousScan?._id || null,
      summary,
      durationSeconds: 7,
      completedAt: new Date()
    });

    // Update Target record
    await Target.updateById(targetId, {
      lastScore: finalScore,
      lastScanAt: new Date(),
      scansCount: (target?.scansCount || 0) + 1,
      verified: true
    });

    // Create Report
    const reportData = {
      scanId,
      targetId,
      targetName,
      score: finalScore,
      grade: finalGrade,
      scoreDelta,
      executiveSummary,
      disclaimer: ScoringEngine.DISCLAIMER,
      findingsBreakdown: {
        critical: 0,
        high: summary.highCount,
        medium: summary.mediumCount,
        low: summary.lowCount,
        info: 0,
        total: summary.totalCount
      },
      categoryBreakdown: {
        secrets: isReScan ? 0 : 1,
        auth: 0,
        crypto: isReScan ? 0 : 1,
        injection: 0,
        headers: isReScan ? 1 : 2,
        exposedFiles: 0,
        misconfig: 0
      },
      topRisks: findings.map((f) => ({
        title: f.title,
        severity: f.severity,
        category: f.category,
        impact: f.plainEnglish?.whyItMatters
      }))
    };

    const createdReport = await Report.create(reportData);

    try {
      const htmlPath = await PdfService.generateReportHtml(createdReport, target || {}, updatedScan, findings);
      await Report.create({
        ...reportData,
        pdfPath: htmlPath,
        pdfUrl: `/api/reports/${scanId}/download`
      });
    } catch {}

    await Scan.addLogMessage(
      scanId,
      'orchestrator',
      `Demo scan finished in 7.4s! Final Score: ${finalScore}/100 (${finalGrade})${
        scoreDelta ? ` [Delta: +${scoreDelta} pts improvement]` : ''
      }`,
      'info'
    );

    logger.info(`[DemoOrchestrator] Demo scan finalized successfully: ${scanId} (Score: ${finalScore}/100)`);
  }

  /**
   * Realistic Initial Findings (Score: 45/100, Grade: F)
   */
  static getInitialFindings(scanId, targetId) {
    return [
      {
        scanId,
        targetId,
        tool: 'gitleaks',
        ruleId: 'stripe-secret-key',
        title: 'Hardcoded Stripe API Secret Key in .env',
        severity: 'HIGH',
        category: 'SECRETS',
        cwe: 'CWE-798: Use of Hard-coded Credentials',
        owasp: 'A07:2021 - Identification and Authentication Failures',
        plainEnglish: {
          whatItIs: 'An active live Stripe Secret Key (sk_live_...) was discovered in your project configuration.',
          whyItMatters: 'Anyone with repository read access can initiate refunds, create unauthorized customer charges, and steal payment transaction records.',
          howToFix: 'Immediately rotate the key in the Stripe Dashboard, remove .env from git tracking, and load the key strictly from server environment variables.'
        },
        aiPrompt: {
          role: 'Senior Application Security Engineer',
          targetFile: '.env',
          lineNumber: 4,
          vulnerableCode: 'STRIPE_SECRET_KEY=sk_live_51OzQ4...[REDACTED]...9xL2',
          instructions: 'Remove hardcoded secret key, add .env to .gitignore, and access via process.env.STRIPE_SECRET_KEY.',
          formattedPrompt: `You are a Senior Application Security Engineer. Please fix a HIGH severity secret leakage vulnerability identified in my application.

---
VULNERABILITY DETAILS:
• Issue: Hardcoded Stripe API Secret Key in .env
• Rule ID: stripe-secret-key
• Severity: HIGH
• Category: SECRETS
• File: .env
• Location: Line 4

VULNERABLE CODE SNIPPET:
\`\`\`
STRIPE_SECRET_KEY=sk_live_51OzQ4...[REDACTED]...9xL2
\`\`\`

SECURITY REMEDIATION GOAL:
1. Ensure .env is added to .gitignore so it is never committed to GitHub.
2. Provide a .env.example template with dummy placeholders (STRIPE_SECRET_KEY=your_stripe_secret_key_here).
3. Update server code to validate that process.env.STRIPE_SECRET_KEY exists at runtime.
4. Give instructions on revoking and rolling the compromised key in the Stripe Dashboard.
---`
        },
        location: {
          file: '.env',
          startLine: 4,
          endLine: 4,
          evidence: 'STRIPE_SECRET_KEY=sk_live_51OzQ4...[REDACTED]...9xL2'
        },
        status: 'OPEN'
      },
      {
        scanId,
        targetId,
        tool: 'semgrep',
        ruleId: 'vibe-weak-password-hashing-md5',
        title: 'Weak MD5 Password Hashing in auth.js',
        severity: 'HIGH',
        category: 'CRYPTO',
        cwe: 'CWE-328: Use of Weak Hash',
        owasp: 'A02:2021 - Cryptographic Failures',
        plainEnglish: {
          whatItIs: 'Your authentication logic hashes user passwords using the obsolete and broken MD5 algorithm.',
          whyItMatters: 'MD5 is not a password hashing function. Precomputed rainbow tables allow attackers to reverse user passwords in seconds if the database is leaked.',
          howToFix: 'Replace MD5 with bcrypt (salt rounds >= 12) or Argon2id for password verification.'
        },
        aiPrompt: {
          role: 'Senior Full-Stack & Application Security Engineer',
          targetFile: 'server/routes/auth.js',
          lineNumber: 48,
          vulnerableCode: "const passwordHash = crypto.createHash('md5').update(password).digest('hex');",
          instructions: 'Replace MD5 hashing with bcrypt.hash(password, 12) and bcrypt.compare.',
          formattedPrompt: `You are a Senior Full-Stack & Application Security Engineer. Please fix a HIGH severity password hashing flaw identified in my application.

---
VULNERABILITY DETAILS:
• Issue: Weak MD5 Password Hashing in auth.js
• Rule ID: vibe-weak-password-hashing-md5
• Severity: HIGH
• Category: CRYPTO
• File: server/routes/auth.js
• Location: Line 48

VULNERABLE CODE SNIPPET:
\`\`\`javascript
const passwordHash = crypto.createHash('md5').update(password).digest('hex');
\`\`\`

SECURITY REMEDIATION GOAL:
1. Replace MD5 with \`bcrypt\`.
2. Hash user passwords with: \`const passwordHash = await bcrypt.hash(password, 12);\`
3. In the login route, verify with: \`const isValid = await bcrypt.compare(password, user.passwordHash);\`
4. Include \`npm install bcrypt\` in your instructions.
---`
        },
        location: {
          file: 'server/routes/auth.js',
          startLine: 48,
          endLine: 50,
          evidence: "const passwordHash = crypto.createHash('md5').update(password).digest('hex');"
        },
        status: 'OPEN'
      },
      {
        scanId,
        targetId,
        tool: 'zap',
        ruleId: 'zap-missing-csp-header',
        title: 'Missing Content-Security-Policy (CSP) Header',
        severity: 'MEDIUM',
        category: 'HEADERS',
        cwe: 'CWE-1021: Improper Restriction of Rendered UI Layers',
        owasp: 'A05:2021 - Security Misconfiguration',
        plainEnglish: {
          whatItIs: 'The web application does not set a Content-Security-Policy (CSP) HTTP response header.',
          whyItMatters: 'Without CSP, any Cross-Site Scripting (XSS) vulnerability can execute arbitrary third-party scripts, hijack sessions, and exfiltrate user credentials.',
          howToFix: 'Set a strict Content-Security-Policy header in your web server or Next.js headers configuration.'
        },
        aiPrompt: {
          role: 'Frontend & Web Security Engineer',
          targetFile: 'next.config.js (or Express app.js)',
          lineNumber: 1,
          vulnerableCode: 'Header "Content-Security-Policy" is missing in HTTP response',
          instructions: 'Add strict Content-Security-Policy header restricting script and object sources.',
          formattedPrompt: `You are a Frontend & Web Security Engineer. Please fix a MEDIUM severity missing security header vulnerability in my application.

---
VULNERABILITY DETAILS:
• Issue: Missing Content-Security-Policy (CSP) Header
• Rule ID: zap-missing-csp-header
• Severity: MEDIUM
• Category: HEADERS
• File: next.config.js (or server/app.js)
• Location: Line 1

VULNERABLE CODE SNIPPET:
\`\`\`
Header "Content-Security-Policy" is missing in HTTP responses
\`\`\`

SECURITY REMEDIATION GOAL:
Provide the drop-in configuration for Next.js async headers() or Express helmet() that sets:
"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; object-src 'none';"
---`
        },
        location: {
          file: 'next.config.js',
          startLine: 1,
          evidence: 'Missing Content-Security-Policy header in live response'
        },
        status: 'OPEN'
      },
      {
        scanId,
        targetId,
        tool: 'zap',
        ruleId: 'zap-missing-x-frame-options',
        title: 'Missing Anti-Clickjacking Header (X-Frame-Options)',
        severity: 'LOW',
        category: 'HEADERS',
        cwe: 'CWE-1021: Restricting Frame Embedding',
        owasp: 'A05:2021 - Security Misconfiguration',
        plainEnglish: {
          whatItIs: 'Your application does not prevent other websites from rendering it inside an <iframe>.',
          whyItMatters: 'Malicious sites can overlay invisible buttons over your site (Clickjacking) to trick logged-in users into executing unintended actions.',
          howToFix: 'Set header "X-Frame-Options: DENY" or use helmet.frameguard({ action: "deny" }).'
        },
        aiPrompt: {
          role: 'Application Security Engineer',
          targetFile: 'server/app.js',
          lineNumber: 1,
          vulnerableCode: 'Missing X-Frame-Options header',
          instructions: 'Add X-Frame-Options: DENY header.',
          formattedPrompt: `You are an Application Security Engineer. Please add an anti-clickjacking header:
Set "X-Frame-Options: DENY" on all HTTP responses.`
        },
        location: {
          file: 'server/app.js',
          startLine: 1,
          evidence: 'Missing X-Frame-Options header'
        },
        status: 'OPEN'
      }
    ];
  }

  /**
   * Realistic Re-Scan Findings (Score: 95/100, Grade: A+)
   * Demonstrates that the High & Medium issues were resolved!
   */
  static getReScanFindings(scanId, targetId) {
    return [
      {
        scanId,
        targetId,
        tool: 'zap',
        ruleId: 'zap-missing-x-frame-options',
        title: 'Informational: Frame-Ancestors Header Optimization',
        severity: 'LOW',
        category: 'HEADERS',
        cwe: 'CWE-1021: Restricting Frame Embedding',
        owasp: 'A05:2021 - Security Misconfiguration',
        plainEnglish: {
          whatItIs: 'Basic clickjacking protection is active. Consider adding frame-ancestors directive to your CSP.',
          whyItMatters: 'Modern browsers prioritize CSP frame-ancestors over legacy X-Frame-Options.',
          howToFix: 'Include "frame-ancestors \'none\';" in your Content-Security-Policy.'
        },
        aiPrompt: {
          role: 'Web Security Engineer',
          targetFile: 'next.config.js',
          lineNumber: 1,
          vulnerableCode: "frame-ancestors 'none'",
          instructions: 'Include frame-ancestors in Content-Security-Policy.',
          formattedPrompt: `Add "frame-ancestors 'none'" to CSP.`
        },
        location: {
          file: 'next.config.js',
          startLine: 1,
          evidence: 'Optimized header advisory'
        },
        status: 'OPEN'
      }
    ];
  }
}
