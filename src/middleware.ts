import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Middleware de autenticación.
 *
 * - Refresca la sesión de Supabase en cada petición (necesario con @supabase/ssr).
 * - Redirige a /login si el usuario no está autenticado.
 * - Excepciones: rutas públicas (/login, /api/auth/*), assets de Next, favicon.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rutas que no requieren sesión
  const isPublic =
    pathname === '/login' ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml';

  // Respuesta base que iremos mutando con las cookies actualizadas
  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            req.cookies.set(name, value),
          );
          res = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Esto refresca el access token si hace falta y actualiza cookies
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isPublic) {
    // Si ya está logueado y va a /login, lo mandamos al home
    if (user && pathname === '/login') {
      const url = req.nextUrl.clone();
      url.pathname = '/';
      url.searchParams.delete('next');
      return NextResponse.redirect(url);
    }
    return res;
  }

  // Ruta protegida sin sesión → redirigir a login
  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: [
    /*
      Excluir assets y archivos estáticos del matcher por eficiencia.
      El middleware se ejecuta en el resto de rutas.
    */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|otf)).*)',
  ],
};
