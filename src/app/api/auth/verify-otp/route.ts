import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * POST /api/auth/verify-otp
 * Body: { email: string, token: string }
 *
 * Verifica el código de 6 dígitos que el alumno ha recibido por email.
 * Si es correcto, Supabase establece las cookies de sesión automáticamente
 * a través de createSupabaseServerClient.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = (typeof body?.email === 'string' ? body.email : '')
      .trim()
      .toLowerCase();
    const token = (typeof body?.token === 'string' ? body.token : '').trim();

    if (!email || !token) {
      return NextResponse.json(
        { error: 'Faltan datos (email o código).' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });

    if (error || !data.session) {
      return NextResponse.json(
        { error: 'Código incorrecto o caducado. Pide uno nuevo.' },
        { status: 401 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[verify-otp] unexpected error:', err);
    return NextResponse.json(
      { error: 'Error inesperado. Inténtalo de nuevo.' },
      { status: 500 }
    );
  }
}
