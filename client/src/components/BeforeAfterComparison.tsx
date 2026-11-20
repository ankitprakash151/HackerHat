'use client';

import React from 'react';
import { BeforeAfterComparisonData } from '../types';
import { TrendingUp, TrendingDown, ArrowRight, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { getScoreColor } from '../lib/utils';

interface BeforeAfterComparisonProps {
  data: BeforeAfterComparisonData | null;
}

export function BeforeAfterComparison({ data }: BeforeAfterComparisonProps) {
  if (!data || !data.previousScan) {
    return (
      <div className="p-6 rounded-xl bg-surface border border-border text-center text-slate-400 text-xs">
        <ShieldCheck className="w-8 h-8 text-primary-400 mx-auto mb-2 opacity-60" />
        <p className="font-semibold text-slate-300">Baseline Scan Established</p>
        <p className="mt-1 max-w-sm mx-auto text-slate-400">
          Re-scan this target after applying the AI Fix Prompts to see your before-and-after score delta!
        </p>
      </div>
    );
  }

  const prevScore = data.previousScan.score;
  const currScore = data.currentScan.score;
  const delta = data.delta ?? currScore - prevScore;

  const isImproved = delta > 0;
  const isWorse = delta < 0;

  return (
    <div className="p-6 rounded-xl bg-surface border border-border">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span>Before & After Security Comparison</span>
            {isImproved ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>+{delta} Pts Improved</span>
              </span>
            ) : isWorse ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30">
                <TrendingDown className="w-3.5 h-3.5" />
                <span>{delta} Pts Regression</span>
              </span>
            ) : (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/30">
                No Delta
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Measured progress between consecutive scans of this target
          </p>
        </div>

        {/* Visual score progression pill */}
        <div className="flex items-center gap-3 bg-background px-4 py-2 rounded-xl border border-border">
          <div className="text-center">
            <div className="text-[10px] uppercase font-bold text-slate-500">Previous</div>
            <div
              className="text-lg font-mono font-extrabold"
              style={{ color: getScoreColor(prevScore) }}
            >
              {prevScore}/100
            </div>
          </div>

          <ArrowRight className="w-4 h-4 text-slate-500" />

          <div className="text-center">
            <div className="text-[10px] uppercase font-bold text-slate-500">Current</div>
            <div
              className="text-lg font-mono font-extrabold"
              style={{ color: getScoreColor(currScore) }}
            >
              {currScore}/100
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Resolved Findings */}
        <div className="p-4 rounded-lg bg-background border border-emerald-500/20">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 mb-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>Resolved Vulnerabilities ({data.resolvedCount})</span>
          </div>
          {data.resolvedFindings && data.resolvedFindings.length > 0 ? (
            <ul className="space-y-1.5 text-xs text-slate-300">
              {data.resolvedFindings.slice(0, 4).map((f, i) => (
                <li key={i} className="flex items-center gap-2 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span className="truncate">{f.title}</span>
                </li>
              ))}
              {data.resolvedFindings.length > 4 && (
                <li className="text-[11px] text-slate-500 pl-3.5">
                  +{data.resolvedFindings.length - 4} more fixed
                </li>
              )}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">No previously resolved issues detected.</p>
          )}
        </div>

        {/* New or Remaining Findings */}
        <div className="p-4 rounded-lg bg-background border border-border">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400 mb-2">
            <AlertTriangle className="w-4 h-4" />
            <span>New or Open Issues ({data.newFindingsCount})</span>
          </div>
          {data.newFindings && data.newFindings.length > 0 ? (
            <ul className="space-y-1.5 text-xs text-slate-300">
              {data.newFindings.slice(0, 4).map((f, i) => (
                <li key={i} className="flex items-center gap-2 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  <span className="truncate">{f.title}</span>
                </li>
              ))}
              {data.newFindings.length > 4 && (
                <li className="text-[11px] text-slate-500 pl-3.5">
                  +{data.newFindings.length - 4} more open
                </li>
              )}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">No new vulnerabilities introduced!</p>
          )}
        </div>
      </div>
    </div>
  );
}
