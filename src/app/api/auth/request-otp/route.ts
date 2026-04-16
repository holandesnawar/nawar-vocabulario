import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * POST /api/auth/request-otp
 * Body: { email: string }
 *
 * 1. Valida formato del email.
 * 2. Comprueba que el email pertenece a un alumno ACTIVO (lista blanca).
 * 3. Si lo está, dispara el envío del OTP por email.
 * 4. Si no, devuelve un error claro sin revelar si el email existe.
 *
 * Al hacerse todo en el servidor, nadie puede disparar envíos de OTP
 * a direcciones no autorizadas desde las devtools del navegador.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const emailRaw = typeof body?.email === 'string' ? body.email : '';
    const email = emailRaw.trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Email no válido.' },
        { status: 400 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Servidor mal configurado (falta SERVICE_ROLE_KEY).' },
        { status: 500 }
      );
    }

    // 1. Whitelist check
    const { data: alumno, error: lookupError } = await supabaseAdmin
      .from('alumnos')
      .select('email, activo')
      .eq('email', email)
      .maybeSingle();

    if (lookupError) {
      console.error('[request-otp] whitelist lookup error:', lookupError);
      return NextResponse.json(
        { error: 'No se pudo verificar el acceso. Inténtalo de nuevo.' },
        { status: 500 }
      );
    }

    if (!alumno || !alumno.activo) {
      // Mismo mensaje tanto si no existe como si está inactivo,
      // para no filtrar información sobre quién tiene cuenta.
      return NextResponse.json(
        {
          error:
            'Este email no está autorizado. Si crees que es un error, contacta con Rida.',
        },
        { status: 403 }
      );
    }

    // 2. Send OTP
    const supabase = await createSupabaseServerClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // El usuario de auth se crea en Supabase si no existe,
        // pero ya hemos verificado que está en nuestra tabla alumnos.
        shouldCreateUser: true,
      },
    });

    if (otpError) {
      console.error('[request-otp] OTP send error:', otpError);
      return NextResponse.json(
        { error: 'No se pudo enviar el código. Inténtalo de nuevo en 1 minuto.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[request-otp] unexpected error:', err);
    return NextResponse.json(
      { error: 'Error inesperado. Inténtalo de nuevo.' },
      { status: 500 }
    );
  }
}
