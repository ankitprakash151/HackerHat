import React from 'react';
import { Severity } from '../types';
import { getSeverityBadgeClass } from '../lib/utils';
import { ShieldAlert, AlertTriangle, Info, AlertCircle } from 'lucide-react';

interface SeverityBadgeProps {
  severity: Severity;
  showIcon?: boolean;
  className?: string;
}

export function SeverityBadge({ severity, showIcon = true, className = '' }: SeverityBadgeProps) {
  const badgeClass = getSeverityBadgeClass(severity);

  const renderIcon = () => {
    switch (severity) {
      case 'CRITICAL':
        return <ShieldAlert className="w-3.5 h-3.5" />;
      case 'HIGH':
        return <AlertTriangle className="w-3.5 h-3.5" />;
      case 'MEDIUM':
        return <AlertCircle className="w-3.5 h-3.5" />;
      case 'LOW':
      case 'INFO':
      default:
        return <Info className="w-3.5 h-3.5" />;
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${badgeClass} ${className}`}
    >
      {showIcon && renderIcon()}
      <span>{severity}</span>
    </span>
  );
}
