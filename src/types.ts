/**
 * Shared Type Definitions for Job Recruitment Monitor
 */

export interface WebsiteConfig {
  id: string;
  name: string;
  url: string;
  baseUrl: string;
  enabled: boolean;
  itemSelector: string;
  titleSelector: string;
  linkSelector: string;
  dateSelector?: string;
}

export interface RecruitmentNotice {
  id: string;
  title: string;
  url: string;
  date?: string;
  recruitmentCode?: string;
  websiteId: string;
  websiteName: string;
  discoveredAt: string;
  isNew?: boolean; // dynamic field during checks
}

export interface MonitoringStatus {
  websiteId: string;
  websiteName: string;
  status: 'idle' | 'checking' | 'success' | 'error';
  error?: string;
  lastChecked?: string;
  lastSuccessfulCheck?: string;
  noticesFound: number;
  failedUrl?: string;
  statusCode?: number;
  errorCode?: string;
  phase?: 'homepage' | 'year-wise page' | 'current-year page' | 'generic';
  errorTimestamp?: string;
}

export interface ConnectionDiagnosticResult {
  dnsResolution: 'success' | 'failed';
  dnsDetails: string;
  httpsConnection: 'success' | 'failed';
  httpsDetails: string;
  httpStatus: number | null;
  httpStatusText: string;
  contentType: string | null;
  bodyLength: number | null;
  expectedHeadingDetected: boolean;
  requestDurationMs: number;
  timestamp: string;
  error: string | null;
}

export interface MonitorSummary {
  totalWebsites: number;
  enabledWebsites: number;
  lastChecked: string | null;
  lastSuccessfulCheck: string | null;
  totalNotices: number;
  newNoticesCount: number;
}

export interface MonitorApiResponse {
  success: boolean;
  summary: MonitorSummary;
  notices: RecruitmentNotice[];
  newNotices: RecruitmentNotice[];
  statuses: MonitoringStatus[];
  websites: WebsiteConfig[];
}
