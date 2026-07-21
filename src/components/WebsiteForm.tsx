import React, { useState, useEffect } from 'react';
import { WebsiteConfig } from '../types';
import { X, HelpCircle, Save } from 'lucide-react';

interface WebsiteFormProps {
  config?: WebsiteConfig | null;
  onSave: (config: Partial<WebsiteConfig>) => Promise<boolean>;
  onClose: () => void;
}

export default function WebsiteForm({ config, onSave, onClose }: WebsiteFormProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [itemSelector, setItemSelector] = useState('');
  const [titleSelector, setTitleSelector] = useState('');
  const [linkSelector, setLinkSelector] = useState('');
  const [dateSelector, setDateSelector] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Pre-fill if editing an existing config
  useEffect(() => {
    if (config) {
      setName(config.name || '');
      setUrl(config.url || '');
      setBaseUrl(config.baseUrl || '');
      setEnabled(config.enabled ?? true);
      setItemSelector(config.itemSelector || '');
      setTitleSelector(config.titleSelector || '');
      setLinkSelector(config.linkSelector || '');
      setDateSelector(config.dateSelector || '');
    } else {
      // Defaults for a new config
      setName('');
      setUrl('');
      setBaseUrl('');
      setEnabled(true);
      setItemSelector('');
      setTitleSelector('');
      setLinkSelector('');
      setDateSelector('');
    }
    setValidationErrors([]);
  }, [config]);

  // Sync Base URL with URL domain when URL is entered, to make it easy for administrators
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUrl(value);
    try {
      if (value && (value.startsWith('http://') || value.startsWith('https://'))) {
        const parsed = new URL(value);
        setBaseUrl(parsed.origin);
      }
    } catch {
      // Ignore URL parsing errors during raw input typing
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors([]);
    setIsSubmitting(true);

    const payload: Partial<WebsiteConfig> = {
      id: config?.id,
      name,
      url,
      baseUrl,
      enabled,
      itemSelector,
      titleSelector,
      linkSelector,
      dateSelector: dateSelector ? dateSelector : undefined
    };

    const success = await onSave(payload);
    setIsSubmitting(false);
    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden my-8">
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">
            {config ? 'Edit Website Configuration' : 'Add Website Monitor'}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {validationErrors.length > 0 && (
            <div className="p-4 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100 space-y-1">
              <p className="font-semibold">Please correct the following errors:</p>
              <ul className="list-disc pl-5 space-y-0.5">
                {validationErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Website Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Website / Office Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. State Public Works Department"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Recruitment Page URL */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Recruitment Page URL <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="https://example-careers.gov/jobs"
              value={url}
              onChange={handleUrlChange}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-slate-400 mt-1">
              Must use http/https protocols. Localhost and private IP addresses are strictly rejected.
            </p>
          </div>

          {/* Base URL */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Base URL <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="https://example-careers.gov"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-slate-400 mt-1">
              Used to resolve relative href links (e.g. converting "/jobs/1" to "https://domain/jobs/1").
            </p>
          </div>

          {/* Toggle Enabled */}
          <div className="flex items-center gap-2 py-1">
            <input
              type="checkbox"
              id="enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="enabled" className="text-sm font-medium text-slate-700 cursor-pointer">
              Enable website monitoring active tracking
            </label>
          </div>

          <div className="border-t border-slate-100 pt-3 mt-4">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
              HTML Parse DOM Selectors (Cheerio CSS)
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Item CSS Selector */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Item Selector <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. .recruitment-item, tr.job-row"
                  value={itemSelector}
                  onChange={(e) => setItemSelector(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Repeated wrapper class enclosing each notice entry.
                </span>
              </div>

              {/* Title CSS Selector */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Title Selector <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. h3.title, td.job-title"
                  value={titleSelector}
                  onChange={(e) => setTitleSelector(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Finds title text (searched inside the item wrapper).
                </span>
              </div>

              {/* Link CSS Selector */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Link Selector <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. a.apply-link, a"
                  value={linkSelector}
                  onChange={(e) => setLinkSelector(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  HTML tag containing the 'href' attribute.
                </span>
              </div>

              {/* Date CSS Selector */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Date Selector (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. span.date, td.job-date"
                  value={dateSelector}
                  onChange={(e) => setDateSelector(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  CSS selector for announcement publication date.
                </span>
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="border-t border-slate-100 pt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm shadow-blue-500/10 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
