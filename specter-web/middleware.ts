import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  // Skip if Supabase is not configured yet (local dev without credentials)
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — must call getUser() not getSession() to avoid stale data
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // All authenticated dashboard routes. They live in the (dashboard) route
  // GROUP, which adds no URL prefix — so each path must be listed explicitly.
  // Without this, /signals, /workspace, etc. were unprotected: an
  // unauthenticated visit rendered a broken page (every data hook 401s) instead
  // of redirecting to sign-in.
  const PROTECTED = [
    '/dashboard', '/workspace', '/signals', '/competitors', '/products',
    '/alerts', '/repricing', '/attribution', '/settings', '/billing',
    '/notifications',
  ]
  const isProtected = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )

  // Redirect unauthenticated users away from any protected dashboard route.
  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/sign-in'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from /sign-in and /sign-up
  if (
    user &&
    (pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up'))
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

// Run the auth middleware ONLY on the routes that actually need a session: the
// protected dashboard routes (redirect out when signed-out) and the auth pages
// (redirect in when signed-in). Previously the matcher ran on every non-static
// request — so every anonymous marketing/tool page hit triggered a network call
// to Supabase Auth (supabase.auth.getUser()), adding latency and burning the
// Supabase Auth rate limit at marketing-scale traffic. These prefixes cover the
// (dashboard) route group (which adds no URL prefix) plus sign-in/sign-up.
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/workspace/:path*',
    '/signals/:path*',
    '/competitors/:path*',
    '/products/:path*',
    '/alerts/:path*',
    '/repricing/:path*',
    '/attribution/:path*',
    '/settings/:path*',
    '/billing/:path*',
    '/notifications/:path*',
    '/sign-in/:path*',
    '/sign-up/:path*',
  ],
}
