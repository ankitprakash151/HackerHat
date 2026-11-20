'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Target } from '../../types';
import { api } from '../../lib/api';
import { VerificationModal } from '../../components/VerificationModal';
import {
  ShieldCheck,
  Plus,
  Lock,
  CheckCircle2,
  Play,
  RotateCw,
  Trash2,
  ArrowRight,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { getScoreColor, formatDate } from '../../lib/utils';
import { useDemoMode } from '../../context/DemoModeContext';

export default function TargetsPage() {
  const router = useRouter();
  const { isDemoMode } = useDemoMode();
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyingTarget, setVerifyingTarget] = useState<Target | null>(null);
  const [launchingScanId, setLaunchingScanId] = useState<string | null>(null);

  useEffect(() => {
    loadTargets();
  }, []);

  const loadTargets = async () => {
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

  const handleLaunchScan = async (target: Target) => {
    if (!target.verified && !isDemoMode) {
      setVerifyingTarget(target);
      return;
    }

    try {
      setLaunchingScanId(target._id);
      const res = await api.startScan(target._id, {
        isDemo: isDemoMode,
        isReScan: (target.scansCount || 0) > 0
      });
      router.push(`/scan/${res.scanId}`);
    } catch (err: any) {
      alert(err.message || 'Failed to start scan');
      setLaunchingScanId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this target and its scan history?')) return;
    try {
      await api.deleteTarget(id);
      setTargets(targets.filter((t) => t._id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete target');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="w-7 h-7 text-primary-400" />
            <span>Targets & Scan History</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Manage your registered applications, verification status, and historical security scores.
          </p>
        </div>

        <Link
          href="/scan/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold transition-all shadow-md self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Target</span>
        </Link>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs font-mono">
          <Loader2 className="w-6 h-6 text-primary-400 animate-spin mx-auto mb-2" />
          Loading targets...
        </div>
      ) : targets.length === 0 ? (
        <div className="p-12 rounded-xl bg-surface border border-dashed border-border text-center space-y-3">
          <h3 className="text-base font-bold text-white">No targets registered yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Add your first GitHub repository or live URL to verify ownership and run security audits.
          </p>
          <Link
            href="/scan/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-xs font-bold text-white"
          >
            <Plus className="w-4 h-4" />
            <span>Register New Target</span>
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-background text-slate-400 font-mono text-[11px] border-b border-border">
                <tr>
                  <th className="p-4">Target Name & URL</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Ownership</th>
                  <th className="p-4">Latest Score</th>
                  <th className="p-4">Scans</th>
                  <th className="p-4">Last Scanned</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {targets.map((t) => (
                  <tr key={t._id} className="hover:bg-surface-elevated/30">
                    <td className="p-4">
                      <div className="font-bold text-white">{t.name}</div>
                      {t.url && (
                        <div className="text-[11px] font-mono text-slate-400 truncate max-w-xs">
                          {t.url}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-surface-elevated text-slate-300 border border-border">
                        {t.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4">
                      {t.verified ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Verified</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => setVerifyingTarget(t)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 underline"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Verify Now</span>
                        </button>
                      )}
                    </td>
                    <td className="p-4 font-mono font-bold text-sm">
                      {t.lastScore !== null && t.lastScore !== undefined ? (
                        <span style={{ color: getScoreColor(t.lastScore) }}>
                          {t.lastScore}/100
                        </span>
                      ) : (
                        <span className="text-slate-500">--</span>
                      )}
                    </td>
                    <td className="p-4 font-mono text-slate-300">{t.scansCount || 0}</td>
                    <td className="p-4 text-slate-400">{formatDate(t.lastScanAt)}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleLaunchScan(t)}
                          disabled={launchingScanId === t._id}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold transition-all disabled:opacity-50"
                        >
                          {launchingScanId === t._id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Play className="w-3 h-3 fill-current" />
                          )}
                          <span>Re-Scan</span>
                        </button>
                        <button
                          onClick={() => handleDelete(t._id)}
                          className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Verification Modal */}
      {verifyingTarget && (
        <VerificationModal
          target={verifyingTarget}
          isOpen={true}
          onClose={() => setVerifyingTarget(null)}
          onVerified={(updated) => {
            setTargets(targets.map((t) => (t._id === updated._id ? updated : t)));
            setVerifyingTarget(null);
          }}
        />
      )}
    </div>
  );
}
