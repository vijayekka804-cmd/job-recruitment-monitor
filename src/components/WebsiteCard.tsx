import React from 'react';
import { WebsiteConfig, MonitoringStatus } from '../types';
import { Power, Edit2, Trash2, Globe, CheckCircle, AlertCircle, RefreshCw, Key, HeartPulse } from 'lucide-react';

interface WebsiteCardProps {
  key?: string | number;
  website: WebsiteConfig;
  status?: MonitoringStatus;
  onToggle: (id: string) => void;
  onEdit: (website: WebsiteConfig) => void;
  onDelete: (id: string) => void;
  onTestConnection?: (id: string) => void;
}

export default function WebsiteCard({ website, status, onToggle, onEdit, onDelete, onTestConnection }: WebsiteCardProps) {
  const isEnabled = website.enabled;
  const currentStatus = status?.status || 'idle';
  const errorMsg = status?.error;
  const noticesCount = status?.noticesFound || 0;

  return (
    <div className={`bg-white rounded-xl border p-5 shadow-sm transition-all flex flex-col justify-between ${
      isEnabled ? 'border-slate-200 hover:border-slate-300 hover:shadow-md' : 'border-slate-200/50 bg-slate-50/50 opacity-80'
    }`}>
      <div>
        {/* Top bar with name and active status toggle */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Globe className={`w-5 h-5 flex-shrink-0 ${isEnabled ? 'text-blue-500' : 'text-slate-400'}`} />
            <h4 className="font-semibold text-slate-800 truncate text-base">{website.name}</h4>
          </div>
          <button
            onClick={() => onToggle(website.id)}
            title={isEnabled ? 'Deactivate Monitor' : 'Activate Monitor'}
            className={`p-1.5 rounded-lg transition-colors border ${
              isEnabled
                ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100'
                : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'
            }`}
          >
            <Power className="w-4 h-4" />
          </button>
        </div>

        {/* URL Address */}
        <p className="text-xs text-slate-400 mt-1 truncate hover:text-blue-600">
          <a href={website.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
            {website.url}
          </a>
        </p>

        {/* CSS Selectors Info Badge */}
        <div className="mt-4 bg-slate-50/80 rounded-lg p-3 text-xs border border-slate-100 space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-400">Wrapper:</span>
            <code className="text-slate-600 font-mono font-medium truncate max-w-[150px]" title={website.itemSelector}>
              {website.itemSelector}
            </code>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Title:</span>
            <code className="text-slate-600 font-mono font-medium truncate max-w-[150px]" title={website.titleSelector}>
              {website.titleSelector}
            </code>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Link:</span>
            <code className="text-slate-600 font-mono font-medium truncate max-w-[150px]" title={website.linkSelector}>
              {website.linkSelector}
            </code>
          </div>
          {website.dateSelector && (
            <div className="flex justify-between">
              <span className="text-slate-400">Date:</span>
              <code className="text-slate-600 font-mono font-medium truncate max-w-[150px]" title={website.dateSelector}>
                {website.dateSelector}
              </code>
            </div>
          )}
        </div>

        {/* Detailed Crawl Error Reporting under CG Vyapam website card */}
        {currentStatus === 'error' && (
          <div className="mt-4 bg-red-50 rounded-lg p-3 text-xs border border-red-100 text-red-900 space-y-2">
            <div className="flex items-center gap-1 font-semibold text-red-800">
              <AlertCircle className="w-3.5 h-3.5 text-red-600" />
              <span>Crawl Failure Details:</span>
            </div>
            <div className="space-y-1.5 font-mono text-[10px] leading-tight">
              {status?.failedUrl && (
                <div className="break-all">
                  <span className="text-red-700 font-bold">Failed URL:</span> {status.failedUrl}
                </div>
              )}
              {status?.phase && (
                <div>
                  <span className="text-red-700 font-bold">Failed Phase:</span> <span className="uppercase font-bold text-red-800 bg-red-100 px-1 rounded">{status.phase}</span>
                </div>
              )}
              {status?.statusCode !== undefined && (
                <div>
                  <span className="text-red-700 font-bold">HTTP Status:</span> {status.statusCode}
                </div>
              )}
              {status?.errorCode && (
                <div>
                  <span className="text-red-700 font-bold">Error Code:</span> {status.errorCode}
                </div>
              )}
              {errorMsg && (
                <div className="bg-red-100/50 p-1.5 rounded border border-red-200/50 mt-1">
                  <span className="text-red-800 font-bold">Message:</span> {errorMsg}
                </div>
              )}
              {status?.errorTimestamp && (
                <div className="text-[9px] text-red-500 mt-1">
                  Timestamp: {new Date(status.errorTimestamp).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Timestamps segment */}
        {(status?.lastChecked || status?.lastSuccessfulCheck) && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-1 text-[10px] text-slate-400">
            {status.lastChecked && (
              <div className="flex justify-between">
                <span>Last Attempted Scan:</span>
                <span className="font-semibold text-slate-600">{new Date(status.lastChecked).toLocaleString()}</span>
              </div>
            )}
            {status.lastSuccessfulCheck && (
              <div className="flex justify-between">
                <span>Last Successful Scan:</span>
                <span className="font-semibold text-emerald-600">{new Date(status.lastSuccessfulCheck).toLocaleString()}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer / Status segment */}
      <div className="mt-5 border-t border-slate-100 pt-3 flex items-center justify-between">
        {/* Status indicator */}
        <div className="flex items-center gap-1.5">
          {currentStatus === 'checking' && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100 animate-pulse">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Checking...
            </span>
          )}
          {currentStatus === 'success' && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              <CheckCircle className="w-3.5 h-3.5" />
              Found {noticesCount}
            </span>
          )}
          {currentStatus === 'error' && (
            <span
              className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100 cursor-help"
              title={errorMsg || 'Crawl check failed'}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              Crawl Error
            </span>
          )}
          {currentStatus === 'idle' && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
              Idle
            </span>
          )}
        </div>

        {/* Administration Actions */}
        <div className="flex items-center gap-1.5">
          {isEnabled && onTestConnection && (
            <button
              onClick={() => onTestConnection(website.id)}
              title="Run Connection Diagnostics"
              className="p-1.5 rounded-lg text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 transition-all border border-transparent hover:border-indigo-100"
            >
              <HeartPulse className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => onEdit(website)}
            title="Edit website rules"
            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(website.id)}
            title="Delete monitor configuration"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all border border-transparent hover:border-red-100"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
