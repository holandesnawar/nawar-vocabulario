"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import type { Woordenlijst, Word, Exercise } from "@/lib/vocabulario";
import { generateExercises } from "@/lib/vocabulario";

/* ─────────────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────────────── */

function speakDutch(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "nl-NL";
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
          className={`w-7 h-7 ${i < stars ? "text-[#4da3ff]" : "text-[#DDE6F5]"}`}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   PROGRESS BAR
───────────────────────────────────────────────────────────────────────────── */

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
   LEARN CARD
───────────────────────────────────────────────────────────────────────────── */

function LearnCard({ word }: { word: Word }) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* Emoji visual */}
      <div
        className="relative flex items-center justify-center rounded-2xl mb-4 overflow-hidden"
        style={{ background: word.color, height: 200 }}
      >
        <span className="text-[80px] select-none" style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.25))" }}>
          {word.emoji}
        </span>

        {/* Article badge */}
        {word.article && (
          <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-white text-[12px] font-bold">
            {word.article}
          </div>
        )}

        {/* Audio button */}
        <button
          onClick={() => speakDutch((word.article ? `${word.article} ` : "") + word.dutch)}
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/25 transition-colors duration-200"
          aria-label="Escuchar pronunciación"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M12 6v12m0 0l-3-3m3 3l3-3M6.343 9.657a8 8 0 000 4.686" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9v6" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 11.5v1" />
          </svg>
        </button>
      </div>

      {/* Word info */}
      <div className="bg-white rounded-2xl border border-[#DDE6F5] p-6 space-y-4">
        <div>
          <h2
            className="text-[32px] font-bold text-[#1D0084] leading-none"
            style={{ fontFamily: "var(--font-poppins), system-ui, sans-serif" }}
          >
            {word.dutch}
          </h2>
          <p className="text-[18px] text-[#5A6480] mt-1">{word.spanish}</p>
        </div>

        {/* Example */}
        <button
          onClick={() => setFlipped(f => !f)}
          className="w-full text-left rounded-xl bg-[#F0F5FF] px-4 py-3 border border-[#DDE6F5] hover:border-[#025dc7]/30 transition-colors duration-200 group"
        >
          <p className="text-[12px] font-semibold text-[#9CA3AF] mb-1 group-hover:text-[#025dc7] transition-colors duration-200">
            Ejemplo {flipped ? "↑" : "↓"}
          </p>
          <p className="text-[14px] text-[#1D0084] font-medium leading-snug">{word.example_nl}</p>
          {flipped && (
            <p className="text-[13px] text-[#5A6480] mt-1 leading-snug">{word.example_es}</p>
          )}
        </button>

        {/* Speak example */}
        <button
          onClick={() => speakDutch(word.example_nl)}
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
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   EXERCISE CARD
───────────────────────────────────────────────────────────────────────────── */

function ExerciseCard({
  exercise,
  onAnswer,
}: {
  exercise: Exercise;
  onAnswer: (correct: boolean) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const isAnswered = selected !== null;

  function handleSelect(option: string) {
    if (isAnswered) return;
    setSelected(option);
    onAnswer(option === exercise.correctAnswer);
  }

  function optionStyle(option: string): string {
    const base = "w-full text-left px-4 py-3.5 rounded-xl text-[15px] font-medium transition-all duration-200 border ";
    if (!isAnswered) {
      return base + "bg-[#F0F5FF] border-[#DDE6F5] text-[#1D0084] hover:border-[#025dc7]/40 hover:bg-[#e8f0ff] active:scale-[0.98]";
    }
    if (option === exercise.correctAnswer) return base + "bg-green-50 border-green-400 text-green-800";
    if (option === selected) return base + "bg-red-50 border-red-400 text-red-700";
    return base + "bg-[#F8F9FA] border-[#DDE6F5] text-[#9CA3AF]";
  }

  const question =
    exercise.type === "word_to_translation"
      ? `¿Cómo se dice "${exercise.word.dutch}" en español?`
      : `¿Cómo se dice "${exercise.word.spanish}" en neerlandés?`;

  return (
    <div className="w-full max-w-sm mx-auto space-y-5">
      {/* Question card */}
      <div
        className="flex flex-col items-center justify-center rounded-2xl py-8 px-6 text-center gap-3"
        style={{ background: exercise.word.color }}
      >
        <span className="text-5xl">{exercise.word.emoji}</span>
        <p className="text-white/80 text-[14px] font-medium leading-snug">{question}</p>
      </div>

      {/* Options */}
      <div className="grid grid-cols-1 gap-2.5">
        {exercise.options.map((option) => (
          <button key={option} className={optionStyle(option)} onClick={() => handleSelect(option)}>
            <span className="flex items-center justify-between gap-2">
              {option}
              {isAnswered && option === exercise.correctAnswer && (
                <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {isAnswered && option === selected && option !== exercise.correctAnswer && (
                <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </span>
          </button>
        ))}
      </div>

      {/* Feedback */}
      {isAnswered && (
        <div className={`rounded-xl px-4 py-3 text-[14px] font-medium ${
          selected === exercise.correctAnswer
            ? "bg-green-50 text-green-800 border border-green-200"
            : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {selected === exercise.correctAnswer
            ? "✓ ¡Correcto!"
            : `✗ La respuesta era: "${exercise.correctAnswer}"`}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   RESULTS SCREEN
───────────────────────────────────────────────────────────────────────────── */

function ResultsScreen({
  score,
  total,
  onRetry,
  onLearn,
}: {
  score: number;
  total: number;
  onRetry: () => void;
  onLearn: () => void;
}) {
  const pct = total === 0 ? 0 : Math.round((score / total) * 100);
  const message =
    pct >= 90 ? "¡Excelente! Dominas esta lista."
    : pct >= 70 ? "¡Muy bien! Sigue practicando."
    : pct >= 50 ? "¡Buen intento! Un poco más de práctica."
    : "No te rindas, la práctica hace al maestro.";

  return (
    <div className="w-full max-w-sm mx-auto text-center space-y-6 py-4">
      <div
        className="flex flex-col items-center justify-center rounded-2xl py-10 px-6 gap-4"
        style={{ background: '#1D0084' }}
      >
        <span className="text-6xl">
          {pct >= 90 ? "🏆" : pct >= 70 ? "🌟" : pct >= 50 ? "💪" : "📚"}
        </span>
        <div>
          <p className="text-white/60 text-[13px] font-medium mb-1">Tu resultado</p>
          <p
            className="text-[48px] font-bold text-white leading-none"
            style={{ fontFamily: "var(--font-poppins), system-ui, sans-serif" }}
          >
            {score}<span className="text-[#4da3ff]">/{total}</span>
          </p>
        </div>
        <Stars score={score} total={total} />
      </div>

      <p className="text-[16px] text-[#374151] font-medium">{message}</p>

      <div className="space-y-3">
        <button
          onClick={onRetry}
          className="w-full py-3.5 rounded-xl bg-[#1D0084] text-white text-[15px] font-semibold hover:bg-[#025dc7] transition-colors duration-200"
        >
          Repetir práctica
        </button>
        <button
          onClick={onLearn}
          className="w-full py-3.5 rounded-xl bg-[#F0F5FF] text-[#1D0084] text-[15px] font-semibold hover:bg-[#e0eaff] transition-colors duration-200 border border-[#DDE6F5]"
        >
          Volver a las palabras
        </button>
        <Link
          href="/"
          className="block w-full py-3.5 rounded-xl text-[#025dc7] text-[15px] font-semibold hover:bg-[#F0F5FF] transition-colors duration-200"
        >
          Ver más listas
        </Link>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   PRACTICE PHASE
───────────────────────────────────────────────────────────────────────────── */

function PracticePhase({
  exercise,
  exerciseIndex,
  totalExercises,
  score,
  onAnswer,
  onNext,
}: {
  exercise: Exercise;
  exerciseIndex: number;
  totalExercises: number;
  score: number;
  onAnswer: (correct: boolean) => void;
  onNext: () => void;
}) {
  const [answered, setAnswered] = useState(false);

  function handleAnswer(correct: boolean) {
    setAnswered(true);
    onAnswer(correct);
  }

  const typeLabel =
    exercise.type === "word_to_translation" ? "Neerlandés → Español" : "Español → Neerlandés";

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <ProgressBar current={exerciseIndex + 1} total={totalExercises} label={typeLabel} />
        <span className="shrink-0 text-[13px] font-semibold text-[#025dc7] bg-[#F0F5FF] px-3 py-1 rounded-full">
          {score} ✓
        </span>
      </div>

      <ExerciseCard exercise={exercise} onAnswer={handleAnswer} />

      {answered && (
        <button
          onClick={onNext}
          className="w-full max-w-sm mx-auto flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#1D0084] text-white text-[15px] font-semibold hover:bg-[#025dc7] transition-colors duration-200"
        >
          {exerciseIndex + 1 < totalExercises ? (
            <>
              Siguiente
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </>
          ) : (
            <>
              Ver resultado
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
   MAIN COMPONENT
───────────────────────────────────────────────────────────────────────────── */

type Phase = "learn" | "practice" | "results";

export default function WordlistViewer({ list }: { list: Woordenlijst }) {
  const [phase, setPhase] = useState<Phase>("learn");
  const [learnIndex, setLearnIndex] = useState(0);
  const [exercises, setExercises] = useState<Exercise[]>(() => generateExercises(list.words));
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [score, setScore] = useState(0);

  const currentWord = list.words[learnIndex];
  const currentExercise = exercises[exerciseIndex];

  const startPractice = useCallback(() => {
    setExercises(generateExercises(list.words));
    setExerciseIndex(0);
    setScore(0);
    setPhase("practice");
  }, [list.words]);

  const retryPractice = useCallback(() => {
    setExercises(generateExercises(list.words));
    setExerciseIndex(0);
    setScore(0);
    setPhase("practice");
  }, [list.words]);

  const backToLearn = useCallback(() => {
    setLearnIndex(0);
    setPhase("learn");
  }, []);

  function handleAnswer(correct: boolean) {
    if (correct) setScore(s => s + 1);
  }

  function nextExercise() {
    if (exerciseIndex + 1 >= exercises.length) {
      setPhase("results");
    } else {
      setExerciseIndex(i => i + 1);
    }
  }

  const tabs: { id: Phase; label: string }[] = [
    { id: "learn",    label: "Aprender" },
    { id: "practice", label: "Practicar" },
  ];

  return (
    <>
      {/* ── Header ── */}
      <div className="relative bg-[#1D0084] overflow-hidden">
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-[-5%] left-1/2 -translate-x-1/2 w-[700px] h-[500px]"
            style={{ background: "radial-gradient(ellipse at center, rgba(11,109,240,0.30) 0%, transparent 65%)" }}
          />
        </div>
        <div aria-hidden className="absolute inset-0 dots-dark pointer-events-none" />

        <div className="relative max-w-2xl mx-auto px-6 pt-8 pb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[13px] text-white/50 hover:text-white/80 transition-colors duration-200 mb-5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
            </svg>
            Listas
          </Link>

          <div className="flex items-center gap-3">
            <span className="text-4xl">{list.emoji}</span>
            <div>
              <h1
                className="text-[24px] font-bold text-white leading-tight"
                style={{ fontFamily: "var(--font-poppins), system-ui, sans-serif" }}
              >
                {list.title}
              </h1>
              <p className="text-[13px] text-white/50">{list.subtitle} · {list.words.length} palabras · {list.level}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab bar ── */}
      {phase !== "results" && (
        <div className="bg-white border-b border-[#DDE6F5] sticky top-0 z-40">
          <div className="max-w-2xl mx-auto px-6 flex">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === "practice") startPractice();
                  else backToLearn();
                }}
                className={`relative py-4 px-6 text-[14px] font-semibold transition-colors duration-200 ${
                  phase === tab.id ? "text-[#1D0084]" : "text-[#9CA3AF] hover:text-[#5A6480]"
                }`}
              >
                {tab.label}
                {phase === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1D0084] rounded-t-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Content ── */}
      <div className="bg-white min-h-[70vh] py-10 pb-20">
        <div className="max-w-2xl mx-auto px-6">

          {/* LEARN PHASE */}
          {phase === "learn" && (
            <div className="space-y-8">
              <ProgressBar current={learnIndex + 1} total={list.words.length} label="Palabras" />

              <LearnCard key={currentWord.id} word={currentWord} />

              <div className="flex items-center justify-between gap-4">
                <button
                  onClick={() => setLearnIndex(i => Math.max(0, i - 1))}
                  disabled={learnIndex === 0}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#F0F5FF] text-[#1D0084] text-[14px] font-semibold border border-[#DDE6F5] hover:bg-[#e0eaff] transition-colors duration-200 disabled:opacity-30 disabled:pointer-events-none"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Anterior
                </button>

                {/* Dots */}
                <div className="flex items-center gap-1.5 flex-wrap justify-center max-w-[160px]">
                  {list.words.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setLearnIndex(i)}
                      className={`rounded-full transition-all duration-200 ${
                        i === learnIndex
                          ? "w-5 h-2 bg-[#1D0084]"
                          : i < learnIndex
                          ? "w-2 h-2 bg-[#4da3ff]"
                          : "w-2 h-2 bg-[#DDE6F5]"
                      }`}
                      aria-label={`Ir a palabra ${i + 1}`}
                    />
                  ))}
                </div>

                {learnIndex < list.words.length - 1 ? (
                  <button
                    onClick={() => setLearnIndex(i => i + 1)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1D0084] text-white text-[14px] font-semibold hover:bg-[#025dc7] transition-colors duration-200"
                  >
                    Siguiente
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={startPractice}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#4da3ff] text-[#0a1a4a] text-[14px] font-semibold hover:bg-[#3391f0] transition-colors duration-200"
                  >
                    Practicar
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* PRACTICE PHASE */}
          {phase === "practice" && currentExercise && (
            <PracticePhase
              key={exerciseIndex}
              exercise={currentExercise}
              exerciseIndex={exerciseIndex}
              totalExercises={exercises.length}
              score={score}
              onAnswer={handleAnswer}
              onNext={nextExercise}
            />
          )}

          {/* RESULTS PHASE */}
          {phase === "results" && (
            <ResultsScreen
              score={score}
              total={exercises.length}
              onRetry={retryPractice}
              onLearn={backToLearn}
            />
          )}
        </div>
      </div>
    </>
  );
}
