import { redactSecrets } from '../utils/sanitizer.js';

export class PromptGenerator {
  /**
   * Generates a tailor-made AI prompt for a finding to paste into Cursor / Claude / ChatGPT
   */
  static generatePrompt(finding) {
    const file = finding.location?.file || 'the affected file';
    const line = finding.location?.startLine ? `Line ${finding.location.startLine}` : 'in the component';
    const cleanSnippet = redactSecrets(finding.location?.evidence || finding.aiPrompt?.vulnerableCode || '');
    const title = finding.title || 'Security Vulnerability';
    const severity = finding.severity || 'HIGH';
    const ruleId = finding.ruleId || 'security-audit';
    const howToFix = finding.plainEnglish?.howToFix || finding.aiPrompt?.instructions || 'Fix the security issue';
    const category = finding.category || 'MISCONFIG';

    const formattedPrompt = `You are a Senior Full-Stack & Application Security Engineer. Please fix a ${severity} severity security vulnerability identified in my application.

---
VULNERABILITY DETAILS:
• Issue: ${title}
• Rule ID: ${ruleId}
• Severity: ${severity}
• Category: ${category}
• File: ${file}
• Location: ${line}

VULNERABLE CODE SNIPPET:
\`\`\`
${cleanSnippet || '// See location in file'}
\`\`\`

SECURITY REMEDIATION GOAL:
${howToFix}

INSTRUCTIONS FOR YOU:
1. Provide the exact drop-in replacement code for the affected section in \`${file}\`.
2. Do not introduce breaking changes to existing business logic.
3. Ensure no secrets, unhashed passwords, or unauthenticated routes are left vulnerable.
4. Add clear code comments explaining why the fix satisfies OWASP & security standards.
5. If new npm packages (such as bcrypt, helmet, or dotenv) are required, include the exact terminal install command.
---`;

    return {
      role: 'Senior Full-Stack & Application Security Engineer',
      targetFile: file,
      lineNumber: finding.location?.startLine || 1,
      vulnerableCode: cleanSnippet,
      instructions: howToFix,
      formattedPrompt
    };
  }

  /**
   * Generates a multi-issue master prompt for an entire scan
   */
  static generateMasterFixPlan(findings = []) {
    if (findings.length === 0) {
      return 'No vulnerabilities to fix! All checks passed.';
    }

    const issuesList = findings
      .map(
        (f, idx) =>
          `${idx + 1}. [${f.severity}] ${f.title} (${f.location?.file || f.location?.url || 'N/A'}:${f.location?.startLine || 1})\n   Fix: ${f.plainEnglish?.howToFix}`
      )
      .join('\n\n');

    return `You are a Principal Security Architect. Review the following security audit findings for our application and provide a step-by-step remediation plan with updated code:

${issuesList}

Please present the fixes in order of severity (Critical & High first). Provide exact code diffs and npm packages needed.`;
  }
}
