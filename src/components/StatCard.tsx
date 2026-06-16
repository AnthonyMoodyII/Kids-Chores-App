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
    <div className={`${cardSurface} group relative flex items-center gap-4 overflow-hidden p-6 transition-transform duration-300 hover:-translate-y-0.5`}>
      {/* Decorative glow, tinted to match the icon accent */}
      <div className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${accent} opacity-[0.08] blur-2xl transition-opacity duration-300 group-hover:opacity-[0.14]`} />

      <div
        className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${accent} text-white shadow-lg ring-4 ring-white/40`}
      >
        {icon}
      </div>
      <div className="relative min-w-0 text-left">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
        <p className="truncate text-2xl font-black text-slate-900">{val}</p>
      </div>

      {/* Accent underline */}
      <div className={`absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r ${accent} opacity-70`} />
    </div>
  );
}
