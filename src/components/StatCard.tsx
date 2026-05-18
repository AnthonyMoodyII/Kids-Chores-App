import React from 'react';
import { cardSurface } from '../lib/constants';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  val: string;
  accent: string;
}

export function StatCard({ icon, label, val, accent }: StatCardProps) {
  return (
    <div className={`${cardSurface} flex items-center gap-4 p-6`}>
      <div
        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${accent} text-white shadow-lg`}
      >
        {icon}
      </div>
      <div className="min-w-0 text-left">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
        <p className="truncate text-2xl font-black text-slate-900">{val}</p>
      </div>
    </div>
  );
}
