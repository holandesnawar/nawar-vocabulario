'use client';

import { useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type Stage = 'email' | 'otp';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('next') || '/';

  const [stage, setStage] = useState<Stage>('email');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleRequestOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Error al solicitar el código.');
        return;
      }
      setStage('otp');
      setInfo(
        'Te hemos enviado un código a tu email. Revisa también spam la primera vez.',
      );
    } catch {
      setError('Error de red. Comprueba tu conexión.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Código incorrecto.');
        return;
      }
      router.replace(redirectTo);
      router.refresh();
    } catch {
      setError('Error de red. Comprueba tu conexión.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Error al reenviar el código.');
        return;
      }
      setInfo('Te hemos reenviado un nuevo código.');
    } catch {
      setError('Error de red. Comprueba tu conexión.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-slate-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Vocabulario Nawar
        </h1>
        <p className="text-slate-600 text-sm mb-6">
          {stage === 'email'
            ? 'Introduce tu email para recibir un código de acceso.'
            : `Introduce el código que hemos enviado a ${email}.`}
        </p>

        {stage === 'email' ? (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu-email@ejemplo.com"
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-white font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Enviando…' : 'Recibir código'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label
                htmlFor="token"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Código de 6 dígitos
              </label>
              <input
                id="token"
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                required
                autoFocus
                autoComplete="one-time-code"
                value={token}
                onChange={(e) =>
                  setToken(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                placeholder="123456"
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-2xl tracking-widest text-center font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading || token.length !== 6}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-white font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Verificando…' : 'Entrar'}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setStage('email');
                  setToken('');
                  setError(null);
                  setInfo(null);
                }}
                className="text-slate-600 hover:text-slate-900"
              >
                ← Cambiar email
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={loading}
                className="text-indigo-600 hover:text-indigo-700 disabled:opacity-60"
              >
                Reenviar código
              </button>
            </div>
          </form>
        )}

        {info && (
          <p className="mt-4 text-sm text-slate-600 bg-slate-100 rounded-lg px-3 py-2">
            {info}
          </p>
        )}
        {error && (
          <p className="mt-4 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <p className="mt-6 text-xs text-slate-500 text-center">
          ¿No ves el email en 1 minuto? Revisa la carpeta de spam y marca el
          mensaje como «No es spam».
        </p>
      </div>
    </main>
  );
}
