import React from 'react';

export default function PlaceholderPage({ title, description }: { title: string, description: string }) {
  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-1 tracking-tight">{title}</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{description}</p>
        </div>
      </div>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center shadow-sm">
        <p className="text-slate-500 font-medium">This module is currently under development.</p>
      </div>
    </div>
  );
}
