'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Target, Scan } from '../types';
import { api } from '../lib/api';
import {
  ShieldCheck,
  Plus,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  ExternalLink,
  Lock,
  Clock,
  CheckCircle2,
  Cpu
} from 'lucide-react';
import { getScoreColor, formatDate } from '../lib/utils';
import { useDemoMode } from '../context/DemoModeContext';

export default function DashboardPage() {
  const { isDemoMode } = useDemoMode();
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const data = await api.listTargets();
      setTargets(data);
    } catch (err) {
      console.error('Failed to load targets:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalScans = targets.reduce((acc, t) => acc + (t.scansCount || 0), 0);
  const scoredTargets = targets.filter((t) => t.lastScore !== null && t.lastScore !== undefined);
  const avgScore =
    scoredTargets.length > 0
      ? Math.round(
          scoredTargets.reduce((acc, t) => acc + (t.lastScore || 0), 0) / scoredTargets.length
        )
      : null;

  return (
    <div className="space-y-8">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-surface via-surface-elevated to-primary-950/40 border border-border p-6 sm:p-8">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/30 text-primary-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Built for Cursor, Lovable, v0 & Copilot Builders</span>
            </div>
            {isDemoMode && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span>Demo Presentation Mode</span>
              </div>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Secure your vibe-coded application in seconds.
          </h1>

          <p className="text-sm text-slate-300 leading-relaxed">
            Verify ownership, run isolated Semgrep + Gitleaks SAST and OWASP ZAP dynamic scans, and get copy-paste AI fix prompts ready for your AI code editor.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/scan/new"
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-primary-600/25 transition-all hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" />
              <span>Scan New Application</span>
            </Link>

            <Link
              href="/targets"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface border border-border hover:bg-surface-elevated text-slate-300 hover:text-white text-xs sm:text-sm font-semibold transition-colors"
            >
              <span>View Targets & History</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Ambient background glow */}
        <div className="absolute right-0 top-0 w-80 h-80 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-surface border border-border">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Verified Targets</span>
            <Lock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {targets.filter((t) => t.verified).length}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            {targets.length} total registered
          </span>
        </div>

        <div className="p-5 rounded-xl bg-surface border border-border">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Completed Scans</span>
            <Cpu className="w-4 h-4 text-primary-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">{totalScans}</div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            SAST + DAST sandboxed jobs
          </span>
        </div>

        <div className="p-5 rounded-xl bg-surface border border-border">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Average Security Score</span>
            <TrendingUp className="w-4 h-4 text-cyber-cyan" />
          </div>
          <div
            className="text-2xl font-bold font-mono"
            style={{ color: avgScore !== null ? getScoreColor(avgScore) : '#94a3b8' }}
          >
            {avgScore !== null ? `${avgScore}/100` : '--'}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Across active production targets
          </span>
        </div>

        <div className="p-5 rounded-xl bg-surface border border-border">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Remediation Engine</span>
            <Sparkles className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-indigo-300">Active</div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            One-Click Cursor / Claude prompts
          </span>
        </div>
      </div>

      {/* Target Applications Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary-400" />
            <span>Target Applications</span>
          </h2>
          <Link
            href="/scan/new"
            className="text-xs font-semibold text-primary-400 hover:text-primary-300 flex items-center gap-1"
          >
            <span>Add New Target</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs font-mono">
            Loading security targets...
          </div>
        ) : targets.length === 0 ? (
          <div className="p-12 rounded-xl bg-surface border border-dashed border-border text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">No targets registered yet</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Submit your GitHub repository, upload a project .zip, or register a live URL to run your first automated security scan.
            </p>
            <Link
              href="/scan/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-xs font-bold text-white transition-all shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Target</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {targets.map((target) => (
              <div
                key={target._id}
                className="p-5 rounded-xl bg-surface border border-border hover:border-slate-700 transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-surface-elevated text-slate-300 border border-border">
                      {target.type.replace('_', ' ')}
                    </span>

                    {target.verified ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Verified</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400">
                        <Lock className="w-3.5 h-3.5" />
                        <span>Unverified</span>
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-white truncate">{target.name}</h3>

                  {target.url && (
                    <div className="text-xs text-slate-400 truncate font-mono">
                      {target.url}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-500">
                      Security Score
                    </div>
                    <div
                      className="text-lg font-mono font-extrabold"
                      style={{
                        color:
                          target.lastScore !== null && target.lastScore !== undefined
                            ? getScoreColor(target.lastScore)
                            : '#94a3b8'
                      }}
                    >
                      {target.lastScore !== null && target.lastScore !== undefined
                        ? `${target.lastScore}/100`
                        : 'Not Scanned'}
                    </div>
                  </div>

                  <Link
                    href={`/targets`}
                    className="p-2 rounded-lg bg-surface-elevated hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
