export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type Category =
  | 'SECRETS'
  | 'AUTH_BYPASS'
  | 'CRYPTO'
  | 'INJECTION'
  | 'HEADERS'
  | 'EXPOSED_FILES'
  | 'MISCONFIG';

export type TargetType = 'github_repo' | 'live_url' | 'zip_archive';

export type VerificationMethod = 'github_oauth' | 'zip_upload' | 'dns_file' | 'demo_bypass' | null;

export type ScanStatus =
  | 'QUEUED'
  | 'STAGE_1_SAST'
  | 'STAGE_2_DAST'
  | 'ANALYZING'
  | 'COMPLETED'
  | 'FAILED';

export interface Target {
  _id: string;
  type: TargetType;
  name: string;
  url?: string;
  verified: boolean;
  verificationMethod?: VerificationMethod;
  verificationToken?: string;
  verifiedAt?: string;
  lastScore?: number | null;
  lastScanAt?: string;
  scansCount: number;
  metadata?: {
    framework?: string;
    gitBranch?: string;
    fileCount?: number;
    owner?: string;
  };
  createdAt: string;
}

export interface ScanStage {
  status: 'pending' | 'running' | 'completed' | 'skipped' | 'failed';
  progress: number;
  tool: string;
  findingsCount: number;
  message: string;
  error?: string;
}

export interface ScanLogMessage {
  timestamp: string;
  stage: string;
  message: string;
  level: 'info' | 'warn' | 'error';
}

export interface Scan {
  _id: string;
  targetId: string;
  targetUrl?: string;
  targetType?: string;
  status: ScanStatus;
  currentStage: 'init' | 'sast' | 'dast' | 'analysis' | 'done' | 'failed';
  progress: number;
  stageProgress: {
    sast: ScanStage;
    dast: ScanStage;
  };
  score: number | null;
  scoreDelta: number | null;
  previousScanId?: string | null;
  isDemo?: boolean;
  summary: {
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    infoCount: number;
    totalCount: number;
  };
  logMessages: ScanLogMessage[];
  startedAt?: string;
  completedAt?: string;
  durationSeconds?: number;
  error?: string;
  createdAt: string;
}

export interface AiPrompt {
  role: string;
  targetFile?: string;
  lineNumber?: number;
  vulnerableCode?: string;
  instructions: string;
  formattedPrompt: string;
}

export interface Finding {
  _id: string;
  scanId: string;
  targetId: string;
  tool: 'semgrep' | 'gitleaks' | 'zap' | 'inspector';
  ruleId: string;
  title: string;
  severity: Severity;
  category: Category;
  cwe?: string;
  owasp?: string;
  plainEnglish: {
    whatItIs: string;
    whyItMatters: string;
    howToFix: string;
  };
  aiPrompt: AiPrompt;
  location?: {
    file?: string;
    startLine?: number;
    endLine?: number;
    column?: number;
    url?: string;
    parameter?: string;
    evidence?: string;
  };
  status: 'OPEN' | 'FIXED' | 'FALSE_POSITIVE' | 'IGNORED';
  createdAt: string;
}

export interface BeforeAfterComparisonData {
  targetId: string;
  currentScan: {
    id: string;
    score: number;
    completedAt: string;
    summary: Scan['summary'];
  };
  previousScan?: {
    id: string;
    score: number;
    completedAt: string;
    summary: Scan['summary'];
  } | null;
  delta: number | null;
  resolvedCount: number;
  resolvedFindings: Finding[];
  newFindingsCount: number;
  newFindings: Finding[];
}

export interface Report {
  _id: string;
  scanId: string;
  targetId: string;
  targetName: string;
  score: number;
  grade: string;
  scoreDelta?: number | null;
  executiveSummary: string;
  disclaimer: string;
  findingsBreakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    total: number;
  };
  categoryBreakdown: {
    secrets: number;
    auth: number;
    crypto: number;
    injection: number;
    headers: number;
    exposedFiles: number;
    misconfig: number;
  };
  pdfPath?: string;
  pdfUrl?: string;
}
