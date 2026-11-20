'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Scan, Finding, Report, BeforeAfterComparisonData, Target } from '../../../types';
import { api } from '../../../lib/api';
import { useDemoMode } from '../../../context/DemoModeContext';
import { ScanProgressBar } from '../../../components/ScanProgressBar';
import { ScoreGauge } from '../../../components/ScoreGauge';
import { FindingCard } from '../../../components/FindingCard';
import { AiFixPromptModal } from '../../../components/AiFixPromptModal';
import { BeforeAfterComparison } from '../../../components/BeforeAfterComparison';
import { PdfReportView } from '../../../components/PdfReportView';
import {
  ShieldCheck,
  Download,
  Sparkles,
  Filter,
  Check,
  Copy,
  FileText,
  LayoutDashboard,
  AlertTriangle,
  RotateCw,
  Loader2,
  Zap
} from 'lucide-react';

export default function ScanReportPage() {
  const params = useParams();
  const router = useRouter();
  const scanId = params.id as string;
  const { isDemoMode } = useDemoMode();

  const [scan, setScan] = useState<Scan | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [comparison, setComparison] = useState<BeforeAfterComparisonData | null>(null);

  const [activeTab, setActiveTab] = useState<'overview' | 'findings' | 'pdf'>('overview');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedFindingForPrompt, setSelectedFindingForPrompt] = useState<Finding | null>(null);

  const [copiedMasterPrompt, setCopiedMasterPrompt] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reScanning, setReScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Poll scan status until complete
  useEffect(() => {
    if (!scanId) return;

    const fetchScanData = async () => {
      try {
        const scanData = await api.getScanStatus(scanId);
        setScan(scanData);

        // Fetch target info
        if (scanData.targetId && !target) {
          api
            .getTarget(scanData.targetId)
            .then((res) => setTarget(res.target))
            .catch(() => {});
        }

        // If completed or failed, stop polling and load findings & report
        if (scanData.status === 'COMPLETED') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          loadCompletedDetails(scanId);
        } else if (scanData.status === 'FAILED') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setError(scanData.error || 'Scan failed to complete');
        }
      } catch (err: any) {
        setError(err.message || 'Error fetching scan status');
      } finally {
        setLoading(false);
      }
    };

    fetchScanData();
    // Fast 800ms polling in demo mode for smooth 5-stage progress animation
    pollIntervalRef.current = setInterval(fetchScanData, isDemoMode ? 800 : 2000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [scanId, isDemoMode]);

  const loadCompletedDetails = async (id: string) => {
    try {
      const [findingsData, reportData, comparisonData] = await Promise.all([
        api.getScanFindings(id),
        api.getReport(id).catch(() => null),
        api.getComparison(id).catch(() => null)
      ]);

      setFindings(findingsData.findings);
      if (reportData) setReport(reportData);
      if (comparisonData) setComparison(comparisonData);
    } catch (err) {
      console.error('Failed to load completed scan details:', err);
    }
  };

  const handleCopyMasterPrompt = async () => {
    try {
      const bundle = await api.getPromptBundle(scanId);
      await navigator.clipboard.writeText(bundle.bundleMarkdown);
      setCopiedMasterPrompt(true);
      setTimeout(() => setCopiedMasterPrompt(false), 2500);
    } catch (err) {
      console.error('Error copying master prompt bundle:', err);
    }
  };

  const handleReScan = async () => {
    if (!scan?.targetId) return;
    setReScanning(true);
    try {
      const res = await api.startScan(scan.targetId, {
        isDemo: isDemoMode,
        isReScan: true
      });
      router.push(`/scan/${res.scanId}`);
    } catch (err: any) {
      alert(err.message || 'Failed to start re-scan');
      setReScanning(false);
    }
  };

  if (loading && !scan) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-center">
        <Loader2 className="w-8 h-8 text-primary-400 animate-spin mb-3" />
        <span className="text-xs font-mono text-slate-400">Loading scan session...</span>
      </div>
    );
  }

  if (error && !scan) {
    return (
      <div className="p-8 rounded-2xl bg-surface border border-rose-500/30 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
        <h2 className="text-lg font-bold text-white">Scan Session Error</h2>
        <p className="text-xs text-rose-300 max-w-md mx-auto">{error}</p>
      </div>
    );
  }

  if (!scan) return null;

  const filteredFindings =
    selectedSeverity === 'ALL'
      ? findings
      : findings.filter((f) => f.severity === selectedSeverity);

  return (
    <div className="space-y-6">
      {/* Target & Scan Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mb-1">
            <span>TARGET: {scan.targetType?.toUpperCase() || 'APPLICATION'}</span>
            <span>•</span>
            <span>SCAN ID: {scan._id.slice(0, 10)}</span>
            {isDemoMode && (
              <>
                <span>•</span>
                <span className="text-amber-400 font-bold">DEMO FLOW</span>
              </>
            )}
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight break-all">
            {target?.name || scan.targetUrl || 'Audited Target'}
          </h1>
        </div>

        {scan.status === 'COMPLETED' && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Re-Scan / Before & After Demo Flow Button */}
            <button
              onClick={handleReScan}
              disabled={reScanning}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-xs font-bold text-emerald-300 border border-emerald-500/40 transition-all shadow-sm hover:scale-[1.02]"
              title="Simulate that AI fixes were applied and re-scan to show 45 -> 95 score improvement!"
            >
              {reScanning ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RotateCw className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>Re-Scan Target (Demonstrate Fixes)</span>
            </button>

            <button
              onClick={handleCopyMasterPrompt}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface-elevated hover:bg-slate-700 text-xs font-bold text-indigo-300 border border-indigo-500/30 transition-all shadow-sm"
            >
              {copiedMasterPrompt ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Master Fix Prompt Copied!</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-primary-400" />
                  <span>Copy Master AI Fix Plan</span>
                </>
              )}
            </button>

            <a
              href={api.getReportDownloadUrl(scan._id)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-xs font-bold text-white transition-all shadow-md shadow-primary-600/20"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export PDF Report</span>
            </a>
          </div>
        )}
      </div>

      {/* Live Scan 5-Stage Multi-Stage Progress Bar */}
      <ScanProgressBar scan={scan} />

      {/* Tabs navigation for completed scan */}
      {scan.status === 'COMPLETED' && (
        <div className="space-y-6">
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all ${
                activeTab === 'overview'
                  ? 'border-primary-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Score & Overview</span>
            </button>

            <button
              onClick={() => setActiveTab('findings')}
              className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all ${
                activeTab === 'findings'
                  ? 'border-primary-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Vulnerabilities & AI Prompts ({findings.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('pdf')}
              className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all ${
                activeTab === 'pdf'
                  ? 'border-primary-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Downloadable PDF Preview</span>
            </button>
          </div>

          {/* TAB 1: Score & Overview */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Score Gauge Card */}
                <div className="p-6 rounded-2xl bg-surface border border-border flex flex-col items-center justify-center">
                  <ScoreGauge
                    score={scan.score}
                    grade={report?.grade || (scan.score && scan.score >= 90 ? 'A+' : 'F')}
                    scoreDelta={scan.scoreDelta}
                  />
                </div>

                {/* Executive Narrative & Findings Counts */}
                <div className="lg:col-span-2 p-6 rounded-2xl bg-surface border border-border flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                      Executive Security Assessment
                    </span>
                    <h3 className="text-base font-bold text-white">
                      {report?.executiveSummary ||
                        'Scan completed with automated vulnerability analysis and copy-paste remediation prompts.'}
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-border">
                    <div className="p-3 rounded-lg bg-background border border-red-500/20 text-center">
                      <div className="text-xl font-bold font-mono text-red-400">
                        {scan.summary?.criticalCount || 0}
                      </div>
                      <div className="text-[10px] uppercase font-bold text-slate-400">Critical</div>
                    </div>
                    <div className="p-3 rounded-lg bg-background border border-orange-500/20 text-center">
                      <div className="text-xl font-bold font-mono text-orange-400">
                        {scan.summary?.highCount || 0}
                      </div>
                      <div className="text-[10px] uppercase font-bold text-slate-400">High</div>
                    </div>
                    <div className="p-3 rounded-lg bg-background border border-amber-500/20 text-center">
                      <div className="text-xl font-bold font-mono text-amber-400">
                        {scan.summary?.mediumCount || 0}
                      </div>
                      <div className="text-[10px] uppercase font-bold text-slate-400">Medium</div>
                    </div>
                    <div className="p-3 rounded-lg bg-background border border-sky-500/20 text-center">
                      <div className="text-xl font-bold font-mono text-sky-400">
                        {scan.summary?.lowCount || 0}
                      </div>
                      <div className="text-[10px] uppercase font-bold text-slate-400">Low / Info</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Before & After Delta Card */}
              <BeforeAfterComparison data={comparison} />
            </div>
          )}

          {/* TAB 2: Vulnerabilities & AI Prompts */}
          {activeTab === 'findings' && (
            <div className="space-y-4">
              {/* Severity Filter Pills */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-400 flex items-center gap-1 mr-2">
                  <Filter className="w-3.5 h-3.5" />
                  <span>Severity:</span>
                </span>
                {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setSelectedSeverity(sev)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                      selectedSeverity === sev
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'bg-surface border border-border text-slate-400 hover:text-white'
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>

              {/* Findings Cards */}
              <div className="space-y-3">
                {filteredFindings.length > 0 ? (
                  filteredFindings.map((finding) => (
                    <FindingCard
                      key={finding._id}
                      finding={finding}
                      onOpenAiPrompt={(f) => setSelectedFindingForPrompt(f)}
                    />
                  ))
                ) : (
                  <div className="p-12 text-center rounded-xl bg-surface border border-border text-slate-400 text-xs">
                    No findings match the selected filter.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: PDF Preview */}
          {activeTab === 'pdf' && target && (
            <PdfReportView
              report={report}
              target={target}
              scan={scan}
              findings={findings}
            />
          )}
        </div>
      )}

      {/* AI Fix Prompt Modal */}
      <AiFixPromptModal
        finding={selectedFindingForPrompt}
        onClose={() => setSelectedFindingForPrompt(null)}
      />
    </div>
  );
}
