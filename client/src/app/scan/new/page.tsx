'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Target, TargetType } from '../../../types';
import { api } from '../../../lib/api';
import { VerificationModal } from '../../../components/VerificationModal';
import { useDemoMode } from '../../../context/DemoModeContext';
import {
  ShieldCheck,
  Github,
  Globe,
  UploadCloud,
  Lock,
  CheckCircle2,
  AlertCircle,
  Play,
  Loader2,
  Zap,
  Sparkles,
  ArrowRight
} from 'lucide-react';

export default function NewScanPage() {
  const router = useRouter();
  const { isDemoMode } = useDemoMode();

  const [targetType, setTargetType] = useState<TargetType>('github_repo');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');

  // Target and verification state
  const [currentTarget, setCurrentTarget] = useState<Target | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [launchingScan, setLaunchingScan] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Register or select target
  const handleRegisterTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let targetPayloadUrl = url;
      if (targetType === 'zip_archive') {
        targetPayloadUrl = '';
      }

      const target = await api.createTarget({
        type: targetType,
        name: name || (targetType === 'zip_archive' ? 'ZIP Source Code Archive' : undefined),
        url: targetPayloadUrl
      });

      setCurrentTarget(target);
      // Automatically prompt ownership verification gate so judges see how it works
      setIsVerifying(true);
    } catch (err: any) {
      setError(err.message || 'Failed to create target');
    } finally {
      setLoading(false);
    }
  };

  // Quick Demo Auto-Fill helper
  const handleLoadSample = (sampleType: TargetType) => {
    setTargetType(sampleType);
    setCurrentTarget(null);
    if (sampleType === 'github_repo') {
      setUrl('https://github.com/vibe-org/ecommerce-cursor-app');
      setName('E-Commerce Cursor App (Demo)');
    } else if (sampleType === 'live_url') {
      setUrl('https://vibe-shop-preview.vercel.app');
      setName('VibeShop Production Preview');
    } else {
      setUrl('');
      setName('Vibe-Stack-Archive.zip');
    }
  };

  // 2. Launch the scan once verified
  const handleLaunchScan = async (overrideTargetId?: string) => {
    const targetId = overrideTargetId || currentTarget?._id;
    if (!targetId) return;

    if (!isDemoMode && (!currentTarget || !currentTarget.verified)) {
      setError('Cannot initiate scan: Target ownership must be verified first.');
      return;
    }

    setLaunchingScan(true);
    setError(null);

    try {
      const res = await api.startScan(targetId, { isDemo: isDemoMode });
      router.push(`/scan/${res.scanId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to start scan');
      setLaunchingScan(false);
    }
  };

  // Direct Skip & Run Demo Scan
  const handleDirectDemoScan = async () => {
    if (!currentTarget) return;
    setLaunchingScan(true);
    setError(null);

    try {
      await api.demoVerify(currentTarget._id);
      const res = await api.startScan(currentTarget._id, { isDemo: true });
      router.push(`/scan/${res.scanId}`);
    } catch (err: any) {
      // Fallback
      try {
        const res = await api.startScan(currentTarget._id, { isDemo: true });
        router.push(`/scan/${res.scanId}`);
      } catch (innerErr: any) {
        setError(innerErr.message || 'Failed to start demo scan');
        setLaunchingScan(false);
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="w-7 h-7 text-primary-400" />
            <span>New Security Audit</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Submit your application to run automated Semgrep (SAST), Gitleaks (Secrets), and OWASP ZAP (DAST) scans.
          </p>
        </div>

        {isDemoMode && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold self-start sm:self-auto">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Demo Mode Active</span>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Target Registration Card */}
      <div className="p-6 rounded-2xl bg-surface border border-border space-y-6">
        {/* Step 1: Target Type Selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              Step 1: Select Application Target Type
            </label>
            {isDemoMode && (
              <span className="text-[11px] text-amber-400/90 font-mono">
                Click any tab or sample to test
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => {
                setTargetType('github_repo');
                setCurrentTarget(null);
              }}
              className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                targetType === 'github_repo'
                  ? 'bg-primary-950/30 border-primary-500 text-white shadow-md shadow-primary-500/10'
                  : 'bg-background border-border text-slate-400 hover:text-slate-200'
              }`}
            >
              <Github className="w-5 h-5 text-primary-400 mb-2" />
              <div>
                <span className="text-xs font-bold block text-white">GitHub Repo</span>
                <span className="text-[11px] text-slate-500">Repository URL</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setTargetType('zip_archive');
                setCurrentTarget(null);
              }}
              className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                targetType === 'zip_archive'
                  ? 'bg-primary-950/30 border-primary-500 text-white shadow-md shadow-primary-500/10'
                  : 'bg-background border-border text-slate-400 hover:text-slate-200'
              }`}
            >
              <UploadCloud className="w-5 h-5 text-primary-400 mb-2" />
              <div>
                <span className="text-xs font-bold block text-white">ZIP Archive</span>
                <span className="text-[11px] text-slate-500">Source code upload</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setTargetType('live_url');
                setCurrentTarget(null);
              }}
              className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                targetType === 'live_url'
                  ? 'bg-primary-950/30 border-primary-500 text-white shadow-md shadow-primary-500/10'
                  : 'bg-background border-border text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="w-5 h-5 text-primary-400 mb-2" />
              <div>
                <span className="text-xs font-bold block text-white">Live Website</span>
                <span className="text-[11px] text-slate-500">Production URL</span>
              </div>
            </button>
          </div>
        </div>

        {/* Step 2: URL or Name Input */}
        <form onSubmit={handleRegisterTarget} className="space-y-4">
          {targetType !== 'zip_archive' ? (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  {targetType === 'github_repo' ? 'GitHub Repository URL' : 'Live Website URL'}
                </label>
                {isDemoMode && (
                  <button
                    type="button"
                    onClick={() => handleLoadSample(targetType)}
                    className="text-[11px] text-amber-400 hover:text-amber-300 font-mono underline"
                  >
                    Load Sample Target
                  </button>
                )}
              </div>
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={
                  targetType === 'github_repo'
                    ? 'https://github.com/my-org/my-vibe-app'
                    : 'https://my-vibe-app.vercel.app'
                }
                className="w-full px-3.5 py-2.5 rounded-lg bg-background border border-border text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary-500 font-mono"
              />
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  Target Project Name
                </label>
                {isDemoMode && (
                  <button
                    type="button"
                    onClick={() => handleLoadSample('zip_archive')}
                    className="text-[11px] text-amber-400 hover:text-amber-300 font-mono underline"
                  >
                    Load Sample Target
                  </button>
                )}
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. My Next.js Web App"
                className="w-full px-3.5 py-2.5 rounded-lg bg-background border border-border text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary-500"
              />
            </div>
          )}

          {!currentTarget && (
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-primary-600/20"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
              <span>Proceed to Ownership Verification Gate</span>
            </button>
          )}
        </form>

        {/* Step 3: Verification Gate Status */}
        {currentTarget && (
          <div className="pt-4 border-t border-border space-y-4 animate-in fade-in">
            <div className="p-4 rounded-xl bg-background border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500">
                  Target Registered
                </div>
                <div className="text-sm font-bold text-white break-all">
                  {currentTarget.name || currentTarget.url}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {currentTarget.verified ? (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Ownership Verified</span>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsVerifying(true)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-border text-xs font-bold transition-all"
                    >
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                      <span>Inspect Verification Gate</span>
                    </button>

                    {isDemoMode && (
                      <button
                        type="button"
                        onClick={handleDirectDemoScan}
                        disabled={launchingScan}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-extrabold shadow-md transition-all hover:scale-[1.02]"
                      >
                        {launchingScan ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-950" />
                        ) : (
                          <Zap className="w-3.5 h-3.5 fill-current text-slate-950" />
                        )}
                        <span>Skip Verification & Run Demo Scan</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Launch Scan CTA */}
            {currentTarget.verified ? (
              <button
                type="button"
                onClick={() => handleLaunchScan()}
                disabled={launchingScan}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-extrabold shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.01]"
              >
                {launchingScan ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 fill-current" />
                )}
                <span>
                  {isDemoMode
                    ? 'Launch Isolated Security Scan (Demo Pipeline 7s)'
                    : 'Launch Isolated Security Scan'}
                </span>
              </button>
            ) : (
              !isDemoMode && (
                <div className="p-3.5 rounded-lg bg-surface-elevated/40 border border-border text-[11px] text-slate-400 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    The scanning engine is locked until domain or repository ownership is verified.
                  </span>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Verification Modal */}
      {currentTarget && (
        <VerificationModal
          target={currentTarget}
          isOpen={isVerifying}
          onClose={() => setIsVerifying(false)}
          onVerified={(updated) => {
            setCurrentTarget(updated);
            setIsVerifying(false);
          }}
        />
      )}
    </div>
  );
}
