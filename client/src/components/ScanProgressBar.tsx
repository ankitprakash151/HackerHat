'use client';

import React, { useState } from 'react';
import { Scan } from '../types';
import {
  CheckCircle2,
  Loader2,
  Clock,
  Terminal,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Cpu,
  KeyRound,
  FileCode2,
  Container,
  Calculator,
  Lock
} from 'lucide-react';

interface ScanProgressBarProps {
  scan: Scan;
}

export function ScanProgressBar({ scan }: ScanProgressBarProps) {
  const [showLogs, setShowLogs] = useState(false);

  const isCompleted = scan.status === 'COMPLETED';
  const isFailed = scan.status === 'FAILED';
  const progress = scan.progress || 0;

  // Derive status for the 5 requested stages
  const getStageStatus = (stageIndex: number) => {
    if (isCompleted) return 'completed';
    if (isFailed) return 'failed';

    switch (stageIndex) {
      case 1: // Ownership Gate
        return progress >= 15 ? 'completed' : 'running';
      case 2: // Gitleaks
        if (progress < 25) return 'pending';
        if (progress < 50) return 'running';
        return 'completed';
      case 3: // Semgrep
        if (progress < 50) return 'pending';
        if (progress < 70) return 'running';
        return 'completed';
      case 4: // Docker ZAP Sandbox
        if (progress < 70) return 'pending';
        if (progress < 90) return 'running';
        return 'completed';
      case 5: // VibeShield Score
        if (progress < 90) return 'pending';
        return 'running';
      default:
        return 'pending';
    }
  };

  const stages = [
    {
      id: 'ownership',
      number: 1,
      title: 'Target Ownership',
      subtitle: 'Verifying target ownership... (Passed)',
      tool: 'Cryptographic Gate',
      icon: Lock,
      status: getStageStatus(1)
    },
    {
      id: 'gitleaks',
      number: 2,
      title: 'Secrets Detection',
      subtitle: 'Running Gitleaks secret detection...',
      tool: 'Gitleaks Engine',
      icon: KeyRound,
      status: getStageStatus(2)
    },
    {
      id: 'semgrep',
      number: 3,
      title: 'Static Analysis',
      subtitle: 'Running Semgrep static code analysis...',
      tool: 'Semgrep AST Scanner',
      icon: FileCode2,
      status: getStageStatus(3)
    },
    {
      id: 'zap',
      number: 4,
      title: 'Dynamic Sandbox',
      subtitle: 'Spinning up isolated Docker sandbox & OWASP ZAP probe...',
      tool: 'OWASP ZAP (512MB RAM)',
      icon: Container,
      status: getStageStatus(4)
    },
    {
      id: 'scoring',
      number: 5,
      title: 'Security Score',
      subtitle: 'Calculating VibeShield Security Score...',
      tool: 'AI Prompt Synthesizer',
      icon: Calculator,
      status: getStageStatus(5)
    }
  ];

  return (
    <div className="p-6 rounded-2xl bg-surface border border-border space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-primary-400" />
              <span>Automated 5-Stage Security Pipeline</span>
            </h2>
            <span
              className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                isCompleted
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : isFailed
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  : 'bg-primary-500/10 text-primary-400 border-primary-500/30 animate-pulse'
              }`}
            >
              {scan.status}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Running isolated ownership verification, secret detection, SAST, and DAST sandbox probes
          </p>
        </div>

        {scan.durationSeconds !== undefined && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-background px-3 py-1.5 rounded-md border border-border self-start sm:self-auto font-mono">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Duration: {scan.durationSeconds}s</span>
          </div>
        )}
      </div>

      {/* Main Overall Progress Bar */}
      <div>
        <div className="flex justify-between text-xs font-mono text-slate-400 mb-1.5">
          <span>Overall Pipeline Progress</span>
          <span className="font-bold text-white">{scan.progress}%</span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-background overflow-hidden border border-border">
          <div
            className="h-full bg-gradient-to-r from-primary-600 via-amber-400 to-emerald-400 transition-all duration-700 ease-out"
            style={{ width: `${scan.progress}%` }}
          />
        </div>
      </div>

      {/* 5-Stage Pipeline Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {stages.map((stage) => {
          const isDone = stage.status === 'completed';
          const isRunning = stage.status === 'running';
          const isPending = stage.status === 'pending';
          const StageIcon = stage.icon;

          return (
            <div
              key={stage.id}
              className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                isRunning
                  ? 'bg-primary-950/30 border-primary-500/60 shadow-lg shadow-primary-500/10 ring-1 ring-primary-500/40 scale-[1.02]'
                  : isDone
                  ? 'bg-surface-elevated/40 border-emerald-500/30'
                  : 'bg-surface-elevated/10 border-border opacity-60'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-5 h-5 rounded-full text-[10px] font-mono font-bold flex items-center justify-center ${
                        isDone
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : isRunning
                          ? 'bg-primary-500 text-white animate-pulse'
                          : 'bg-border text-slate-400'
                      }`}
                    >
                      {stage.number}
                    </span>
                    <StageIcon
                      className={`w-3.5 h-3.5 ${
                        isRunning
                          ? 'text-primary-400'
                          : isDone
                          ? 'text-emerald-400'
                          : 'text-slate-500'
                      }`}
                    />
                  </div>

                  {isRunning ? (
                    <Loader2 className="w-3.5 h-3.5 text-primary-400 animate-spin" />
                  ) : isDone ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <span className="text-[10px] font-mono text-slate-500">Queued</span>
                  )}
                </div>

                <div>
                  <h4 className="text-xs font-bold text-white tracking-tight">{stage.title}</h4>
                  <div className="text-[10px] font-mono text-primary-300/80">{stage.tool}</div>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 mt-2 leading-tight">
                {isDone
                  ? stage.id === 'ownership'
                    ? 'Verified (Passed)'
                    : 'Analysis complete'
                  : isRunning
                  ? stage.subtitle
                  : 'Awaiting previous stage'}
              </p>
            </div>
          );
        })}
      </div>

      {/* Expandable Live Execution Logs */}
      <div className="border-t border-border pt-4">
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="flex items-center justify-between w-full text-xs font-mono text-slate-400 hover:text-white transition-colors"
        >
          <span className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-primary-400" />
            <span>Live Security Engine Logs ({scan.logMessages?.length || 0} events)</span>
          </span>
          {showLogs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showLogs && (
          <div className="mt-3 p-3 rounded-lg bg-background border border-border font-mono text-xs max-h-56 overflow-y-auto space-y-1">
            {scan.logMessages && scan.logMessages.length > 0 ? (
              scan.logMessages.map((log, i) => (
                <div key={i} className="flex items-start gap-2 text-slate-300">
                  <span className="text-slate-500 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span
                    className={`text-[10px] uppercase font-bold px-1 rounded ${
                      log.level === 'error'
                        ? 'bg-rose-500/20 text-rose-400'
                        : log.level === 'warn'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-primary-500/20 text-primary-300'
                    }`}
                  >
                    {log.stage}
                  </span>
                  <span className="break-all">{log.message}</span>
                </div>
              ))
            ) : (
              <div className="text-slate-500 text-center py-2">No log output yet...</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
