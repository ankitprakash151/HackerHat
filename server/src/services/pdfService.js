import fs from 'fs';
import path from 'path';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export class PdfService {
  /**
   * Generates a printable, styled HTML report that converts directly to PDF
   */
  static async generateReportHtml(report, target, scan, findings = []) {
    fs.mkdirSync(env.REPORTS_STORAGE_DIR, { recursive: true });
    const filename = `vibeshield-report-${scan._id}.html`;
    const outputPath = path.join(env.REPORTS_STORAGE_DIR, filename);

    const gradeColor =
      report.score >= 85 ? '#10b981' : report.score >= 60 ? '#f59e0b' : '#ef4444';

    const findingsRows = findings
      .map((f, i) => {
        const sevBg =
          f.severity === 'CRITICAL'
            ? '#fee2e2'
            : f.severity === 'HIGH'
            ? '#ffedd5'
            : f.severity === 'MEDIUM'
            ? '#fef3c7'
            : '#f1f5f9';
        const sevText =
          f.severity === 'CRITICAL'
            ? '#991b1b'
            : f.severity === 'HIGH'
            ? '#9a3412'
            : f.severity === 'MEDIUM'
            ? '#92400e'
            : '#334155';

        return `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px; font-weight: 600;">#${i + 1}</td>
            <td style="padding: 12px;">
              <span style="background: ${sevBg}; color: ${sevText}; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 700;">
                ${f.severity}
              </span>
            </td>
            <td style="padding: 12px;">
              <div style="font-weight: 600; color: #0f172a;">${f.title}</div>
              <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
                ${f.location?.file ? `${f.location.file}:${f.location.startLine}` : f.location?.url || ''}
              </div>
            </td>
            <td style="padding: 12px; font-size: 13px; color: #334155;">
              ${f.plainEnglish?.whatItIs || ''}
            </td>
            <td style="padding: 12px; font-size: 12px; color: #0369a1; font-family: monospace;">
              ${f.plainEnglish?.howToFix || ''}
            </td>
          </tr>
        `;
      })
      .join('');

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>VibeShield Security Audit Report - ${target.name || 'Application'}</title>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none; }
      .page-break { page-break-after: always; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 40px;
      line-height: 1.5;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 24px;
      margin-bottom: 32px;
    }
    .logo {
      font-size: 26px;
      font-weight: 800;
      color: #4f46e5;
      letter-spacing: -0.5px;
    }
    .badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      background: #e0e7ff;
      color: #3730a3;
    }
    .score-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 32px;
    }
    .score-dial {
      font-size: 54px;
      font-weight: 900;
      color: ${gradeColor};
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 32px;
    }
    .stat-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    .stat-val {
      font-size: 28px;
      font-weight: 700;
    }
    .stat-label {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 600;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 16px;
    }
    th {
      background: #f1f5f9;
      text-align: left;
      padding: 12px;
      font-size: 12px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
    }
    .disclaimer {
      margin-top: 40px;
      padding: 16px;
      border-radius: 8px;
      background: #fffbeb;
      border: 1px solid #fef3c7;
      font-size: 12px;
      color: #92400e;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">🛡️ VibeShield</div>
      <div style="font-size: 13px; color: #64748b; margin-top: 4px;">Automated Security Audit & AI Remediation Report</div>
    </div>
    <div style="text-align: right;">
      <span class="badge">SCAN ID: ${scan._id.toString().slice(0, 8)}</span>
      <div style="font-size: 12px; color: #64748b; margin-top: 6px;">Generated: ${new Date().toUTCString()}</div>
    </div>
  </div>

  <div class="score-card">
    <div>
      <h2 style="margin: 0 0 8px 0; font-size: 20px;">Target: ${target.name || target.url || 'Web Application'}</h2>
      <div style="font-size: 14px; color: #475569;">Target Type: <strong>${target.type}</strong> | Ownership: <strong>Verified (${target.verificationMethod})</strong></div>
      <p style="margin: 12px 0 0 0; font-size: 14px; color: #334155; max-width: 600px;">
        ${report.executiveSummary}
      </p>
    </div>
    <div style="text-align: center;">
      <div class="score-dial">${report.score}/100</div>
      <div style="font-weight: 700; color: ${gradeColor}; font-size: 18px;">GRADE: ${report.grade}</div>
      ${
        report.scoreDelta !== null && report.scoreDelta !== undefined
          ? `<div style="font-size: 12px; font-weight: 600; color: ${report.scoreDelta >= 0 ? '#10b981' : '#ef4444'}; margin-top: 4px;">
              Delta: ${report.scoreDelta > 0 ? '+' : ''}${report.scoreDelta} pts from previous scan
             </div>`
          : ''
      }
    </div>
  </div>

  <div class="stats-grid">
    <div class="stat-box">
      <div class="stat-val" style="color: #991b1b;">${report.findingsBreakdown?.critical || 0}</div>
      <div class="stat-label">Critical Risks</div>
    </div>
    <div class="stat-box">
      <div class="stat-val" style="color: #ea580c;">${report.findingsBreakdown?.high || 0}</div>
      <div class="stat-label">High Risks</div>
    </div>
    <div class="stat-box">
      <div class="stat-val" style="color: #d97706;">${report.findingsBreakdown?.medium || 0}</div>
      <div class="stat-label">Medium Risks</div>
    </div>
    <div class="stat-box">
      <div class="stat-val" style="color: #0284c7;">${report.findingsBreakdown?.low || 0}</div>
      <div class="stat-label">Low / Info</div>
    </div>
  </div>

  <h3 style="font-size: 18px; margin-bottom: 8px;">Detailed Vulnerability Findings (${findings.length})</h3>
  <table>
    <thead>
      <tr>
        <th style="width: 40px;">#</th>
        <th style="width: 90px;">Severity</th>
        <th style="width: 250px;">Vulnerability & Location</th>
        <th>What It Is & Risk</th>
        <th>Remediation Advice</th>
      </tr>
    </thead>
    <tbody>
      ${findingsRows || '<tr><td colspan="5" style="text-align: center; padding: 24px; color: #10b981;">No security findings identified!</td></tr>'}
    </tbody>
  </table>

  <div class="disclaimer">
    <strong>Security Disclaimer:</strong> ${report.disclaimer || 'A high security score reflects checks against common known automated vulnerabilities and does not represent a 100% guarantee of immunity from targeted attacks.'}
  </div>

  <script>
    // Auto-trigger print if requested
    if (window.location.search.includes('print=true')) {
      window.print();
    }
  </script>
</body>
</html>`;

    fs.writeFileSync(outputPath, htmlContent, 'utf8');
    logger.info(`Generated report HTML at: ${outputPath}`);
    return outputPath;
  }
}
