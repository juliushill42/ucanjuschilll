import { auth } from '@/auth'
import { NextResponse } from 'next/server'

const PROTECTED_ROUTES = ['/studio', '/notifications', '/settings']

export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth

  const isProtected = PROTECTED_ROUTES.some(route =>
    nextUrl.pathname.startsWith(route)
  )

  if (isProtected && !isLoggedIn) {
    const loginUrl = new URL('/login', nextUrl.origin)
    loginUrl.searchParams.set('callbackUrl', nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
