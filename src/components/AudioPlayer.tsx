'use client';

import { useRef, useState, useCallback } from 'react';

interface AudioPlayerProps {
  src?: string;
  title?: string;
  compact?: boolean;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function AudioPlayer({ src, title, compact = false }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasError, setHasError] = useState(false);

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => setHasError(true));
    }
  }, [isPlaying]);

  const handleRewind = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, audio.currentTime - 10);
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const value = Number(e.target.value);
    audio.currentTime = value;
    setCurrentTime(value);
  }, []);

  if (!src) {
    return (
      <div
        className={`flex items-center gap-3 rounded-2xl bg-[#1D0084] px-5 py-4 ${compact ? '' : 'w-full'}`}
      >
        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M12 6v12M18.364 5.636a9 9 0 010 12.728" />
          </svg>
        </div>
        <span className="text-[13px] text-white/40 font-medium">Audio próximamente</span>
      </div>
    );
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`rounded-2xl bg-[#1D0084] overflow-hidden ${compact ? '' : 'w-full'}`}>
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
          {title && (
            <p className="text-[12px] font-semibold text-white/50 truncate">{title}</p>
          )}
          <div className="flex items-center gap-3">
            {/* Rewind -10s */}
            <button
              onClick={handleRewind}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors duration-200 shrink-0"
              aria-label="Retroceder 10 segundos"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.5 3C8 3 4.2 6.4 3.5 10.9L2 9.4l-1.4 1.4 3.5 3.5 3.5-3.5-1.4-1.4-1.4 1.4C5.2 7.5 8.5 5 12.5 5c3.9 0 7 3.1 7 7s-3.1 7-7 7c-2.9 0-5.5-1.8-6.5-4.5l-1.9.7C5.3 18.5 8.7 21 12.5 21c5 0 9-4 9-9s-4-9-9-9z"/>
                <text x="8.5" y="15.5" fontSize="6" fill="currentColor" fontFamily="sans-serif" fontWeight="bold">10</text>
              </svg>
            </button>

            {/* Play/Pause */}
            <button
              onClick={handlePlayPause}
              className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-[#1D0084] hover:bg-[#F0F5FF] transition-colors duration-200 shrink-0 shadow-lg"
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

            {/* Progress and time */}
            <div className="flex-1 space-y-1">
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1 appearance-none rounded-full cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #4da3ff ${progress}%, rgba(255,255,255,0.2) ${progress}%)`,
                  accentColor: '#4da3ff',
                }}
                aria-label="Posición de reproducción"
              />
              <div className="flex justify-between text-[11px] text-white/40 font-medium">
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
