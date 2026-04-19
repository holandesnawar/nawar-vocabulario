'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getModules, getLessonsForModule } from '@/lib/courseService';
import { getModuleStats } from '@/lib/progress';
import type { CourseModule } from '@/lib/types';

function ModuleCard({ module }: { module: CourseModule }) {
  const lessons = getLessonsForModule(module.id);
  const lessonIds = lessons.map(l => l.id);
  const [stats, setStats] = useState({ completed: 0, inProgress: 0, total: lessonIds.length });

  useEffect(() => {
    setStats(getModuleStats(module.id, lessonIds));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module.id]);

  const pct = stats.total === 0 ? 0 : Math.round((stats.completed / stats.total) * 100);

  return (
    <Link
      href={`/modulo/${module.id}`}
      className="group flex flex-col rounded-2xl border border-[#DDE6F5] hover:border-[#1D0084]/20 hover:shadow-[0_8px_32px_rgba(29,0,132,0.08)] transition-all duration-300 overflow-hidden bg-white"
    >
      {/* Emoji header */}
      <div
        className="relative flex items-center justify-center py-8 text-5xl overflow-hidden"
        style={{ background: module.color }}
      >
        <div aria-hidden className="absolute inset-0 dots-dark pointer-events-none" />
        <span className="relative select-none" style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.25))' }}>
          {module.emoji}
        </span>
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] text-[#9CA3AF] font-medium">
            {lessons.length} lección{lessons.length !== 1 ? 'es' : ''}
          </span>
        </div>

        <div>
          <h2
            className="text-[18px] font-bold text-[#1D0084] group-hover:text-[#025dc7] transition-colors duration-200"
            style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
          >
            {module.title}
          </h2>
          {module.subtitle && (
            <p className="text-[12px] font-semibold text-[#025dc7] mt-0.5">{module.subtitle}</p>
          )}
          <p className="text-[13px] text-[#9CA3AF] mt-1 leading-snug">{module.description}</p>
        </div>

        {/* Progress */}
        {stats.completed > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-medium text-[#9CA3AF]">
              <span>{stats.completed}/{stats.total} lecciones</span>
              <span>{pct}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-[#DDE6F5] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#4da3ff] transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 text-[13px] font-semibold text-[#025dc7] group-hover:gap-3 transition-all duration-200 pt-1">
          {stats.completed === stats.total && stats.total > 0 ? 'Repasar' : stats.completed > 0 ? 'Continuar' : 'Empezar'}
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const modules = getModules();

  return (
    <main className="min-h-screen bg-white">
      {/* Hero header */}
      <div className="relative bg-[#1D0084] overflow-hidden">
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-[-5%] left-1/2 -translate-x-1/2 w-[700px] h-[500px]"
            style={{ background: 'radial-gradient(ellipse at center, rgba(11,109,240,0.30) 0%, transparent 65%)' }}
          />
        </div>
        <div aria-hidden className="absolute inset-0 dots-dark pointer-events-none" />

        <div className="relative max-w-2xl mx-auto px-6 py-12">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://docs.holandesnawar.com/img/Nawar.png"
            alt="Holandés Nawar"
            className="h-8 w-auto mb-5 opacity-90"
          />
          <h1
            className="text-[32px] font-bold text-white leading-tight"
            style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
          >
            Centro de aprendizaje
          </h1>
          <p className="text-[14px] text-white/50 mt-2">
            Formación Principiantes Nawar · {modules.length} módulo{modules.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Modules grid */}
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {modules.map(module => (
            <ModuleCard key={module.id} module={module} />
          ))}
        </div>
      </div>
    </main>
  );
}
