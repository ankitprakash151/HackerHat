'use client';

import React, { useState } from 'react';
import { Finding } from '../types';
import { SeverityBadge } from './SeverityBadge';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileCode,
  Globe,
  HelpCircle,
  AlertOctagon,
  Wrench,
  CheckCircle2
} from 'lucide-react';

interface FindingCardProps {
  finding: Finding;
  onOpenAiPrompt: (finding: Finding) => void;
}

export function FindingCard({ finding, onOpenAiPrompt }: FindingCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl bg-surface border border-border overflow-hidden transition-all hover:border-slate-700">
      {/* Top Banner Header */}
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="pt-0.5">
            <SeverityBadge severity={finding.severity} />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                {finding.title}
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-elevated text-slate-300 border border-border">
                {finding.category}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary-500/10 text-primary-400 border border-primary-500/20">
                {finding.tool.toUpperCase()}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
              {finding.location?.file ? (
                <span className="flex items-center gap-1 text-slate-300">
                  <FileCode className="w-3.5 h-3.5 text-primary-400" />
                  {finding.location.file}:{finding.location.startLine || 1}
                </span>
              ) : finding.location?.url ? (
                <span className="flex items-center gap-1 text-slate-300">
                  <Globe className="w-3.5 h-3.5 text-cyber-cyan" />
                  {finding.location.url}
                </span>
              ) : null}

              {finding.cwe && <span>{finding.cwe}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            onClick={() => onOpenAiPrompt(finding)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-primary-600/20 transition-all hover:scale-[1.02]"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Fix Prompt</span>
          </button>

          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg hover:bg-surface-elevated text-slate-400 hover:text-white transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Details Section */}
      {expanded && (
        <div className="border-t border-border bg-surface-elevated/40 p-4 sm:p-5 space-y-4">
          {/* Beginner-friendly 3-part explanation */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-lg bg-surface border border-border">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-200 mb-1.5">
                <HelpCircle className="w-4 h-4 text-primary-400" />
                <span>What Is This?</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {finding.plainEnglish?.whatItIs}
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-surface border border-border">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-300 mb-1.5">
                <AlertOctagon className="w-4 h-4 text-amber-400" />
                <span>Why It Matters (Risk)</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {finding.plainEnglish?.whyItMatters}
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-surface border border-border">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-300 mb-1.5">
                <Wrench className="w-4 h-4 text-emerald-400" />
                <span>How to Fix</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {finding.plainEnglish?.howToFix}
              </p>
            </div>
          </div>

          {/* Code snippet preview (with secrets redacted) */}
          {(finding.location?.evidence || finding.aiPrompt?.vulnerableCode) && (
            <div className="rounded-lg bg-background border border-border overflow-hidden">
              <div className="px-3 py-1.5 bg-surface border-b border-border text-[11px] font-mono text-slate-400 flex items-center justify-between">
                <span>Vulnerable Code Snippet (Secrets Redacted)</span>
                <span className="text-[10px] text-slate-500">
                  {finding.location?.file || 'source'}
                </span>
              </div>
              <pre className="p-3 text-xs font-mono text-slate-300 overflow-x-auto">
                <code>{finding.location?.evidence || finding.aiPrompt?.vulnerableCode}</code>
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
