import { Target, Scan, Finding, Report, BeforeAfterComparisonData } from '../types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  // If body is FormData, delete Content-Type to allow browser boundary setting
  if (options.body instanceof FormData) {
    delete (headers as Record<string, string>)['Content-Type'];
  }

  const res = await fetch(url, {
    ...options,
    headers
  });

  if (!res.ok) {
    let errorMsg = `Request failed with status ${res.status}`;
    try {
      const data = await res.json();
      if (data.error) errorMsg = data.error;
    } catch {}
    throw new Error(errorMsg);
  }

  return res.json() as Promise<T>;
}

export const api = {
  // Target Operations
  async listTargets(): Promise<Target[]> {
    return request<Target[]>('/targets');
  },

  async createTarget(data: { type: string; name?: string; url?: string }): Promise<Target> {
    return request<Target>('/targets', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async getTarget(id: string): Promise<{ target: Target; scans: Scan[]; latestScan: Scan | null }> {
    return request<{ target: Target; scans: Scan[]; latestScan: Scan | null }>(`/targets/${id}`);
  },

  async deleteTarget(id: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/targets/${id}`, {
      method: 'DELETE'
    });
  },

  // Ownership Verification Operations
  async getVerificationToken(targetId: string): Promise<{
    token: string;
    wellKnownPath: string;
    expectedFileContent: string;
    dnsRecordName: string;
    dnsRecordValue: string;
  }> {
    return request('/verify/token', {
      method: 'POST',
      body: JSON.stringify({ targetId })
    });
  },

  async verifyGitHub(
    targetId: string,
    repoUrl: string,
    token?: string,
    isDemo?: boolean
  ): Promise<{ success: boolean; verified: boolean; message?: string }> {
    return request('/verify/github', {
      method: 'POST',
      body: JSON.stringify({ targetId, repoUrl, userAccessToken: token, isDemo })
    });
  },

  async verifyZip(
    targetId: string,
    file?: File | null,
    isDemo?: boolean
  ): Promise<{ success: boolean; verified: boolean; filesExtracted: number; message?: string }> {
    if (isDemo || !file) {
      return request('/verify/zip', {
        method: 'POST',
        body: JSON.stringify({ targetId, isDemo: true })
      });
    }

    const formData = new FormData();
    formData.append('targetId', targetId);
    formData.append('archive', file);

    return request('/verify/zip', {
      method: 'POST',
      body: formData
    });
  },

  async verifyLiveUrl(
    targetId: string,
    targetUrl: string,
    isDemo?: boolean
  ): Promise<{ success: boolean; verified: boolean; method?: string; message?: string }> {
    return request('/verify/dns-file', {
      method: 'POST',
      body: JSON.stringify({ targetId, targetUrl, isDemo })
    });
  },

  async demoVerify(
    targetId: string
  ): Promise<{ success: boolean; verified: boolean; verificationMethod?: string; target?: Target }> {
    return request('/verify/demo-bypass', {
      method: 'POST',
      body: JSON.stringify({ targetId })
    });
  },

  // Scan Operations
  async startScan(
    targetId: string,
    options?: { isDemo?: boolean; isReScan?: boolean }
  ): Promise<{ message: string; scanId: string; status: string; isDemo?: boolean; isReScan?: boolean }> {
    return request('/scans', {
      method: 'POST',
      body: JSON.stringify({
        targetId,
        isDemo: options?.isDemo,
        isReScan: options?.isReScan
      })
    });
  },

  async getScanStatus(id: string): Promise<Scan> {
    return request<Scan>(`/scans/${id}`);
  },

  async getScanFindings(
    id: string,
    filters?: { severity?: string; category?: string }
  ): Promise<{ scanId: string; total: number; findings: Finding[] }> {
    const params = new URLSearchParams();
    if (filters?.severity) params.set('severity', filters.severity);
    if (filters?.category) params.set('category', filters.category);
    const query = params.toString() ? `?${params.toString()}` : '';
    return request<{ scanId: string; total: number; findings: Finding[] }>(`/scans/${id}/findings${query}`);
  },

  async getComparison(id: string): Promise<BeforeAfterComparisonData> {
    return request<BeforeAfterComparisonData>(`/scans/${id}/comparison`);
  },

  // Reports
  async getReport(scanId: string): Promise<Report> {
    return request<Report>(`/reports/${scanId}`);
  },

  async getPromptBundle(scanId: string): Promise<{ scanId: string; totalFindings: number; bundleMarkdown: string }> {
    return request(`/reports/${scanId}/prompt-bundle`);
  },

  getReportDownloadUrl(scanId: string): string {
    return `${API_BASE}/reports/${scanId}/download`;
  }
};
