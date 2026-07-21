import React, { useState } from 'react';
import { RecruitmentNotice } from '../types';
import { ExternalLink, Search, Sparkles, Filter, Calendar, FileText } from 'lucide-react';
import { motion } from 'motion/react';

interface NoticeListProps {
  notices: RecruitmentNotice[];
}

export default function NoticeList({ notices }: NoticeListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterNew, setFilterNew] = useState<boolean | null>(null); // null = all, true = only new

  // Filter notices based on searches
  const filteredNotices = notices.filter(notice => {
    const matchesSearch =
      notice.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notice.websiteName.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterNew === true) {
      return matchesSearch && notice.isNew;
    }
    return matchesSearch;
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header & Controls bar */}
      <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-slate-800 text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Recruitment Notices
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Historical log of scraped job postings from enabled public sources.
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search jobs or websites..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-1.5 w-64 border border-slate-200 rounded-lg text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
          </div>

          {/* New Notices Filter Badge */}
          <button
            onClick={() => setFilterNew(prev => (prev === true ? null : true))}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 border transition-all ${
              filterNew === true
                ? 'bg-orange-50 text-orange-700 border-orange-200 shadow-sm shadow-orange-500/5 animate-pulse'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            New Only ({notices.filter(n => n.isNew).length})
          </button>
        </div>
      </div>

      {/* Notices List */}
      {filteredNotices.length === 0 ? (
        <div className="p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3 border border-slate-200">
            <Search className="w-5 h-5 text-slate-400" />
          </div>
          <h4 className="text-sm font-semibold text-slate-700">No notices found</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {searchTerm || filterNew
              ? 'Try adjusting your filters or search terms.'
              : 'Trigger a "Check Now" scan to scrape notices from your enabled configurations.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-200 overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 sticky top-0">
                <th className="px-6 py-3">Job Notification / Notice Title</th>
                <th className="px-6 py-3">Sourced From</th>
                <th className="px-6 py-3">Publish Date</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredNotices.map((notice, idx) => (
                <motion.tr
                  key={notice.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.02, 0.2) }}
                  className="hover:bg-slate-50/40 transition-colors"
                >
                  {/* Title with New Indicator badge */}
                  <td className="px-6 py-4">
                    <div className="flex items-start gap-2.5">
                      {notice.isNew && (
                        <span className="flex-shrink-0 inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md mt-0.5 uppercase tracking-wider shadow-sm animate-pulse">
                          <Sparkles className="w-3 h-3" />
                          New
                        </span>
                      )}
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-slate-800 line-clamp-2 leading-relaxed">
                          {notice.title}
                        </span>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-[10px] font-mono text-slate-400">
                            ID: {notice.id}
                          </span>
                          {notice.recruitmentCode && (
                            <span className="inline-flex items-center text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                              Code: {notice.recruitmentCode}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Sourced Website */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center text-xs font-medium text-blue-700 bg-blue-50/80 px-2 py-1 rounded-md border border-blue-100 max-w-[160px] truncate">
                      {notice.websiteName}
                    </span>
                  </td>

                  {/* Date parsed */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {notice.date ? (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {notice.date}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 font-mono italic">
                        Not specified
                      </span>
                    )}
                  </td>

                  {/* Link action */}
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <a
                      href={notice.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      referrerPolicy="no-referrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 border border-transparent hover:border-blue-100 px-2.5 py-1.5 rounded-lg transition-all"
                    >
                      Official Page
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
