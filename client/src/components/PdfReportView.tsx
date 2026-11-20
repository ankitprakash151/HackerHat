'use client';

import React from 'react';
import { Report, Finding, Target, Scan } from '../types';
import { SeverityBadge } from './SeverityBadge';
import { api } from '../lib/api';
import { Download, Printer, ShieldCheck, AlertCircle, FileText } from 'lucide-react';
import { getScoreColor } from '../lib/utils';

interface PdfReportViewProps {
  report: Report | null;
  target: Target;
  scan: Scan;
  findings: Finding[];
}

export function PdfReportView({ report, target, scan, findings }: PdfReportViewProps) {
  const score = report?.score ?? scan.score ?? 0;
  const grade = report?.grade || 'B';
  const downloadUrl = api.getReportDownloadUrl(scan._id);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-surface border border-border">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <FileText className="w-4 h-4 text-primary-400" />
          <span>Security Audit Report Ready</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-500 text-xs font-bold text-white transition-all shadow-md shadow-primary-600/20"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download HTML / PDF</span>
          </a>
        </div>
      </div>

      {/* Printable Report Canvas */}
      <div id="printable-report" className="p-8 rounded-2xl bg-surface border border-border space-y-8">
        {/* Report Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-6 gap-4">
          <div>
            <div className="flex items-center gap-2 text-primary-400 font-extrabold text-xl tracking-tight">
              <ShieldCheck className="w-6 h-6" />
              <span>VibeShield Security Audit</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Automated SAST & DAST Assessment for Non-Security Experts
            </p>
          </div>

          <div className="text-right text-xs font-mono text-slate-400">
            <div>Scan ID: {scan._id.slice(0, 10)}</div>
            <div>Date: {new Date(scan.completedAt || scan.createdAt).toLocaleDateString()}</div>
          </div>
        </div>

        {/* Executive Score Card */}
        <div className="p-6 rounded-xl bg-background border border-border flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
              Target Evaluated
            </span>
            <h2 className="text-lg font-bold text-white break-all">
              {target.name || target.url}
            </h2>
            <div className="text-xs text-slate-400">
              Type: <strong className="text-slate-300">{target.type}</strong> | Ownership:{' '}
              <strong className="text-emerald-400">Verified ({target.verificationMethod})</strong>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed pt-2">
              {report?.executiveSummary ||
                'Scan completed with automated vulnerability analysis and copy-paste remediation prompts.'}
            </p>
          </div>

          <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-surface border border-border min-w-[160px]">
            <div
              className="text-4xl font-extrabold font-mono"
              style={{ color: getScoreColor(score) }}
            >
              {score}/100
            </div>
            <span className="text-xs font-bold text-slate-300 mt-1">GRADE: {grade}</span>
            {scan.scoreDelta !== null && scan.scoreDelta !== undefined && (
              <span
                className={`text-[11px] font-bold mt-1 ${
                  scan.scoreDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {scan.scoreDelta > 0 ? `+${scan.scoreDelta}` : scan.scoreDelta} pts delta
              </span>
            )}
          </div>
        </div>

        {/* Severity Count Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
            <div className="text-2xl font-extrabold font-mono text-red-400">
              {scan.summary.criticalCount}
            </div>
            <div className="text-[11px] font-bold uppercase text-red-300">Critical</div>
          </div>
          <div className="p-3.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-center">
            <div className="text-2xl font-extrabold font-mono text-orange-400">
              {scan.summary.highCount}
            </div>
            <div className="text-[11px] font-bold uppercase text-orange-300">High</div>
          </div>
          <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
            <div className="text-2xl font-extrabold font-mono text-amber-400">
              {scan.summary.mediumCount}
            </div>
            <div className="text-[11px] font-bold uppercase text-amber-300">Medium</div>
          </div>
          <div className="p-3.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-center">
            <div className="text-2xl font-extrabold font-mono text-sky-400">
              {scan.summary.lowCount}
            </div>
            <div className="text-[11px] font-bold uppercase text-sky-300">Low / Info</div>
          </div>
        </div>

        {/* Findings Table */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Detected Vulnerabilities ({findings.length})
          </h3>

          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-background text-slate-400 font-mono text-[11px] border-b border-border">
                <tr>
                  <th className="p-3">Severity</th>
                  <th className="p-3">Vulnerability Title</th>
                  <th className="p-3">Location</th>
                  <th className="p-3">Remediation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {findings.length > 0 ? (
                  findings.map((f, i) => (
                    <tr key={i} className="hover:bg-surface-elevated/30">
                      <td className="p-3 whitespace-nowrap">
                        <SeverityBadge severity={f.severity} showIcon={false} />
                      </td>
                      <td className="p-3 font-semibold text-white">{f.title}</td>
                      <td className="p-3 font-mono text-slate-400">
                        {f.location?.file
                          ? `${f.location.file}:${f.location.startLine}`
                          : f.location?.url || 'Configuration'}
                      </td>
                      <td className="p-3 text-slate-300">{f.plainEnglish?.howToFix}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-emerald-400">
                      No security vulnerabilities identified!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legal & Technical Disclaimer */}
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
          <p>
            <strong>Technical Disclaimer:</strong>{' '}
            {report?.disclaimer ||
              'A high security score reflects checks against common known automated vulnerabilities (OWASP Top 10, exposed secrets, and standard static/dynamic patterns) and does not represent a 100% guarantee of immunity from targeted attacks, zero-day vulnerabilities, or business logic flaws.'}
          </p>
        </div>
      </div>
    </div>
  );
}
