import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Cliente Supabase para uso desde Server Components, API routes y server actions.
 * Lee/escribe cookies de sesión del navegador del usuario.
 *
 * NO usar desde Client Components — ahí usa createSupabaseBrowserClient.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Llamado desde un Server Component: no se pueden setear cookies.
            // El middleware se encarga de refrescarlas.
          }
        },
      },
    }
  );
}
