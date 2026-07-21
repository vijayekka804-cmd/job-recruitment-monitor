import React from 'react';
import { motion } from 'motion/react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  colorClass?: string;
}

export default function MetricCard({ title, value, subtitle, icon, colorClass = 'text-blue-600' }: MetricCardProps) {
  // Determine specialized Geometric Balance styles
  let containerClasses = "bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-start gap-4 transition-all hover:shadow-md hover:border-slate-300";
  let iconContainerClasses = "p-3 rounded-lg bg-slate-50 flex items-center justify-center";

  if (title.toLowerCase().includes('active')) {
    containerClasses = "bg-white rounded-xl border border-slate-200 shadow-sm flex items-start gap-4 p-5 transition-all hover:shadow-md hover:border-slate-300 border-l-4 border-l-blue-500";
  } else if (title.toLowerCase().includes('newly') || title.toLowerCase().includes('alerts') || title.toLowerCase().includes('new notices')) {
    containerClasses = "bg-orange-50/30 border border-orange-100 rounded-xl p-5 shadow-sm flex items-start gap-4 transition-all hover:shadow-md hover:border-orange-200";
    iconContainerClasses = "p-3 rounded-lg bg-orange-100/60 text-orange-600 flex items-center justify-center";
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className={containerClasses}
    >
      <div className={`${iconContainerClasses} ${colorClass}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</p>
        <div className="flex items-baseline justify-between gap-1">
          <h3 className="text-3xl font-bold text-slate-800 tracking-tight leading-none">{value}</h3>
          {subtitle && (
            <span className="text-[11px] text-slate-500 truncate max-w-full font-medium">{subtitle}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

