'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Plus, History, Sparkles } from 'lucide-react';
import { useDemoMode } from '../context/DemoModeContext';

export function Navbar() {
  const { isDemoMode, toggleDemoMode } = useDemoMode();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-lg bg-primary-600/20 border border-primary-500/30 flex items-center justify-center text-primary-400 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5 h-5 text-primary-400" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-white flex items-center gap-1.5">
                VibeShield
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary-500/20 text-primary-300 border border-primary-500/30">
                  AppSec
                </span>
              </span>
              <p className="text-[10px] text-slate-400 hidden sm:block -mt-1 font-mono">
                Automated Scanner for Vibe-Coded Apps
              </p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-slate-300">
            <Link
              href="/"
              className="px-3 py-1.5 rounded-md hover:text-white hover:bg-surface transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/targets"
              className="px-3 py-1.5 rounded-md hover:text-white hover:bg-surface transition-colors flex items-center gap-1.5"
            >
              <History className="w-4 h-4 text-slate-400" />
              Targets & Scans
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {/* Engine Active Indicator */}
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-surface border border-border text-xs text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>SAST / DAST Engine Active</span>
          </div>

          {/* Demo Mode Toggle Switch */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
              isDemoMode
                ? 'bg-amber-500/10 border-amber-500/30 shadow-sm shadow-amber-500/10'
                : 'bg-surface border-border text-slate-400'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Sparkles
                className={`w-3.5 h-3.5 transition-colors ${
                  isDemoMode ? 'text-amber-400 animate-pulse' : 'text-slate-500'
                }`}
              />
              <span
                className={`text-xs font-bold tracking-tight select-none ${
                  isDemoMode ? 'text-amber-300' : 'text-slate-400'
                }`}
              >
                Demo Mode
              </span>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={isDemoMode}
              onClick={toggleDemoMode}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isDemoMode ? 'bg-amber-500' : 'bg-slate-700'
              }`}
              title={
                isDemoMode
                  ? 'Demo Mode is ON: instant verification bypass & fast 7s simulated scan'
                  : 'Demo Mode is OFF: strict ownership verification & external scanner tools required'
              }
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  isDemoMode ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>

            <span
              className={`text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded select-none ${
                isDemoMode
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-slate-800 text-slate-500 border border-slate-700'
              }`}
            >
              {isDemoMode ? 'ON' : 'OFF'}
            </span>
          </div>

          <Link
            href="/scan/new"
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold shadow-lg shadow-primary-600/20 transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            <span>New Scan</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
