/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Globe,
  Plus,
  RefreshCw,
  Sliders,
  Database,
  Sparkles,
  Clock,
  AlertTriangle,
  HeartPulse,
  Info,
  Layers,
  RotateCcw
} from 'lucide-react';
import { WebsiteConfig, RecruitmentNotice, MonitoringStatus, MonitorSummary, MonitorApiResponse, ConnectionDiagnosticResult } from './types';
import MetricCard from './components/MetricCard';
import WebsiteCard from './components/WebsiteCard';
import WebsiteForm from './components/WebsiteForm';
import NoticeList from './components/NoticeList';

export default function App() {
  const [websites, setWebsites] = useState<WebsiteConfig[]>([]);
  const [notices, setNotices] = useState<RecruitmentNotice[]>([]);
  const [statuses, setStatuses] = useState<MonitoringStatus[]>([]);
  const [summary, setSummary] = useState<MonitorSummary>({
    totalWebsites: 0,
    enabledWebsites: 0,
    lastChecked: null,
    totalNotices: 0,
    newNoticesCount: 0
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form Modal States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<WebsiteConfig | null>(null);

  // Diagnostic States
  const [diagnosticResult, setDiagnosticResult] = useState<ConnectionDiagnosticResult | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  const handleTestConnection = async (id: string) => {
    setIsDiagnosing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setDiagnosticResult(null);
    try {
      const response = await fetch('/api/diagnose', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        setDiagnosticResult(data);
      } else {
        setErrorMessage(data.error || 'Connection diagnostic request failed.');
      }
    } catch (err) {
      setErrorMessage('Communication error during connection diagnostics. Please try again.');
    } finally {
      setIsDiagnosing(false);
    }
  };

  // Load current monitoring status on mount
  useEffect(() => {
    fetchCurrentStatus();
  }, []);

  const fetchCurrentStatus = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch('/api/status');
      const data = await response.json();
      if (data.success) {
        setWebsites(data.websites || []);
        setNotices(data.notices || []);
        setStatuses(data.statuses || []);
        setSummary(data.summary);
      } else {
        setErrorMessage(data.error || 'Failed to retrieve monitor status.');
      }
    } catch (err) {
      setErrorMessage('Could not establish contact with the backend monitoring service. Ensure server is active.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckNow = async () => {
    if (isChecking) return;
    setIsChecking(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const response = await fetch('/api/check', { method: 'POST' });
      const data: MonitorApiResponse = await response.json();
      if (data.success) {
        setWebsites(data.websites);
        setNotices(data.notices);
        setStatuses(data.statuses);
        setSummary(data.summary);
        
        if (data.summary.newNoticesCount > 0) {
          setSuccessMessage(`Scan completed successfully! Found ${data.summary.newNoticesCount} newly published recruitment notices.`);
        } else {
          setSuccessMessage('Scan completed! No new recruitment notices found since the last check.');
        }
      } else {
        // Handle specific server returned messages
        setErrorMessage((data as any).error || 'One or more scraping requests failed.');
      }
    } catch (err) {
      setErrorMessage('Communication error during scan execution. Please try again.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleResetSystem = async () => {
    if (!window.confirm('Are you sure you want to reset the monitoring system state? This clears notice histories, restores default sample templates, and sets the next scan as a baseline check.')) {
      return;
    }
    
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const response = await fetch('/api/reset', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        setWebsites(data.websites);
        setNotices([]);
        setStatuses(data.statuses);
        setSummary(data.summary);
        setSuccessMessage('Monitoring system state successfully reset to default baseline configuration templates.');
      } else {
        setErrorMessage(data.error || 'Failed to reset system state.');
      }
    } catch (err) {
      setErrorMessage('Network failure resetting monitor state.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleWebsite = async (id: string) => {
    try {
      const response = await fetch(`/api/websites/${id}/toggle`, { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        setWebsites(data.websites);
        
        // Update summary metrics immediately locally
        const updatedSites = data.websites;
        setSummary(prev => ({
          ...prev,
          totalWebsites: updatedSites.length,
          enabledWebsites: updatedSites.filter((w: any) => w.enabled).length
        }));
      } else {
        setErrorMessage(data.error || 'Failed to toggle website status.');
      }
    } catch (err) {
      setErrorMessage('Failed to connect to the server to toggle website status.');
    }
  };

  const handleDeleteWebsite = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this website monitor configuration? All historical listings for this site will be retained, but no further checks will run.')) {
      return;
    }
    try {
      const response = await fetch(`/api/websites/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        setWebsites(data.websites);
        setStatuses(prev => prev.filter(s => s.websiteId !== id));
        setSummary(prev => ({
          ...prev,
          totalWebsites: data.websites.length,
          enabledWebsites: data.websites.filter((w: any) => w.enabled).length
        }));
        setSuccessMessage('Monitor configuration removed successfully.');
      } else {
        setErrorMessage(data.error || 'Failed to delete configuration.');
      }
    } catch (err) {
      setErrorMessage('Could not complete deletion request due to network connection issues.');
    }
  };

  const handleSaveWebsite = async (configPayload: Partial<WebsiteConfig>): Promise<boolean> => {
    try {
      const response = await fetch('/api/websites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configPayload)
      });
      const data = await response.json();
      if (data.success) {
        setWebsites(data.websites);
        // Refresh statuses to pick up newly added site's state
        fetchCurrentStatus();
        setSuccessMessage('Website configuration successfully saved.');
        return true;
      } else {
        alert(`Failed to save configuration:\n\n${data.errors?.join('\n') || data.error}`);
        return false;
      }
    } catch (err) {
      alert('Network failure saving website configuration.');
      return false;
    }
  };

  const openAddModal = () => {
    setSelectedConfig(null);
    setIsFormOpen(true);
  };

  const openEditModal = (config: WebsiteConfig) => {
    setSelectedConfig(config);
    setIsFormOpen(true);
  };

  const formatTimestamp = (isoString: string | null): string => {
    if (!isoString) return 'Never checked';
    try {
      const dateObj = new Date(isoString);
      return dateObj.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Navbar Title Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-sm shadow-blue-500/10">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-800">Job Recruitment Monitor</h1>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Full-Stack Public Announcement Tracer</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex gap-4 text-right hidden lg:flex">
              {summary.lastChecked && (
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Last Attempted Scan</p>
                  <p className="text-xs font-semibold text-slate-600">{formatTimestamp(summary.lastChecked)}</p>
                </div>
              )}
              {summary.lastSuccessfulCheck && (
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-emerald-500 font-bold">Last Successful Scan</p>
                  <p className="text-xs font-semibold text-emerald-700">{formatTimestamp(summary.lastSuccessfulCheck)}</p>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {/* Reset state */}
              <button
                onClick={handleResetSystem}
                disabled={isLoading || isChecking}
                title="Clear monitoring logs and restore default configurations"
                className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-500 bg-white hover:bg-slate-50 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-40"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset System
              </button>

              {/* Quick check trigger */}
              <button
                onClick={handleCheckNow}
                disabled={isLoading || isChecking || websites.filter(w => w.enabled).length === 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm shadow-blue-500/10 hover:shadow-md transition-all flex items-center gap-1.5 disabled:opacity-40"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                {isChecking ? 'Scanning...' : 'Check Now'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Banner Alert detailing official CG Vyapam configuration */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row items-start gap-4">
          <div className="p-3 bg-blue-100 rounded-lg text-blue-800 flex-shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-blue-950 text-sm">CG Vyapam Recruitment Monitoring Active</h3>
            <p className="text-xs text-blue-900/90 mt-1 leading-relaxed">
              This system is configured to poll the official <strong>CG Vyapam Recruitment Portal</strong>. The system scans the Latest Posts homepage as well as dynamically resolving and crawling the recruitment listings for the current year.
            </p>
            <p className="text-xs font-semibold text-blue-950 mt-2">
              ℹ️ Polling requests occur entirely on the Node.js backend. If direct network connections time out due to public cloud IP blocks, scan errors will be displayed on the status card.
            </p>
          </div>
        </div>

        {/* Global Feedback Notifications */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-100 text-red-800 rounded-xl p-4 text-xs font-medium flex items-center gap-3">
            <HeartPulse className="w-4 h-4 text-red-500 animate-pulse flex-shrink-0" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl p-4 text-xs font-medium flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <span className="flex-1">{successMessage}</span>
          </div>
        )}

        {/* System Overview Statistics Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <MetricCard
            title="Sourced Websites"
            value={summary.totalWebsites}
            subtitle="Configured trackers"
            icon={<Globe className="w-5 h-5" />}
            colorClass="text-blue-600"
          />
          <MetricCard
            title="Tracking Active"
            value={summary.enabledWebsites}
            subtitle={`${summary.totalWebsites - summary.enabledWebsites} deactivated`}
            icon={<Sliders className="w-5 h-5" />}
            colorClass="text-indigo-600"
          />
          <MetricCard
            title="Last Scan Executed"
            value={summary.lastChecked ? formatTimestamp(summary.lastChecked).split(',')[1]?.trim() || 'Today' : 'Never'}
            subtitle={summary.lastChecked ? formatTimestamp(summary.lastChecked).split(',')[0] : 'Pending initial crawl'}
            icon={<Clock className="w-5 h-5" />}
            colorClass="text-amber-600"
          />
          <MetricCard
            title="Total Sourced Notices"
            value={summary.totalNotices}
            subtitle="Across active channels"
            icon={<Database className="w-5 h-5" />}
            colorClass="text-purple-600"
          />
          <MetricCard
            title="Newly Sourced Notices"
            value={summary.newNoticesCount}
            subtitle="Detected in last run"
            icon={<Sparkles className="w-5 h-5 text-emerald-600" />}
            colorClass="text-emerald-600 bg-emerald-50/50"
          />
        </div>

        {/* Grid Split Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left / Upper Column: Monitored website directory config */}
          <div className="lg:col-span-1 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-900 text-base">Monitored Web Sources</h2>
                <p className="text-xs text-slate-400 mt-0.5">Directory of trusted crawl targets.</p>
              </div>
              <button
                onClick={openAddModal}
                className="p-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1 transition-all shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>

            {isLoading ? (
              <div className="p-12 text-center bg-white rounded-xl border border-slate-100">
                <RefreshCw className="w-6 h-6 text-blue-500 animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-400">Loading configurations from safe ledger...</p>
              </div>
            ) : websites.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-xl border border-slate-100">
                <Globe className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <h4 className="text-xs font-semibold text-slate-700">No sites configured</h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  Click the 'Add' button to configure your first public recruitment page.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 max-h-[70vh] overflow-y-auto pr-1">
                  {websites.map(site => {
                    const statusObj = statuses.find(s => s.websiteId === site.id);
                    return (
                      <WebsiteCard
                        key={site.id}
                        website={site}
                        status={statusObj}
                        onToggle={handleToggleWebsite}
                        onEdit={openEditModal}
                        onDelete={handleDeleteWebsite}
                        onTestConnection={handleTestConnection}
                      />
                    );
                  })}
                </div>

                {/* Service Status widget from Geometric Balance */}
                <div className="bg-slate-800 text-slate-300 p-4 rounded-xl flex items-center justify-between shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)] animate-pulse"></div>
                    <span className="text-xs font-medium">Service Status: {isChecking ? 'Crawling Pages...' : 'Idle / Ready'}</span>
                  </div>
                  <div className="text-[10px] font-mono opacity-60">NODE_RUNTIME: V20.X // ACTIVE</div>
                </div>
              </div>
            )}
          </div>

          {/* Right / Lower Column: Sourced notices feed */}
          <div className="lg:col-span-2">
            {isLoading ? (
              <div className="p-20 text-center bg-white rounded-xl border border-slate-100">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
                <p className="text-sm text-slate-400">Loading announcement records...</p>
              </div>
            ) : (
              <NoticeList notices={notices} />
            )}
          </div>
        </div>
      </main>

      {/* Footer copyright */}
      <footer className="bg-white border-t border-slate-100 py-6 mt-12 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <p>Job Recruitment Monitor &copy; 2026. Local isolated monitoring system template.</p>
          <div className="flex items-center gap-1.5 text-slate-400">
            <Info className="w-3.5 h-3.5 text-blue-500" />
            <span>Administrator secure workspace. Real-time active polling.</span>
          </div>
        </div>
      </footer>

      {/* Modal Form */}
      {isFormOpen && (
        <WebsiteForm
          config={selectedConfig}
          onSave={handleSaveWebsite}
          onClose={() => setIsFormOpen(false)}
        />
      )}

      {/* Diagnostics Loading Overlay */}
      {isDiagnosing && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex flex-col items-center justify-center z-50">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-2xl flex flex-col items-center gap-3 max-w-xs text-center">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
            <h4 className="font-bold text-slate-800 text-sm">Testing Connection...</h4>
            <p className="text-xs text-slate-400">Performing live DNS lookup, TLS handshake, and HTTP GET on official CG Vyapam servers.</p>
          </div>
        </div>
      )}

      {/* Diagnostics Result Modal */}
      {diagnosticResult && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-5 h-5 text-indigo-400 animate-pulse" />
                <div>
                  <h3 className="font-bold text-sm tracking-tight">CG Vyapam Connection Diagnostic</h3>
                  <p className="text-[10px] text-slate-400">Live backend network sanity check</p>
                </div>
              </div>
              <button 
                onClick={() => setDiagnosticResult(null)}
                className="text-slate-400 hover:text-white transition-colors font-semibold text-sm px-2 py-1 rounded hover:bg-slate-800"
              >
                ✕ Close
              </button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* DNS RESOLUTION */}
                <div className={`p-3.5 rounded-xl border ${
                  diagnosticResult.dnsResolution === 'success' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/50 border-red-100'
                }`}>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">DNS Resolution</p>
                  <p className={`text-xs font-extrabold mt-1 uppercase tracking-wide ${
                    diagnosticResult.dnsResolution === 'success' ? 'text-emerald-700' : 'text-red-700'
                  }`}>
                    {diagnosticResult.dnsResolution}
                  </p>
                  <p className="text-[11px] text-slate-600 mt-1 font-mono break-all">{diagnosticResult.dnsDetails}</p>
                </div>

                {/* HTTPS CONNECTION */}
                <div className={`p-3.5 rounded-xl border ${
                  diagnosticResult.httpsConnection === 'success' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/50 border-red-100'
                }`}>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">HTTPS Connection (TLS)</p>
                  <p className={`text-xs font-extrabold mt-1 uppercase tracking-wide ${
                    diagnosticResult.httpsConnection === 'success' ? 'text-emerald-700' : 'text-red-700'
                  }`}>
                    {diagnosticResult.httpsConnection}
                  </p>
                  <p className="text-[11px] text-slate-600 mt-1 font-mono break-all">{diagnosticResult.httpsDetails}</p>
                </div>

                {/* HTTP STATUS CODE */}
                <div className={`p-3.5 rounded-xl border ${
                  diagnosticResult.httpStatus && diagnosticResult.httpStatus < 400 ? 'bg-emerald-50/50 border-emerald-100' : 'bg-amber-50/50 border-amber-100'
                }`}>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">HTTP Status Code</p>
                  <p className="text-sm font-extrabold mt-1 text-slate-800">
                    {diagnosticResult.httpStatus || 'N/A'} <span className="text-xs font-medium text-slate-500">({diagnosticResult.httpStatusText})</span>
                  </p>
                </div>

                {/* DURATION */}
                <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Request Duration</p>
                  <p className="text-sm font-extrabold mt-1 text-slate-800">
                    {diagnosticResult.requestDurationMs} ms
                  </p>
                </div>
              </div>

              <div className="space-y-2 border-t border-slate-100 pt-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Content Type:</span>
                  <span className="font-mono text-slate-700">{diagnosticResult.contentType || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Response Body Length:</span>
                  <span className="font-mono text-slate-700">
                    {diagnosticResult.bodyLength !== null ? `${(diagnosticResult.bodyLength / 1024).toFixed(2)} KB (${diagnosticResult.bodyLength} bytes)` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Expected Portal Heading Detected:</span>
                  <span className={`font-semibold px-2 py-0.5 rounded text-[10px] uppercase ${
                    diagnosticResult.expectedHeadingDetected ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {diagnosticResult.expectedHeadingDetected ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>

              {diagnosticResult.error && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-800">
                  <p className="font-semibold text-red-900">Diagnostic Failure Alert:</p>
                  <p className="mt-1 font-mono text-[11px] leading-relaxed">{diagnosticResult.error}</p>
                </div>
              )}

              {/* Cloud-IP network block message if failing */}
              {(diagnosticResult.dnsResolution === 'failed' || diagnosticResult.httpsConnection === 'failed' || !diagnosticResult.bodyLength) && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-950">
                  <p className="font-semibold text-amber-950">⚠️ Connection Advisory</p>
                  <p className="mt-1 leading-relaxed">
                    If DNS resolution succeeds but the connection times out/fails, cloud-IP blocking is one possible cause, as firewalls protecting governmental sites sometimes filter traffic from public cloud hosting environments (such as AWS, GCP, or Azure). The crawler logic remains fully operational and prepared to run in any non-restricted environment (such as a local computer or a GitHub Actions runner).
                  </p>
                </div>
              )}
            </div>

            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setDiagnosticResult(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                Acknowledge & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
