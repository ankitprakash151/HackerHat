'use client';

import React, { useState } from 'react';
import { Finding } from '../types';
import { Copy, Check, X, Sparkles, Terminal, FileCode } from 'lucide-react';

interface AiFixPromptModalProps {
  finding: Finding | null;
  onClose: () => void;
}

export function AiFixPromptModal({ finding, onClose }: AiFixPromptModalProps) {
  const [copied, setCopied] = useState(false);

  if (!finding) return null;

  const promptText = finding.aiPrompt?.formattedPrompt || '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = promptText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl rounded-2xl bg-surface border border-border shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-surface-elevated/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary-600/20 border border-primary-500/30 flex items-center justify-center text-primary-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                One-Click AI Remediation Prompt
              </h3>
              <p className="text-xs text-slate-400">
                Paste directly into Cursor, Claude, ChatGPT, or Lovable
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

        {/* Target Details Badge Bar */}
        <div className="px-5 py-2.5 bg-background border-b border-border flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <FileCode className="w-3.5 h-3.5 text-primary-400" />
            <span>Target: {finding.location?.file || 'Configuration'}</span>
            {finding.location?.startLine && <span>(Line {finding.location.startLine})</span>}
          </div>
          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-primary-500/10 text-primary-400 border border-primary-500/20">
            {finding.severity} Severity
          </span>
        </div>

        {/* Prompt Content */}
        <div className="p-5 overflow-y-auto flex-1 font-mono text-xs text-slate-200 bg-background/50">
          <pre className="whitespace-pre-wrap leading-relaxed select-all">
            {promptText}
          </pre>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border bg-surface-elevated/40 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-400 hidden sm:inline">
            Secrets are automatically redacted for safe AI prompt usage.
          </span>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-surface-elevated transition-colors"
            >
              Close
            </button>

            <button
              onClick={handleCopy}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all shadow-md ${
                copied
                  ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                  : 'bg-primary-600 hover:bg-primary-500 text-white shadow-primary-600/20 hover:scale-[1.02]'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Prompt</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
