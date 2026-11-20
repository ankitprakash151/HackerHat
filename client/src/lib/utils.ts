import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Severity } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getSeverityBadgeClass(severity: Severity) {
  switch (severity) {
    case 'CRITICAL':
      return 'bg-red-500/10 text-red-400 border-red-500/30';
    case 'HIGH':
      return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
    case 'MEDIUM':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    case 'LOW':
      return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
    case 'INFO':
    default:
      return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
  }
}

export function getScoreColor(score: number) {
  if (score >= 90) return '#10b981'; // Emerald
  if (score >= 70) return '#3b82f6'; // Blue
  if (score >= 50) return '#f59e0b'; // Amber
  return '#ef4444'; // Red
}

export function formatDate(dateStr?: string) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
