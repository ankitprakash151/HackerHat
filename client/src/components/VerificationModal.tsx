'use client';

import React, { useState, useEffect } from 'react';
import { Target } from '../types';
import { api } from '../lib/api';
import { useDemoMode } from '../context/DemoModeContext';
import {
  ShieldCheck,
  Github,
  UploadCloud,
  Globe,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  X,
  Lock,
  Zap,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface VerificationModalProps {
  target: Target;
  isOpen: boolean;
  onClose: () => void;
  onVerified: (updatedTarget: Target) => void;
}

export function VerificationModal({
  target,
  isOpen,
  onClose,
  onVerified
}: VerificationModalProps) {
  const { isDemoMode } = useDemoMode();

  const [activeTab, setActiveTab] = useState<'github' | 'zip' | 'dns'>(
    target.type === 'github_repo' ? 'github' : target.type === 'zip_archive' ? 'zip' : 'dns'
  );

  // GitHub State
  const [githubToken, setGithubToken] = useState('');
  // ZIP State
  const [zipFile, setZipFile] = useState<File | null>(null);
  // DNS / Well-known state
  const [verificationToken, setVerificationToken] = useState(target.verificationToken || '');
  const [copiedToken, setCopiedToken] = useState(false);

  // Status & Loading
  const [loading, setLoading] = useState(false);
  const [skippingDemo, setSkippingDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch token if missing for live url
  useEffect(() => {
    if (isOpen && !verificationToken && target._id) {
      api
        .getVerificationToken(target._id)
        .then((res) => {
          setVerificationToken(res.token);
        })
        .catch(() => {});
    }
  }, [isOpen, target._id, verificationToken]);

  if (!isOpen) return null;

  // Demo Bypass Action
  const handleDemoSkip = async () => {
    setSkippingDemo(true);
    setError(null);
    try {
      const res = await api.demoVerify(target._id);
      setSuccessMsg('⚡ Verification bypassed for live hackathon presentation! Target confirmed.');
      setTimeout(() => {
        onVerified({
          ...target,
          verified: true,
          verificationMethod: 'demo_bypass'
        });
      }, 700);
    } catch (err: any) {
      // Even if offline, allow client-side demo verification
      setSuccessMsg('⚡ Verification bypassed for live hackathon presentation! Target confirmed.');
      setTimeout(() => {
        onVerified({
          ...target,
          verified: true,
          verificationMethod: 'demo_bypass'
        });
      }, 700);
    } finally {
      setSkippingDemo(false);
    }
  };

  // 1. Verify GitHub
  const handleVerifyGitHub = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.verifyGitHub(target._id, target.url || '', githubToken, isDemoMode);
      if (res.verified) {
        setSuccessMsg(
          isDemoMode
            ? 'GitHub repository ownership verified (Demo Mode)!'
            : 'GitHub repository ownership verified successfully!'
        );
        setTimeout(() => {
          onVerified({ ...target, verified: true, verificationMethod: 'github_oauth' });
        }, 1000);
      }
    } catch (err: any) {
      if (isDemoMode) {
        setSuccessMsg('GitHub repository ownership verified (Demo Mode)!');
        setTimeout(() => {
          onVerified({ ...target, verified: true, verificationMethod: 'github_oauth' });
        }, 1000);
      } else {
        setError(err.message || 'GitHub verification failed');
      }
    } finally {
      setLoading(false);
    }
  };

  // 2. Verify ZIP
  const handleVerifyZip = async () => {
    if (!zipFile && !isDemoMode) {
      setError('Please select a .zip archive first');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.verifyZip(target._id, zipFile, isDemoMode);
      if (res.verified) {
        setSuccessMsg(
          `ZIP archive verified! ${res.filesExtracted || 42} files unpacked into isolated sandbox.`
        );
        setTimeout(() => {
          onVerified({ ...target, verified: true, verificationMethod: 'zip_upload' });
        }, 1000);
      }
    } catch (err: any) {
      if (isDemoMode) {
        setSuccessMsg('ZIP archive verified and extracted into sandbox (Demo Mode)!');
        setTimeout(() => {
          onVerified({ ...target, verified: true, verificationMethod: 'zip_upload' });
        }, 1000);
      } else {
        setError(err.message || 'ZIP extraction failed');
      }
    } finally {
      setLoading(false);
    }
  };

  // 3. Verify Live URL / DNS
  const handleVerifyLiveUrl = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.verifyLiveUrl(target._id, target.url || '', isDemoMode);
      if (res.verified) {
        setSuccessMsg(
          isDemoMode
            ? 'Domain ownership verified via Demo Mode bypass!'
            : 'Domain ownership successfully verified via well-known file or DNS!'
        );
        setTimeout(() => {
          onVerified({ ...target, verified: true, verificationMethod: 'dns_file' });
        }, 1000);
      } else {
        if (isDemoMode) {
          setSuccessMsg('Domain ownership verified via Demo Mode bypass!');
          setTimeout(() => {
            onVerified({ ...target, verified: true, verificationMethod: 'dns_file' });
          }, 1000);
        } else {
          setError(res.message || 'Verification token not found on target host.');
        }
      }
    } catch (err: any) {
      if (isDemoMode) {
        setSuccessMsg('Domain ownership verified via Demo Mode bypass!');
        setTimeout(() => {
          onVerified({ ...target, verified: true, verificationMethod: 'dns_file' });
        }, 1000);
      } else {
        setError(err.message || 'Verification check failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const copyTokenToClipboard = () => {
    navigator.clipboard.writeText(verificationToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl bg-surface border border-border shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-border bg-surface-elevated/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Ownership Verification Gate</span>
                {isDemoMode && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    DEMO BYPASS ACTIVE
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                Mandatory legal & security step before executing any probes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-elevated transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Demo Mode Prominent Bypass Action Bar */}
        {isDemoMode && (
          <div className="bg-gradient-to-r from-amber-950/40 via-surface-elevated to-primary-950/30 border-b border-amber-500/30 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Presenting live? Skip waiting for OAuth or DNS and jump straight to the scan!
              </span>
            </div>

            <button
              type="button"
              onClick={handleDemoSkip}
              disabled={skippingDemo}
              className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02]"
            >
              {skippingDemo ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
              ) : (
                <Zap className="w-4 h-4 fill-current text-slate-950" />
              )}
              <span>Skip Verification & Run Demo Scan</span>
            </button>
          </div>
        )}

        {/* Tab Selection */}
        <div className="flex border-b border-border bg-background px-4">
          <button
            onClick={() => {
              setActiveTab('github');
              setError(null);
            }}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'github'
                ? 'border-primary-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Github className="w-4 h-4" />
            <span>GitHub OAuth / Repo</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('zip');
              setError(null);
            }}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'zip'
                ? 'border-primary-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>ZIP Archive Upload</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('dns');
              setError(null);
            }}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'dns'
                ? 'border-primary-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Live URL /.well-known / DNS</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: GitHub Verification */}
          {activeTab === 'github' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-300">
                To verify ownership of <strong>{target.url || target.name}</strong>, provide a GitHub Personal Access Token with read access, or verify using your connected GitHub account.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  GitHub Personal Access Token (or OAuth Session)
                </label>
                <input
                  type="password"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  placeholder={
                    isDemoMode
                      ? 'ghp_demo (Auto-passes in Demo Mode)'
                      : 'ghp_xxxxxxxxxxxxxxxxxxxx'
                  }
                  className="w-full px-3.5 py-2.5 rounded-lg bg-background border border-border text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary-500"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  {isDemoMode
                    ? 'Demo Mode Active: You can click Verify to simulate instant OAuth approval.'
                    : 'Token requires `repo` read permission to verify you own this repository.'}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleVerifyGitHub}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  <span>
                    {isDemoMode ? 'Simulate GitHub Verification' : 'Verify GitHub Ownership'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: ZIP Archive Upload */}
          {activeTab === 'zip' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-300">
                Directly upload your project source code as a <code>.zip</code> file. It will be verified and safely unpacked inside an ephemeral sandbox directory.
              </p>

              <div className="border-2 border-dashed border-border hover:border-primary-500/50 rounded-xl p-6 text-center bg-background cursor-pointer transition-colors">
                <input
                  type="file"
                  accept=".zip"
                  onChange={(e) => setZipFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="zip-input"
                />
                <label htmlFor="zip-input" className="cursor-pointer">
                  <UploadCloud className="w-8 h-8 text-primary-400 mx-auto mb-2" />
                  <span className="text-xs font-bold text-white block">
                    {zipFile
                      ? zipFile.name
                      : isDemoMode
                      ? 'Select any sample ZIP or click Unpack & Verify directly'
                      : 'Click to select project .zip archive'}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Max size 50MB. Zip Slip and bomb protections active.
                  </span>
                </label>
              </div>

              <button
                onClick={handleVerifyZip}
                disabled={loading || (!zipFile && !isDemoMode)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white text-xs font-bold transition-all"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
                <span>
                  {isDemoMode ? 'Unpack & Verify Archive (Demo)' : 'Unpack & Verify Archive'}
                </span>
              </button>
            </div>
          )}

          {/* TAB 3: DNS / File Verification */}
          {activeTab === 'dns' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-300">
                To verify ownership of a live URL without executing unauthorized scans, prove control over the domain by hosting a text file or adding a DNS record.
              </p>

              <div className="p-3 rounded-lg bg-background border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-slate-400">
                    Method A: Host file at <code>/.well-known/vibeshield.txt</code>
                  </span>
                  <button
                    onClick={copyTokenToClipboard}
                    className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1 font-mono"
                  >
                    {copiedToken ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedToken ? 'Copied' : 'Copy Token'}</span>
                  </button>
                </div>
                <div className="p-2 rounded bg-surface border border-border font-mono text-xs text-amber-300 select-all break-all">
                  {verificationToken || 'Generating token...'}
                </div>
                <span className="text-[10px] text-slate-500 block">
                  Method B: Or create a DNS TXT record for <code>_vibeshield</code> with this token.
                </span>
              </div>

              <button
                onClick={handleVerifyLiveUrl}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white text-xs font-bold transition-all"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
                <span>
                  {isDemoMode
                    ? 'Check /.well-known (Demo Auto-Pass)'
                    : 'Check /.well-known/vibeshield.txt'}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
