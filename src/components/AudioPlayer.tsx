'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

interface AudioPlayerProps {
  /** Audio source URL — only render this component when you have a real URL */
  src: string;
  /** Optional label shown above the controls (full variant only) */
  title?: string;
  /**
   * compact — slim one-line strip for vocabulary / phrase cards
   * default  — full dark-blue player for dialogues
   */
  compact?: boolean;
}

function formatTime(s: number): string {
  if (!isFinite(s) || isNaN(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function AudioPlayer({ src, title, compact = false }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasError, setHasError] = useState(false);

  // Reset when src changes so stale audio never keeps playing
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setHasError(false);
    audio.load();
  }, [src]);

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) { audio.pause(); } else { audio.play().catch(() => setHasError(true)); }
  }, [isPlaying]);

  const skip = useCallback((secs: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    // El bug anterior: si audio.duration aún era NaN (no había cargado metadata),
    // `|| 0` devolvía 0 y Math.min(X, 0) mandaba currentTime al 0 siempre. Ahora
    // usamos una cota alta segura y el navegador la clampa internamente a la
    // duración real cuando reproduce.
    const upperBound = isFinite(audio.duration) && audio.duration > 0
      ? audio.duration
      : Number.MAX_SAFE_INTEGER;
    audio.currentTime = Math.max(0, Math.min(audio.currentTime + secs, upperBound));
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const v = Number(e.target.value);
    audio.currentTime = v;
    setCurrentTime(v);
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const skipSecs = 5;

  const sharedAudio = (
    <audio
      ref={audioRef}
      src={src}
      onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
      onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
      onEnded={() => setIsPlaying(false)}
      onPlay={() => setIsPlaying(true)}
      onPause={() => setIsPlaying(false)}
      onError={() => setHasError(true)}
      preload="metadata"
    />
  );

  /* ── COMPACT (vocabulary / phrases) ──────────────────────────────────────── */
  if (compact) {
    return (
      <div className="rounded-xl bg-[#F0F5FF] border border-[#DDE6F5] px-3 py-2">
        {sharedAudio}
        {hasError ? (
          <p className="text-[11px] text-red-400 text-center py-0.5">No se pudo cargar el audio</p>
        ) : (
          <div className="flex items-center gap-2">
            {/* Skip back */}
            <button
              onClick={() => skip(-skipSecs)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-[#1D0084]/60 hover:text-[#1D0084] hover:bg-[#DDE6F5] transition-colors shrink-0"
              aria-label={`Retroceder ${skipSecs}s`}
            >
              <span className="text-[10px] font-bold leading-none">-{skipSecs}s</span>
            </button>

            {/* Play / Pause */}
            <button
              onClick={handlePlayPause}
              className="w-8 h-8 rounded-full bg-[#1D0084] flex items-center justify-center text-white hover:bg-[#025dc7] transition-colors shrink-0 shadow-sm"
              aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
            >
              {isPlaying ? (
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg className="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Skip forward */}
            <button
              onClick={() => skip(skipSecs)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-[#1D0084]/60 hover:text-[#1D0084] hover:bg-[#DDE6F5] transition-colors shrink-0"
              aria-label={`Avanzar ${skipSecs}s`}
            >
              <span className="text-[10px] font-bold leading-none">+{skipSecs}s</span>
            </button>

            {/* Progress bar */}
            <div className="flex-1 min-w-0">
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1 appearance-none rounded-full cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #1D0084 ${progress}%, #DDE6F5 ${progress}%)`,
                  accentColor: '#1D0084',
                }}
                aria-label="Posición"
              />
            </div>

            {/* Time */}
            <span className="text-[11px] font-medium text-[#5A6480] tabular-nums shrink-0 whitespace-nowrap">
              {formatTime(currentTime)}{duration > 0 ? ` / ${formatTime(duration)}` : ''}
            </span>
          </div>
        )}
      </div>
    );
  }

  /* ── FULL (dialogues) ────────────────────────────────────────────────────── */
  return (
    <div className="rounded-2xl audio-player-glass overflow-hidden">
      {sharedAudio}
      {hasError ? (
        <div className="flex items-center gap-3 px-5 py-4">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 3h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
            </svg>
          </div>
          <span className="text-[13px] text-white/50">No se pudo cargar el audio</span>
        </div>
      ) : (
        <div className="px-5 py-4 space-y-3">
          {title && <p className="text-[12px] font-semibold text-white/50 truncate">{title}</p>}

          <div className="flex items-center gap-3">
            {/* Skip back */}
            <button
              onClick={() => skip(-skipSecs)}
              className="w-10 h-10 rounded-full bg-white/10 flex flex-col items-center justify-center text-white hover:bg-white/20 transition-colors shrink-0 gap-0.5"
              aria-label={`Retroceder ${skipSecs}s`}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
              </svg>
              <span className="text-[8px] font-bold leading-none opacity-70">{skipSecs}s</span>
            </button>

            {/* Play / Pause */}
            <button
              onClick={handlePlayPause}
              className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-[#1D0084] hover:bg-[#F0F5FF] transition-colors shrink-0 shadow-lg"
              aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
            >
              {isPlaying ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Skip forward */}
            <button
              onClick={() => skip(skipSecs)}
              className="w-10 h-10 rounded-full bg-white/10 flex flex-col items-center justify-center text-white hover:bg-white/20 transition-colors shrink-0 gap-0.5"
              aria-label={`Avanzar ${skipSecs}s`}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 18l8.5-6L6 6v12zM14.5 6v12l8.5-6-8.5-6z" />
              </svg>
              <span className="text-[8px] font-bold leading-none opacity-70">{skipSecs}s</span>
            </button>

            {/* Progress + time */}
            <div className="flex-1 space-y-1.5 min-w-0">
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1.5 appearance-none rounded-full cursor-pointer"
                style={{
                  background: `linear-gradient(to right, var(--player-fill, #4da3ff) ${progress}%, var(--player-empty, rgba(255,255,255,0.2)) ${progress}%)`,
                  accentColor: 'var(--player-fill, #4da3ff)',
                }}
                aria-label="Posición de reproducción"
              />
              <div className="flex justify-between text-[11px] text-white/40 font-medium tabular-nums">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
