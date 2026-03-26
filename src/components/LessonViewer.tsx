'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import type { Lesson, CourseModule, VocabularyItem, PhraseItem, ExerciseItem, Dialogue } from '@/lib/types';
import {
  getLessonProgress,
  markLessonStarted,
  markLessonCompleted,
  updateLessonProgress,
} from '@/lib/progress';
import AudioPlayer from './AudioPlayer';

/* ─────────────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────────────── */

function speakDutch(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'nl-NL';
  u.rate = 0.78;
  u.pitch = 1;
  window.speechSynthesis.speak(u);
}

function Stars({ score, total }: { score: number; total: number }) {
  const pct = total === 0 ? 0 : score / total;
  const stars = pct >= 0.9 ? 5 : pct >= 0.75 ? 4 : pct >= 0.55 ? 3 : pct >= 0.35 ? 2 : 1;
  return (
    <div className="flex gap-1 justify-center" aria-label={`${stars} de 5 estrellas`}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          className={`w-7 h-7 ${i < stars ? 'text-[#4da3ff]' : 'text-[#DDE6F5]'}`}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

function ProgressBar({ current, total, label }: { current: number; total: number; label: string }) {
  const pct = total === 0 ? 0 : Math.round((current / total) * 100);
  return (
    <div className="w-full space-y-1.5">
      <div className="flex items-center justify-between text-[12px] font-medium text-[#9CA3AF]">
        <span>{label}</span>
        <span>{current} / {total}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-[#DDE6F5] overflow-hidden">
        <div
          className="h-full rounded-full bg-[#4da3ff] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   TAB TYPE
───────────────────────────────────────────────────────────────────────────── */

type TabId = 'vocabulary' | 'phrases' | 'practice' | 'dialogue' | 'review';

const TAB_LABELS: Record<TabId, string> = {
  vocabulary: 'Vocabulario',
  phrases: 'Frases',
  practice: 'Práctica',
  dialogue: 'Diálogo',
  review: 'Resumen',
};

/* ─────────────────────────────────────────────────────────────────────────────
   VOCABULARY SECTION
───────────────────────────────────────────────────────────────────────────── */

function VocabularySection({
  items,
  onComplete,
}: {
  items: VocabularyItem[];
  onComplete: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);
  const word = items[index];

  function goNext() {
    setFlipped(false);
    if (index + 1 >= items.length) {
      setDone(true);
    } else {
      setIndex(i => i + 1);
    }
  }

  function goPrev() {
    setFlipped(false);
    setIndex(i => Math.max(0, i - 1));
  }

  return (
    <div className="space-y-8">
      <ProgressBar current={index + 1} total={items.length} label="Palabras" />

      <div className="w-full max-w-sm mx-auto">
        {/* Emoji visual */}
        <div
          className="relative flex items-center justify-center rounded-2xl mb-4 overflow-hidden"
          style={{ background: word.color, height: 200 }}
        >
          <span
            className="text-[80px] select-none"
            style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.25))' }}
          >
            {word.emoji}
          </span>

          {word.article && (
            <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-white text-[12px] font-bold">
              {word.article}
            </div>
          )}

          <button
            onClick={() => speakDutch((word.article ? `${word.article} ` : '') + word.dutch)}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/25 transition-colors duration-200"
            aria-label="Escuchar pronunciación"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12" />
            </svg>
          </button>
        </div>

        {/* Word info */}
        <div className="bg-white rounded-2xl border border-[#DDE6F5] p-6 space-y-4">
          <div>
            <h2
              className="text-[32px] font-bold text-[#1D0084] leading-none"
              style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
            >
              {word.dutch}
            </h2>
            <p className="text-[18px] text-[#5A6480] mt-1">{word.spanish}</p>
          </div>

          <button
            onClick={() => setFlipped(f => !f)}
            className="w-full text-left rounded-xl bg-[#F0F5FF] px-4 py-3 border border-[#DDE6F5] hover:border-[#025dc7]/30 transition-colors duration-200 group"
          >
            <p className="text-[12px] font-semibold text-[#9CA3AF] mb-1 group-hover:text-[#025dc7] transition-colors duration-200">
              Ejemplo {flipped ? '↑' : '↓'}
            </p>
            <p className="text-[14px] text-[#1D0084] font-medium leading-snug">{word.exampleNl}</p>
            {flipped && (
              <p className="text-[13px] text-[#5A6480] mt-1 leading-snug">{word.exampleEs}</p>
            )}
          </button>

          <button
            onClick={() => speakDutch(word.exampleNl)}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-[#025dc7] hover:text-[#1D0084] transition-colors duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728" />
            </svg>
            Escuchar ejemplo
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={goPrev}
          disabled={index === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#F0F5FF] text-[#1D0084] text-[14px] font-semibold border border-[#DDE6F5] hover:bg-[#e0eaff] transition-colors duration-200 disabled:opacity-30 disabled:pointer-events-none"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Anterior
        </button>

        <div className="flex items-center gap-1.5 flex-wrap justify-center max-w-[160px]">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => { setFlipped(false); setIndex(i); }}
              className={`rounded-full transition-all duration-200 ${
                i === index
                  ? 'w-5 h-2 bg-[#1D0084]'
                  : i < index
                  ? 'w-2 h-2 bg-[#4da3ff]'
                  : 'w-2 h-2 bg-[#DDE6F5]'
              }`}
              aria-label={`Ir a palabra ${i + 1}`}
            />
          ))}
        </div>

        {!done ? (
          <button
            onClick={goNext}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1D0084] text-white text-[14px] font-semibold hover:bg-[#025dc7] transition-colors duration-200"
          >
            Siguiente
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <button
            onClick={onComplete}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#4da3ff] text-[#0a1a4a] text-[14px] font-semibold hover:bg-[#3391f0] transition-colors duration-200"
          >
            Continuar
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   PHRASES SECTION
───────────────────────────────────────────────────────────────────────────── */

function PhrasesSection({
  items,
  onComplete,
}: {
  items: PhraseItem[];
  onComplete: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [showSpanish, setShowSpanish] = useState(false);
  const [done, setDone] = useState(false);
  const phrase = items[index];

  function goNext() {
    setShowSpanish(false);
    if (index + 1 >= items.length) {
      setDone(true);
    } else {
      setIndex(i => i + 1);
    }
  }

  function goPrev() {
    setShowSpanish(false);
    setIndex(i => Math.max(0, i - 1));
  }

  return (
    <div className="space-y-8">
      <ProgressBar current={index + 1} total={items.length} label="Frases" />

      <div className="w-full max-w-sm mx-auto space-y-4">
        {phrase.context && (
          <p className="eyebrow text-[#9CA3AF]">{phrase.context}</p>
        )}

        <div className="bg-white rounded-2xl border border-[#DDE6F5] p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <h2
              className="text-[24px] font-bold text-[#1D0084] leading-tight flex-1"
              style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
            >
              {phrase.dutch}
            </h2>
            <button
              onClick={() => speakDutch(phrase.dutch)}
              className="w-9 h-9 rounded-full bg-[#F0F5FF] border border-[#DDE6F5] flex items-center justify-center text-[#025dc7] hover:bg-[#e0eaff] transition-colors duration-200 shrink-0"
              aria-label="Escuchar frase"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728" />
              </svg>
            </button>
          </div>

          <button
            onClick={() => setShowSpanish(s => !s)}
            className="w-full text-left rounded-xl bg-[#F0F5FF] px-4 py-3 border border-[#DDE6F5] hover:border-[#025dc7]/30 transition-colors duration-200"
          >
            <p className="text-[12px] font-semibold text-[#9CA3AF] mb-1">
              Traducción {showSpanish ? '↑' : '↓'}
            </p>
            {showSpanish ? (
              <p className="text-[15px] text-[#5A6480] leading-snug">{phrase.spanish}</p>
            ) : (
              <p className="text-[14px] text-[#9CA3AF] italic">Toca para ver la traducción</p>
            )}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <button
          onClick={goPrev}
          disabled={index === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#F0F5FF] text-[#1D0084] text-[14px] font-semibold border border-[#DDE6F5] hover:bg-[#e0eaff] transition-colors duration-200 disabled:opacity-30 disabled:pointer-events-none"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Anterior
        </button>

        <div className="flex items-center gap-1.5 flex-wrap justify-center max-w-[120px]">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => { setShowSpanish(false); setIndex(i); }}
              className={`rounded-full transition-all duration-200 ${
                i === index ? 'w-5 h-2 bg-[#1D0084]' : i < index ? 'w-2 h-2 bg-[#4da3ff]' : 'w-2 h-2 bg-[#DDE6F5]'
              }`}
              aria-label={`Ir a frase ${i + 1}`}
            />
          ))}
        </div>

        {!done ? (
          <button
            onClick={goNext}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1D0084] text-white text-[14px] font-semibold hover:bg-[#025dc7] transition-colors duration-200"
          >
            Siguiente
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <button
            onClick={onComplete}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#4da3ff] text-[#0a1a4a] text-[14px] font-semibold hover:bg-[#3391f0] transition-colors duration-200"
          >
            Continuar
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   PRACTICE SECTION
───────────────────────────────────────────────────────────────────────────── */

function MultipleChoiceExercise({
  exercise,
  onAnswer,
}: {
  exercise: ExerciseItem;
  onAnswer: (correct: boolean) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const isAnswered = selected !== null;

  function handleSelect(opt: string) {
    if (isAnswered) return;
    setSelected(opt);
    onAnswer(opt === exercise.correctAnswer);
  }

  function optionStyle(opt: string): string {
    const base =
      'w-full text-left px-4 py-3.5 rounded-xl text-[15px] font-medium transition-all duration-200 border ';
    if (!isAnswered)
      return base + 'bg-[#F0F5FF] border-[#DDE6F5] text-[#1D0084] hover:border-[#025dc7]/40 hover:bg-[#e8f0ff] active:scale-[0.98]';
    if (opt === exercise.correctAnswer) return base + 'bg-green-50 border-green-400 text-green-800';
    if (opt === selected) return base + 'bg-red-50 border-red-400 text-red-700';
    return base + 'bg-[#F8F9FA] border-[#DDE6F5] text-[#9CA3AF]';
  }

  return (
    <div className="space-y-4">
      <div className="bg-[#F0F5FF] rounded-2xl p-5 border border-[#DDE6F5]">
        <p className="text-[16px] font-semibold text-[#1D0084] leading-snug">{exercise.prompt}</p>
      </div>
      <div className="grid grid-cols-1 gap-2.5">
        {exercise.options?.map(opt => (
          <button key={opt} className={optionStyle(opt)} onClick={() => handleSelect(opt)}>
            <span className="flex items-center justify-between gap-2">
              {opt}
              {isAnswered && opt === exercise.correctAnswer && (
                <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {isAnswered && opt === selected && opt !== exercise.correctAnswer && (
                <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </span>
          </button>
        ))}
      </div>
      {isAnswered && (
        <div
          className={`rounded-xl px-4 py-3 text-[14px] font-medium ${
            selected === exercise.correctAnswer
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {selected === exercise.correctAnswer
            ? '✓ ¡Correcto!'
            : `✗ La respuesta era: "${exercise.correctAnswer}"`}
          {exercise.explanation && (
            <p className="mt-1 text-[13px] opacity-80">{exercise.explanation}</p>
          )}
        </div>
      )}
    </div>
  );
}

function WriteAnswerExercise({
  exercise,
  onAnswer,
}: {
  exercise: ExerciseItem;
  onAnswer: (correct: boolean) => void;
}) {
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const isCorrect = value.trim().toLowerCase() === exercise.correctAnswer.trim().toLowerCase();

  function handleSubmit() {
    if (!value.trim() || submitted) return;
    setSubmitted(true);
    onAnswer(isCorrect);
  }

  return (
    <div className="space-y-4">
      <div className="bg-[#F0F5FF] rounded-2xl p-5 border border-[#DDE6F5]">
        <p className="text-[16px] font-semibold text-[#1D0084] leading-snug">{exercise.prompt}</p>
        {exercise.hint && (
          <p className="text-[13px] text-[#9CA3AF] mt-2">💡 {exercise.hint}</p>
        )}
      </div>
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        disabled={submitted}
        placeholder="Escribe tu respuesta..."
        className="w-full px-4 py-3.5 rounded-xl border border-[#DDE6F5] text-[15px] text-[#1D0084] bg-white focus:outline-none focus:border-[#025dc7] transition-colors duration-200 disabled:opacity-60"
      />
      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={!value.trim()}
          className="w-full py-3.5 rounded-xl bg-[#1D0084] text-white text-[15px] font-semibold hover:bg-[#025dc7] transition-colors duration-200 disabled:opacity-40 disabled:pointer-events-none"
        >
          Comprobar
        </button>
      )}
      {submitted && (
        <div
          className={`rounded-xl px-4 py-3 text-[14px] font-medium ${
            isCorrect
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {isCorrect
            ? '✓ ¡Correcto!'
            : `✗ La respuesta correcta era: "${exercise.correctAnswer}"`}
        </div>
      )}
    </div>
  );
}

function ListenAndChooseExercise({
  exercise,
  onAnswer,
}: {
  exercise: ExerciseItem;
  onAnswer: (correct: boolean) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const isAnswered = selected !== null;

  // Extract the Dutch text from the prompt for TTS (text in quotes)
  const match = exercise.prompt.match(/"([^"]+)"/);
  const dutchText = match ? match[1] : exercise.prompt;

  function handleSelect(opt: string) {
    if (isAnswered) return;
    setSelected(opt);
    onAnswer(opt === exercise.correctAnswer);
  }

  function optionStyle(opt: string): string {
    const base =
      'w-full text-left px-4 py-3.5 rounded-xl text-[15px] font-medium transition-all duration-200 border ';
    if (!isAnswered)
      return base + 'bg-[#F0F5FF] border-[#DDE6F5] text-[#1D0084] hover:border-[#025dc7]/40 hover:bg-[#e8f0ff] active:scale-[0.98]';
    if (opt === exercise.correctAnswer) return base + 'bg-green-50 border-green-400 text-green-800';
    if (opt === selected) return base + 'bg-red-50 border-red-400 text-red-700';
    return base + 'bg-[#F8F9FA] border-[#DDE6F5] text-[#9CA3AF]';
  }

  return (
    <div className="space-y-4">
      <div className="bg-[#F0F5FF] rounded-2xl p-5 border border-[#DDE6F5]">
        <p className="text-[16px] font-semibold text-[#1D0084] leading-snug mb-3">{exercise.prompt}</p>
        <button
          onClick={() => speakDutch(dutchText)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1D0084] text-white text-[13px] font-semibold hover:bg-[#025dc7] transition-colors duration-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728" />
          </svg>
          Escuchar
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2.5">
        {exercise.options?.map(opt => (
          <button key={opt} className={optionStyle(opt)} onClick={() => handleSelect(opt)}>
            <span className="flex items-center justify-between gap-2">
              {opt}
              {isAnswered && opt === exercise.correctAnswer && (
                <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {isAnswered && opt === selected && opt !== exercise.correctAnswer && (
                <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </span>
          </button>
        ))}
      </div>
      {isAnswered && (
        <div
          className={`rounded-xl px-4 py-3 text-[14px] font-medium ${
            selected === exercise.correctAnswer
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {selected === exercise.correctAnswer
            ? '✓ ¡Correcto!'
            : `✗ La respuesta era: "${exercise.correctAnswer}"`}
          {exercise.explanation && (
            <p className="mt-1 text-[13px] opacity-80">{exercise.explanation}</p>
          )}
        </div>
      )}
    </div>
  );
}

function OrderSentenceExercise({
  exercise,
  onAnswer,
}: {
  exercise: ExerciseItem;
  onAnswer: (correct: boolean) => void;
}) {
  const [available, setAvailable] = useState<string[]>(() =>
    [...(exercise.options ?? [])].sort(() => Math.random() - 0.5)
  );
  const [sentence, setSentence] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const isCorrect = sentence.join(' ') === exercise.correctAnswer;

  function addWord(word: string, idx: number) {
    if (submitted) return;
    setSentence(s => [...s, word]);
    setAvailable(a => a.filter((_, i) => i !== idx));
  }

  function removeWord(word: string, idx: number) {
    if (submitted) return;
    setAvailable(a => [...a, word]);
    setSentence(s => s.filter((_, i) => i !== idx));
  }

  function handleSubmit() {
    if (!sentence.length || submitted) return;
    setSubmitted(true);
    onAnswer(isCorrect);
  }

  function handleReset() {
    setAvailable([...(exercise.options ?? [])].sort(() => Math.random() - 0.5));
    setSentence([]);
    setSubmitted(false);
  }

  return (
    <div className="space-y-4">
      <div className="bg-[#F0F5FF] rounded-2xl p-5 border border-[#DDE6F5]">
        <p className="text-[16px] font-semibold text-[#1D0084] leading-snug">{exercise.prompt}</p>
      </div>

      {/* Sentence area */}
      <div className="min-h-[52px] rounded-xl border-2 border-dashed border-[#DDE6F5] bg-white p-3 flex flex-wrap gap-2 items-center">
        {sentence.length === 0 && (
          <span className="text-[14px] text-[#9CA3AF]">Toca las palabras para ordenarlas...</span>
        )}
        {sentence.map((word, i) => (
          <button
            key={`${word}-${i}`}
            onClick={() => removeWord(word, i)}
            disabled={submitted}
            className="px-3 py-1.5 rounded-lg bg-[#1D0084] text-white text-[14px] font-medium hover:bg-[#025dc7] transition-colors duration-200 disabled:opacity-70"
          >
            {word}
          </button>
        ))}
      </div>

      {/* Available words */}
      <div className="flex flex-wrap gap-2">
        {available.map((word, i) => (
          <button
            key={`${word}-${i}`}
            onClick={() => addWord(word, i)}
            disabled={submitted}
            className="px-3 py-1.5 rounded-lg bg-[#F0F5FF] border border-[#DDE6F5] text-[#1D0084] text-[14px] font-medium hover:border-[#025dc7]/40 hover:bg-[#e8f0ff] transition-colors duration-200 disabled:opacity-50"
          >
            {word}
          </button>
        ))}
      </div>

      {!submitted ? (
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="px-4 py-3 rounded-xl bg-[#F0F5FF] text-[#5A6480] text-[14px] font-semibold border border-[#DDE6F5] hover:bg-[#e0eaff] transition-colors duration-200"
          >
            Reiniciar
          </button>
          <button
            onClick={handleSubmit}
            disabled={sentence.length === 0}
            className="flex-1 py-3 rounded-xl bg-[#1D0084] text-white text-[14px] font-semibold hover:bg-[#025dc7] transition-colors duration-200 disabled:opacity-40 disabled:pointer-events-none"
          >
            Comprobar
          </button>
        </div>
      ) : (
        <div
          className={`rounded-xl px-4 py-3 text-[14px] font-medium ${
            isCorrect
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {isCorrect
            ? '✓ ¡Correcto!'
            : `✗ La frase correcta era: "${exercise.correctAnswer}"`}
        </div>
      )}
    </div>
  );
}

function PracticeSection({
  exercises,
  onComplete,
  onError,
}: {
  exercises: ExerciseItem[];
  onComplete: (score: number, errorIds: string[]) => void;
  onError?: (id: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [errorIds, setErrorIds] = useState<string[]>([]);
  const [key, setKey] = useState(0);

  const exercise = exercises[index];

  function handleAnswer(correct: boolean) {
    setAnswered(true);
    if (correct) {
      setScore(s => s + 1);
    } else {
      setErrorIds(e => [...e, exercise.id]);
      onError?.(exercise.id);
    }
  }

  function handleNext() {
    if (index + 1 >= exercises.length) {
      onComplete(score + (answered && exercises[index] && errorIds[errorIds.length - 1] !== exercise.id ? 0 : 0), errorIds);
      // recalculate final score
      onComplete(score, errorIds);
    } else {
      setIndex(i => i + 1);
      setAnswered(false);
      setKey(k => k + 1);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <ProgressBar current={index + 1} total={exercises.length} label="Ejercicios" />
        <span className="shrink-0 text-[13px] font-semibold text-[#025dc7] bg-[#F0F5FF] px-3 py-1 rounded-full">
          {score} ✓
        </span>
      </div>

      <div key={key} className="w-full max-w-sm mx-auto">
        {exercise.type === 'multiple_choice' && (
          <MultipleChoiceExercise exercise={exercise} onAnswer={handleAnswer} />
        )}
        {exercise.type === 'write_answer' && (
          <WriteAnswerExercise exercise={exercise} onAnswer={handleAnswer} />
        )}
        {exercise.type === 'listen_and_choose' && (
          <ListenAndChooseExercise exercise={exercise} onAnswer={handleAnswer} />
        )}
        {exercise.type === 'order_sentence' && (
          <OrderSentenceExercise exercise={exercise} onAnswer={handleAnswer} />
        )}
      </div>

      {answered && (
        <button
          onClick={handleNext}
          className="w-full max-w-sm mx-auto flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#1D0084] text-white text-[15px] font-semibold hover:bg-[#025dc7] transition-colors duration-200"
        >
          {index + 1 < exercises.length ? (
            <>
              Siguiente
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </>
          ) : (
            <>
              Ver resumen
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </>
          )}
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   DIALOGUE SECTION
───────────────────────────────────────────────────────────────────────────── */

function DialogueSection({
  dialogue,
  onComplete,
}: {
  dialogue: Dialogue;
  onComplete: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [perLine, setPerLine] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  function toggleLine(id: string) {
    setPerLine(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const speakerColors: Record<string, string> = {};
  const colorList = ['#1D0084', '#025dc7', '#0b4db5', '#0a3d9e', '#1440a0'];
  dialogue.lines.forEach(line => {
    if (!speakerColors[line.speaker]) {
      const idx = Object.keys(speakerColors).length % colorList.length;
      speakerColors[line.speaker] = colorList[idx];
    }
  });

  return (
    <div className="space-y-6">
      {dialogue.audio?.url && (
        <AudioPlayer src={dialogue.audio.url} title={`Audio: ${dialogue.title}`} />
      )}

      <div className="bg-[#F0F5FF] rounded-2xl p-4 border border-[#DDE6F5]">
        <h3
          className="text-[16px] font-bold text-[#1D0084] mb-1"
          style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
        >
          {dialogue.title}
        </h3>
        <p className="text-[13px] text-[#5A6480]">{dialogue.context}</p>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => setShowAll(s => !s)}
          className="text-[13px] font-semibold text-[#025dc7] hover:text-[#1D0084] transition-colors duration-200"
        >
          {showAll ? 'Ocultar traducciones' : 'Mostrar todas las traducciones'}
        </button>
      </div>

      <div className="space-y-3">
        {dialogue.lines.map(line => {
          const color = speakerColors[line.speaker] ?? '#1D0084';
          const show = showAll || perLine.has(line.id);
          return (
            <div key={line.id} className="bg-white rounded-2xl border border-[#DDE6F5] p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full text-white"
                  style={{ background: color }}
                >
                  {line.speaker}
                </span>
                <button
                  onClick={() => speakDutch(line.dutch)}
                  className="w-7 h-7 rounded-full bg-[#F0F5FF] border border-[#DDE6F5] flex items-center justify-center text-[#025dc7] hover:bg-[#e0eaff] transition-colors duration-200"
                  aria-label="Escuchar"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728" />
                  </svg>
                </button>
              </div>
              <p className="text-[15px] font-medium text-[#1D0084] leading-snug">{line.dutch}</p>
              {show ? (
                <p className="text-[13px] text-[#5A6480] leading-snug">{line.spanish}</p>
              ) : (
                <button
                  onClick={() => toggleLine(line.id)}
                  className="text-[12px] text-[#9CA3AF] hover:text-[#025dc7] transition-colors duration-200"
                >
                  Ver traducción
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div ref={bottomRef} />

      <button
        onClick={onComplete}
        className="w-full py-3.5 rounded-xl bg-[#1D0084] text-white text-[15px] font-semibold hover:bg-[#025dc7] transition-colors duration-200"
      >
        He leído el diálogo →
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   REVIEW SECTION
───────────────────────────────────────────────────────────────────────────── */

function ReviewSection({
  lesson,
  practiceScore,
  practiceTotal,
  errorIds,
  nextLesson,
  moduleId,
  onRetryPractice,
}: {
  lesson: Lesson;
  practiceScore: number;
  practiceTotal: number;
  errorIds: string[];
  nextLesson?: Lesson | null;
  moduleId: string;
  onRetryPractice: () => void;
}) {
  const pct = practiceTotal === 0 ? 100 : Math.round((practiceScore / practiceTotal) * 100);
  const message =
    pct >= 90
      ? '¡Excelente! Dominas esta lección.'
      : pct >= 70
      ? '¡Muy bien! Sigue practicando.'
      : pct >= 50
      ? '¡Buen intento! Un poco más de práctica.'
      : 'No te rindas, la práctica hace al maestro.';

  // Collect wrong exercises
  const practiceBlock = lesson.blocks.find(b => b.type === 'practice');
  const wrongExercises =
    practiceBlock && practiceBlock.type === 'practice'
      ? practiceBlock.exercises.filter(e => errorIds.includes(e.id))
      : [];

  return (
    <div className="space-y-8">
      {/* Score card */}
      <div
        className="relative flex flex-col items-center justify-center rounded-2xl py-10 px-6 gap-4 overflow-hidden"
        style={{ background: '#1D0084' }}
      >
        <div aria-hidden className="absolute inset-0 dots-dark pointer-events-none" />
        <div className="relative text-center space-y-3">
          <span className="text-6xl">
            {pct >= 90 ? '🏆' : pct >= 70 ? '🌟' : pct >= 50 ? '💪' : '📚'}
          </span>
          {practiceTotal > 0 ? (
            <div>
              <p className="text-white/60 text-[13px] font-medium mb-1">Tu resultado en práctica</p>
              <p
                className="text-[48px] font-bold text-white leading-none"
                style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
              >
                {practiceScore}
                <span className="text-[#4da3ff]">/{practiceTotal}</span>
              </p>
            </div>
          ) : (
            <p className="text-white/60 text-[14px]">¡Lección completada!</p>
          )}
          {practiceTotal > 0 && <Stars score={practiceScore} total={practiceTotal} />}
        </div>
      </div>

      <p className="text-[16px] text-[#374151] font-medium text-center">{message}</p>

      {/* Wrong exercises */}
      {wrongExercises.length > 0 && (
        <div className="space-y-3">
          <h3
            className="text-[15px] font-bold text-[#1D0084]"
            style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
          >
            Ejercicios para repasar
          </h3>
          {wrongExercises.map(ex => (
            <div key={ex.id} className="bg-[#FFF5F5] rounded-xl border border-red-100 p-4">
              <p className="text-[13px] text-[#5A6480] mb-1">{ex.prompt}</p>
              <p className="text-[15px] font-semibold text-[#1D0084]">✓ {ex.correctAnswer}</p>
              {ex.explanation && (
                <p className="text-[12px] text-[#9CA3AF] mt-1">{ex.explanation}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3">
        {practiceTotal > 0 && (
          <button
            onClick={onRetryPractice}
            className="w-full py-3.5 rounded-xl bg-[#F0F5FF] text-[#1D0084] text-[15px] font-semibold hover:bg-[#e0eaff] transition-colors duration-200 border border-[#DDE6F5]"
          >
            Repetir práctica
          </button>
        )}
        {nextLesson && (
          <Link
            href={`/modulo/${nextLesson.moduleId}/leccion/${nextLesson.id}`}
            className="block w-full py-3.5 rounded-xl bg-[#1D0084] text-white text-[15px] font-semibold text-center hover:bg-[#025dc7] transition-colors duration-200"
          >
            Siguiente lección →
          </Link>
        )}
        <Link
          href={`/modulo/${moduleId}`}
          className="block w-full py-3.5 rounded-xl text-[#025dc7] text-[15px] font-semibold text-center hover:bg-[#F0F5FF] transition-colors duration-200"
        >
          ← Volver al módulo
        </Link>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN LESSON VIEWER
───────────────────────────────────────────────────────────────────────────── */

interface LessonViewerProps {
  lesson: Lesson;
  module: CourseModule;
  prevLesson?: Lesson | null;
  nextLesson?: Lesson | null;
}

export default function LessonViewer({ lesson, module, prevLesson: _prev, nextLesson }: LessonViewerProps) {
  // Derive available tabs from block types
  const availableTabs = useCallback((): TabId[] => {
    const tabs: TabId[] = [];
    for (const block of lesson.blocks) {
      if (!tabs.includes(block.type as TabId)) tabs.push(block.type as TabId);
    }
    return tabs;
  }, [lesson.blocks]);

  const tabs = availableTabs();
  const [activeTab, setActiveTab] = useState<TabId>(tabs[0] ?? 'vocabulary');
  const [completedTabs, setCompletedTabs] = useState<Set<TabId>>(new Set());
  const [practiceScore, setPracticeScore] = useState(0);
  const [practiceTotal, setPracticeTotal] = useState(0);
  const [errorIds, setErrorIds] = useState<string[]>([]);
  const [practiceDone, setPracticeDone] = useState(false);
  const [practiceKey, setPracticeKey] = useState(0);
  const reviewMarked = useRef(false);

  useEffect(() => {
    markLessonStarted(lesson.id, lesson.moduleId);
    const existing = getLessonProgress(lesson.id);
    if (existing) {
      setPracticeScore(existing.score ?? 0);
      setPracticeTotal(existing.total ?? 0);
      setErrorIds(existing.errorIds ?? []);
    }
  }, [lesson.id, lesson.moduleId]);

  function completeTab(tab: TabId) {
    setCompletedTabs(prev => {
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
    // Advance to next tab
    const idx = tabs.indexOf(tab);
    if (idx >= 0 && idx < tabs.length - 1) {
      setActiveTab(tabs[idx + 1]);
    }
  }

  function handlePracticeComplete(score: number, errors: string[]) {
    setPracticeScore(score);
    const practiceBlock = lesson.blocks.find(b => b.type === 'practice');
    const total =
      practiceBlock && practiceBlock.type === 'practice'
        ? practiceBlock.exercises.length
        : 0;
    setPracticeTotal(total);
    setErrorIds(errors);
    setPracticeDone(true);
    updateLessonProgress({
      lessonId: lesson.id,
      moduleId: lesson.moduleId,
      status: 'in_progress',
      score,
      total,
      errorIds: errors,
    });
    completeTab('practice');
  }

  function handleRetryPractice() {
    setPracticeDone(false);
    setErrorIds([]);
    setPracticeScore(0);
    setPracticeTotal(0);
    setPracticeKey(k => k + 1);
    setActiveTab('practice');
    setCompletedTabs(prev => {
      const next = new Set(prev);
      next.delete('practice');
      next.delete('review');
      return next;
    });
  }

  // Mark lesson completed when review tab is visited
  useEffect(() => {
    if (activeTab === 'review' && !reviewMarked.current) {
      reviewMarked.current = true;
      markLessonCompleted(lesson.id, lesson.moduleId, practiceScore, practiceTotal, errorIds);
      setCompletedTabs(prev => {
        const next = new Set(prev);
        next.add('review');
        return next;
      });
    }
  }, [activeTab, lesson.id, lesson.moduleId, practiceScore, practiceTotal, errorIds]);

  const vocabBlock = lesson.blocks.find(b => b.type === 'vocabulary');
  const phraseBlock = lesson.blocks.find(b => b.type === 'phrases');
  const practiceBlock = lesson.blocks.find(b => b.type === 'practice');
  const dialogueBlock = lesson.blocks.find(b => b.type === 'dialogue');

  return (
    <>
      {/* ── Header ── */}
      <div className="relative bg-[#1D0084] overflow-hidden">
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-[-5%] left-1/2 -translate-x-1/2 w-[700px] h-[500px]"
            style={{ background: 'radial-gradient(ellipse at center, rgba(11,109,240,0.30) 0%, transparent 65%)' }}
          />
        </div>
        <div aria-hidden className="absolute inset-0 dots-dark pointer-events-none" />

        <div className="relative max-w-2xl mx-auto px-6 pt-8 pb-8">
          <Link
            href={`/modulo/${module.id}`}
            className="inline-flex items-center gap-2 text-[13px] text-white/50 hover:text-white/80 transition-colors duration-200 mb-5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
            </svg>
            {module.title}
          </Link>

          <div className="flex items-start gap-3">
            <span className="text-4xl">{module.emoji}</span>
            <div>
              <h1
                className="text-[24px] font-bold text-white leading-tight"
                style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
              >
                {lesson.title}
              </h1>
              <p className="text-[13px] text-white/50 mt-0.5">
                {lesson.subtitle} · {lesson.estimatedMinutes} min
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="bg-white border-b border-[#DDE6F5] sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-6 flex overflow-x-auto">
          {tabs.map(tab => {
            const isDone = completedTabs.has(tab);
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative py-4 px-4 text-[13px] font-semibold transition-colors duration-200 whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  activeTab === tab ? 'text-[#1D0084]' : 'text-[#9CA3AF] hover:text-[#5A6480]'
                }`}
              >
                {isDone && (
                  <svg className="w-3.5 h-3.5 text-[#4da3ff] shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.59L5.41 12 6.83 10.58 10 13.75l7.17-7.17 1.41 1.42L10 16.59z" />
                  </svg>
                )}
                {TAB_LABELS[tab]}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1D0084] rounded-t-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="bg-white min-h-[70vh] py-10 pb-20">
        <div className="max-w-2xl mx-auto px-6">

          {/* VOCABULARY */}
          {activeTab === 'vocabulary' && vocabBlock && vocabBlock.type === 'vocabulary' && (
            <VocabularySection
              items={vocabBlock.items}
              onComplete={() => completeTab('vocabulary')}
            />
          )}

          {/* PHRASES */}
          {activeTab === 'phrases' && phraseBlock && phraseBlock.type === 'phrases' && (
            <PhrasesSection
              items={phraseBlock.items}
              onComplete={() => completeTab('phrases')}
            />
          )}

          {/* PRACTICE */}
          {activeTab === 'practice' && practiceBlock && practiceBlock.type === 'practice' && (
            <PracticeSection
              key={practiceKey}
              exercises={practiceBlock.exercises}
              onComplete={handlePracticeComplete}
            />
          )}

          {/* DIALOGUE */}
          {activeTab === 'dialogue' && dialogueBlock && dialogueBlock.type === 'dialogue' && (
            <DialogueSection
              dialogue={dialogueBlock.dialogue}
              onComplete={() => completeTab('dialogue')}
            />
          )}

          {/* REVIEW */}
          {activeTab === 'review' && (
            <ReviewSection
              lesson={lesson}
              practiceScore={practiceScore}
              practiceTotal={practiceTotal}
              errorIds={errorIds}
              nextLesson={nextLesson}
              moduleId={module.id}
              onRetryPractice={handleRetryPractice}
            />
          )}
        </div>
      </div>
    </>
  );
}
