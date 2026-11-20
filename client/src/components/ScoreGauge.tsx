'use client';

import React from 'react';
import { getScoreColor } from '../lib/utils';
import { Shield, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

interface ScoreGaugeProps {
  score: number | null;
  grade?: string;
  scoreDelta?: number | null;
  size?: number;
}

export function ScoreGauge({ score, grade, scoreDelta, size = 180 }: ScoreGaugeProps) {
  const displayScore = score !== null && score !== undefined ? score : 0;
  const strokeWidth = 14;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (displayScore / 100) * circumference;
  const color = getScoreColor(displayScore);

  return (
    <div className="flex flex-col items-center">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#1e293b"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Animated Value Arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Center Content */}
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="text-4xl font-extrabold tracking-tight text-white font-mono">
            {score !== null ? score : '--'}
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Out of 100
          </span>
          {grade && (
            <span
              className="mt-1 text-xs font-bold px-2 py-0.5 rounded-full border"
              style={{
                color: color,
                borderColor: `${color}40`,
                backgroundColor: `${color}15`
              }}
            >
              Grade {grade}
            </span>
          )}
        </div>
      </div>

      {/* Delta indicator */}
      {scoreDelta !== null && scoreDelta !== undefined && (
        <div className="mt-3">
          {scoreDelta > 0 ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+{scoreDelta} pts improved</span>
            </span>
          ) : scoreDelta < 0 ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
              <TrendingDown className="w-3.5 h-3.5" />
              <span>{scoreDelta} pts regression</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/30">
              <span>No score change</span>
            </span>
          )}
        </div>
      )}

      {/* Disclaimer */}
      <div className="mt-4 p-3 rounded-lg bg-surface border border-border text-[11px] text-slate-400 flex items-start gap-2 max-w-sm">
        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p>
          <strong>Security Notice:</strong> A high score reflects checks against common vulnerabilities, not a 100% guarantee of immunity from targeted attacks.
        </p>
      </div>
    </div>
  );
}
