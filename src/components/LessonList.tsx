'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getLessonProgress } from '@/lib/progress';
import type { Lesson, LessonStatus } from '@/lib/types';

/* ─────────────────────────────────────────────────────────────────────────────
   STATUS BADGE
───────────────────────────────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: LessonStatus }) {
    if (status === 'completed') {
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 border border-green-200 text-green-700 text-[11px] font-semibold">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.59L5.41 12 6.83 10.58 10 13.75l7.17-7.17 1.41 1.42L10 16.59z" />
                </svg>
                Completada
            </span>
        );
    }
    if (status === 'in_progress') {
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F0F5FF] border border-[#DDE6F5] text-[#025dc7] text-[11px] font-semibold">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" />
                </svg>
                En curso
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F8F9FA] border border-[#DDE6F5] text-[#9CA3AF] text-[11px] font-semibold">
            Pendiente
        </span>
    );
}

/* ─────────────────────────────────────────────────────────────────────────────
   LESSON LIST (client — reads localStorage)
───────────────────────────────────────────────────────────────────────────── */

export default function LessonList({ lessons, moduleId }: { lessons: Lesson[]; moduleId: string }) {
    const [statuses, setStatuses] = useState<Record<string, LessonStatus>>({});

    useEffect(() => {
        const s: Record<string, LessonStatus> = {};
        for (const lesson of lessons) {
            const p = getLessonProgress(lesson.id);
            s[lesson.id] = p?.status ?? 'pending';
        }
        setStatuses(s);
    }, [lessons]);

    // First non-completed lesson is the "next" one
    const nextLessonId = lessons.find(l => statuses[l.id] !== 'completed')?.id;

    return (
        <div className="space-y-3">
            {lessons.map(lesson => {
                const status = statuses[lesson.id] ?? 'pending';
                const isNext = lesson.id === nextLessonId;

                const cardClass = `group flex items-start gap-4 rounded-2xl border p-5 transition-all duration-300 hover:shadow-[0_8px_32px_rgba(29,0,132,0.08)] ${
                    isNext
                        ? 'border-[#1D0084]/30 bg-[#F0F5FF] hover:border-[#1D0084]/50'
                        : 'border-[#DDE6F5] bg-white hover:border-[#1D0084]/20'
                }`;

                return (
                    <Link
                        key={lesson.id}
                        href={`/modulo/${moduleId}/leccion/${lesson.id}`}
                        className={cardClass}
                    >
                        {/* Order number */}
                        <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center text-[14px] font-bold shrink-0 ${
                                status === 'completed'
                                    ? 'bg-green-100 text-green-700'
                                    : isNext
                                        ? 'bg-[#1D0084] text-white'
                                        : 'bg-[#F8F9FA] text-[#9CA3AF]'
                            }`}
                        >
                            {String(lesson.order).padStart(2, '0')}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                                <h3
                                    className="text-[15px] font-bold leading-snug text-[#1D0084] group-hover:text-[#025dc7] transition-colors duration-200"
                                    style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
                                >
                                    {lesson.title}
                                </h3>
                                <StatusBadge status={status} />
                            </div>
                            <p className="text-[13px] text-[#9CA3AF] leading-snug mb-2">{lesson.subtitle}</p>
                            <div className="flex items-center gap-3 text-[12px] text-[#5A6480]">
                                <span className="flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {lesson.estimatedMinutes} min
                                </span>
                                <span className="text-[#DDE6F5]">·</span>
                                <span className="leading-snug">{lesson.learningObjective}</span>
                            </div>
                        </div>

                        <svg
                            className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#025dc7] group-hover:translate-x-0.5 transition-all duration-200 shrink-0 mt-1"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2.5}
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </Link>
                );
            })}
        </div>
    );
}
