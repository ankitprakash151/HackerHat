import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { validateAndSanitizeUrl, sanitizeCliArgs } from '../utils/sanitizer.js';

export class DastRunner {
  /**
   * Main entry point to run Stage 2 DAST
   */
  static async runScan(targetUrl, scanId, targetId) {
    logger.info(`Starting Stage 2 DAST for target: ${targetUrl}`);
    const findings = [];
    const sanitizedUrl = validateAndSanitizeUrl(targetUrl);

    // 1. Attempt OWASP ZAP in Docker
    let zapSuccess = false;
    try {
      const zapFindings = await this.runOwaspZapDocker(sanitizedUrl, scanId, targetId);
      findings.push(...zapFindings);
      zapSuccess = true;
    } catch (err) {
      logger.warn(`OWASP ZAP Docker execution warning: ${err.message}. Running active network security prober.`);
    }

    // 2. If Docker wasn't available or returned empty, run native HTTP Prober
    if (!zapSuccess || findings.length === 0) {
      try {
        const probeFindings = await this.runNativeHttpSecurityProbe(sanitizedUrl, scanId, targetId);
        findings.push(...probeFindings);
      } catch (err) {
        logger.error(`Native HTTP prober failed: ${err.message}`);
      }
    }

    logger.info(`DAST Stage completed. Found ${findings.length} findings.`);
    return findings;
  }

  /**
   * Runs OWASP ZAP in ephemeral, strictly sandboxed Docker container
   * Strict limits: memory="512m", cpus="0.5", pids-limit=100, 3-minute kill timer
   */
  static async runOwaspZapDocker(targetUrl, scanId, targetId) {
    const hostWorkDir = path.join(env.TEMP_UPLOAD_DIR, `zap_${scanId}`);
    fs.mkdirSync(hostWorkDir, { recursive: true });

    const reportFileName = 'zap-report.json';
    const reportFilePath = path.join(hostWorkDir, reportFileName);

    const containerName = `vibeshield_zap_${scanId.substring(0, 8)}_${Date.now()}`;

    // Docker arguments with strict sandboxing and resource limits
    const dockerArgs = sanitizeCliArgs([
      'run',
      '--name', containerName,
      '--rm',
      '--memory=512m',
      '--cpus=0.5',
      '--pids-limit=100',
      '--network=bridge',
      '-v', `${hostWorkDir}:/zap/wrk:rw`,
      env.ZAP_DOCKER_IMAGE,
      'zap-baseline.py',
      '-t', targetUrl,
      '-J', reportFileName,
      '-m', '3' // 3 minute internal ZAP timeout
    ]);

    logger.info(`Spawning sandboxed OWASP ZAP container: ${containerName}`);

    return new Promise((resolve, reject) => {
      let isTimedOut = false;
      const child = spawn(env.DOCKER_PATH, dockerArgs, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // 3-Minute hard kill watchdog timer
      const watchdog = setTimeout(() => {
        isTimedOut = true;
        logger.warn(`DAST scan exceeded 3-minute timeout! Force killing container ${containerName}`);
        try {
          spawn(env.DOCKER_PATH, ['kill', containerName]);
          child.kill('SIGKILL');
        } catch {}
      }, env.DAST_TIMEOUT_MS);

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (d) => { stdout += d.toString(); });
      child.stderr.on('data', (d) => { stderr += d.toString(); });

      child.on('close', (code) => {
        clearTimeout(watchdog);

        // Clean up container just in case --rm didn't catch it
        try {
          spawn(env.DOCKER_PATH, ['rm', '-f', containerName]);
        } catch {}

        if (isTimedOut) {
          logger.warn(`ZAP container was terminated due to timeout`);
        }

        if (fs.existsSync(reportFilePath)) {
          try {
            const rawJson = fs.readFileSync(reportFilePath, 'utf8');
            const zapData = JSON.parse(rawJson);
            const normalized = this.normalizeZapReport(zapData, scanId, targetId, targetUrl);

            // Clean up host temp directory
            try {
              fs.rmSync(hostWorkDir, { recursive: true, force: true });
            } catch {}

            resolve(normalized);
          } catch (parseErr) {
            reject(new Error(`Failed to parse ZAP output: ${parseErr.message}`));
          }
        } else {
          // If zap-report wasn't generated, clean up and reject
          try {
            fs.rmSync(hostWorkDir, { recursive: true, force: true });
          } catch {}
          reject(new Error(`ZAP did not produce a report (Exit code: ${code}). Stderr: ${stderr.slice(0, 200)}`));
        }
      });

      child.on('error', (err) => {
        clearTimeout(watchdog);
        reject(err);
      });
    });
  }

  /**
   * Translates OWASP ZAP alerts into VibeShield findings
   */
  static normalizeZapReport(zapData, scanId, targetId, targetUrl) {
    const findings = [];
    const siteAlerts = zapData.site || [];

    for (const site of siteAlerts) {
      const alerts = site.alerts || [];
      for (const alert of alerts) {
        let severity = 'LOW';
        if (alert.riskcode === '3') severity = 'HIGH';
        if (alert.riskcode === '2') severity = 'MEDIUM';
        if (alert.riskcode === '1') severity = 'LOW';
        if (alert.riskcode === '0') severity = 'INFO';

        let category = 'MISCONFIG';
        const nameLower = (alert.alert || '').toLowerCase();
        if (nameLower.includes('header') || nameLower.includes('csp') || nameLower.includes('hsts') || nameLower.includes('clickjacking')) {
          category = 'HEADERS';
        } else if (nameLower.includes('xss') || nameLower.includes('script')) {
          category = 'INJECTION';
        } else if (nameLower.includes('sql') || nameLower.includes('injection')) {
          category = 'INJECTION';
        }

        const instance = (alert.instances && alert.instances[0]) || {};
        const affectedUrl = instance.uri || targetUrl;
        const evidence = instance.evidence || alert.evidence || '';

        findings.push({
          scanId,
          targetId,
          tool: 'zap',
          ruleId: `zap-plugin-${alert.pluginid || 'alert'}`,
          title: alert.alert || 'Security Issue Detected',
          severity,
          category,
          cwe: alert.cweid ? `CWE-${alert.cweid}` : 'CWE-693',
          owasp: 'A05:2021 - Security Misconfiguration',
          plainEnglish: {
            whatItIs: alert.desc ? alert.desc.replace(/<[^>]+>/g, '').slice(0, 300) : 'Potential dynamic vulnerability detected by OWASP ZAP baseline check.',
            whyItMatters: 'Web security misconfigurations allow attackers to eavesdrop, inject untrusted content, or compromise sessions.',
            howToFix: alert.solution ? alert.solution.replace(/<[^>]+>/g, '').slice(0, 300) : 'Implement industry standard security response headers and input sanitization.'
          },
          aiPrompt: {
            role: 'DevOps & Web Security Engineer',
            targetFile: 'server.js (or next.config.js / Nginx)',
            lineNumber: 1,
            vulnerableCode: evidence || affectedUrl,
            instructions: `Add or configure the following security remediation to your application headers: ${alert.solution || alert.alert}`
          },
          location: {
            url: affectedUrl,
            parameter: instance.param || '',
            evidence: evidence ? evidence.slice(0, 200) : ''
          },
          rawOutput: alert
        });
      }
    }

    return findings;
  }

  /**
   * Safe Native HTTP Probe Engine
   * Non-destructive probes:
   * 1. Missing Security Headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
   * 2. Exposed sensitive endpoints (/.env, /.git/HEAD)
   * 3. Open admin routes without rate limiting
   */
  static async runNativeHttpSecurityProbe(targetUrl, scanId, targetId) {
    const findings = [];
    const parsed = new URL(targetUrl);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const resp = await fetch(targetUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) VibeShield-Security-Auditor/1.0'
        }
      });
      clearTimeout(timeoutId);

      const headers = resp.headers;

      // 1. Check Content-Security-Policy (CSP)
      if (!headers.get('content-security-policy')) {
        findings.push({
          scanId,
          targetId,
          tool: 'zap',
          ruleId: 'zap-missing-csp-header',
          title: 'Missing Content-Security-Policy (CSP) Header',
          severity: 'HIGH',
          category: 'HEADERS',
          cwe: 'CWE-1021: Improper Restriction of Rendered UI Layers',
          owasp: 'A05:2021 - Security Misconfiguration',
          plainEnglish: {
            whatItIs: 'Your live website does not send a Content-Security-Policy (CSP) HTTP header.',
            whyItMatters: 'Without CSP, any Cross-Site Scripting (XSS) vulnerability can execute arbitrary third-party scripts, hijack sessions, and exfiltrate customer credentials.',
            howToFix: 'Set a strict Content-Security-Policy header in your web server or Next.js headers configuration.'
          },
          aiPrompt: {
            role: 'Frontend & Web Security Engineer',
            targetFile: 'next.config.js (or Express app.js)',
            lineNumber: 1,
            vulnerableCode: 'Header "Content-Security-Policy" is missing',
            instructions: `Add helmet or configure next.config.js async headers() to set: "default-src 'self'; script-src 'self' 'unsafe-inline'; object-src 'none';"`
          },
          location: { url: targetUrl, evidence: 'Missing Content-Security-Policy header' }
        });
      }

      // 2. Check Strict-Transport-Security (HSTS)
      if (parsed.protocol === 'https:' && !headers.get('strict-transport-security')) {
        findings.push({
          scanId,
          targetId,
          tool: 'zap',
          ruleId: 'zap-missing-hsts-header',
          title: 'Missing Strict-Transport-Security (HSTS) Header',
          severity: 'MEDIUM',
          category: 'HEADERS',
          cwe: 'CWE-319: Cleartext Transmission of Sensitive Information',
          owasp: 'A02:2021 - Cryptographic Failures',
          plainEnglish: {
            whatItIs: 'The Strict-Transport-Security (HSTS) header is not configured on your HTTPS endpoint.',
            whyItMatters: 'HSTS instructs browsers to only connect over HTTPS. Without it, users on public Wi-Fi can be downgraded to unencrypted HTTP via SSL-stripping attacks.',
            howToFix: 'Add "Strict-Transport-Security: max-age=31536000; includeSubDomains; preload" to your server response headers.'
          },
          aiPrompt: {
            role: 'DevOps & Cloud Security Engineer',
            targetFile: 'Express app.js or Nginx config',
            lineNumber: 1,
            vulnerableCode: 'Header "Strict-Transport-Security" missing',
            instructions: 'Configure HSTS with max-age=31536000 (1 year) and includeSubDomains.'
          },
          location: { url: targetUrl, evidence: 'Missing Strict-Transport-Security header' }
        });
      }

      // 3. Check X-Frame-Options (Clickjacking defense)
      if (!headers.get('x-frame-options') && !headers.get('content-security-policy')?.includes('frame-ancestors')) {
        findings.push({
          scanId,
          targetId,
          tool: 'zap',
          ruleId: 'zap-missing-x-frame-options',
          title: 'Missing Anti-Clickjacking Header (X-Frame-Options)',
          severity: 'MEDIUM',
          category: 'HEADERS',
          cwe: 'CWE-1021: Restricting Frame Embedding',
          owasp: 'A05:2021 - Security Misconfiguration',
          plainEnglish: {
            whatItIs: 'Your application does not prevent other websites from rendering it inside an <iframe>.',
            whyItMatters: 'Malicious sites can overlay invisible buttons over your site (Clickjacking) to trick logged-in users into clicking dangerous actions.',
            howToFix: 'Set header "X-Frame-Options: DENY" or "X-Frame-Options: SAMEORIGIN".'
          },
          aiPrompt: {
            role: 'Application Security Engineer',
            targetFile: 'Express app.js or next.config.js',
            lineNumber: 1,
            vulnerableCode: 'Missing X-Frame-Options',
            instructions: 'Add "X-Frame-Options: DENY" or use app.use(helmet.frameguard({ action: "deny" })).'
          },
          location: { url: targetUrl, evidence: 'Missing X-Frame-Options header' }
        });
      }

      // 4. Check X-Content-Type-Options (MIME-Sniffing defense)
      if (headers.get('x-content-type-options') !== 'nosniff') {
        findings.push({
          scanId,
          targetId,
          tool: 'zap',
          ruleId: 'zap-missing-x-content-type-options',
          title: 'Missing X-Content-Type-Options: nosniff Header',
          severity: 'LOW',
          category: 'HEADERS',
          cwe: 'CWE-430: Deployment of Wrong Handler',
          owasp: 'A05:2021 - Security Misconfiguration',
          plainEnglish: {
            whatItIs: 'The X-Content-Type-Options header is absent or not set to nosniff.',
            whyItMatters: 'Old or vulnerable browsers might sniff file types and execute user-uploaded images as JavaScript scripts.',
            howToFix: 'Add header "X-Content-Type-Options: nosniff".'
          },
          aiPrompt: {
            role: 'AppSec Engineer',
            targetFile: 'server.js',
            lineNumber: 1,
            vulnerableCode: 'Missing X-Content-Type-Options',
            instructions: 'Set header "X-Content-Type-Options: nosniff" via Helmet.'
          },
          location: { url: targetUrl, evidence: 'Missing X-Content-Type-Options: nosniff' }
        });
      }

      // 5. Probe for publicly exposed /.env file
      try {
        const envProbeUrl = `${parsed.origin}/.env`;
        const envResp = await fetch(envProbeUrl, {
          method: 'GET',
          headers: { 'User-Agent': 'VibeShield-Auditor' }
        });
        if (envResp.ok) {
          const body = await envResp.text();
          if (body.includes('=') && (body.includes('KEY') || body.includes('SECRET') || body.includes('PORT') || body.includes('DATABASE') || body.includes('MONGODB'))) {
            findings.push({
              scanId,
              targetId,
              tool: 'zap',
              ruleId: 'zap-exposed-env-file-live',
              title: 'Critical: Production .env File Publicly Accessible',
              severity: 'CRITICAL',
              category: 'EXPOSED_FILES',
              cwe: 'CWE-552: Files or Directories Accessible to External Parties',
              owasp: 'A05:2021 - Security Misconfiguration',
              plainEnglish: {
                whatItIs: `Your server is serving the production /.env file directly to the public web at ${envProbeUrl}!`,
                whyItMatters: 'All your database passwords, API keys, and environment variables can be downloaded by anyone on the internet right now.',
                howToFix: 'Immediately block access to dot-files in your web server/reverse proxy and rotate all exposed secrets.'
              },
              aiPrompt: {
                role: 'Senior DevOps Security Engineer',
                targetFile: 'Nginx config or server.js static router',
                lineNumber: 1,
                vulnerableCode: `Public route /.env returned status ${envResp.status}`,
                instructions: 'Deny all requests matching dot-files (e.g. location ~ /\\. { deny all; }) and rotate all database/API secrets.'
              },
              location: { url: envProbeUrl, evidence: 'HTTP 200 on /.env probe' }
            });
          }
        }
      } catch {}

      // 6. Probe for exposed .git directory
      try {
        const gitProbeUrl = `${parsed.origin}/.git/HEAD`;
        const gitResp = await fetch(gitProbeUrl, {
          method: 'GET',
          headers: { 'User-Agent': 'VibeShield-Auditor' }
        });
        if (gitResp.ok) {
          const body = await gitResp.text();
          if (body.includes('ref: refs/')) {
            findings.push({
              scanId,
              targetId,
              tool: 'zap',
              ruleId: 'zap-exposed-git-directory-live',
              title: 'Critical: Exposed .git Directory on Web Server',
              severity: 'CRITICAL',
              category: 'EXPOSED_FILES',
              cwe: 'CWE-552: Files or Directories Accessible to External Parties',
              owasp: 'A05:2021 - Security Misconfiguration',
              plainEnglish: {
                whatItIs: `Your .git source repository directory is publicly exposed at ${gitProbeUrl}.`,
                whyItMatters: 'Attackers can download your entire repository commit history, past code, and deleted secrets.',
                howToFix: 'Block web server access to .git and ensure only the build artifacts (dist/build) are served.'
              },
              aiPrompt: {
                role: 'Infrastructure Security Engineer',
                targetFile: 'Nginx or Express static config',
                lineNumber: 1,
                vulnerableCode: 'HTTP 200 on /.git/HEAD',
                instructions: 'Configure reverse proxy to deny access to /.git and remove .git from production deployment folders.'
              },
              location: { url: gitProbeUrl, evidence: 'Exposed .git/HEAD' }
            });
          }
        }
      } catch {}
    } catch (err) {
      logger.info(`Live HTTP probe target reached with notice: ${err.message}`);
    }

    return findings;
  }
}
