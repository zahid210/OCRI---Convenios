import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
    const token = request.cookies.get('access_token')?.value;
    const { pathname } = request.nextUrl;

    const protectedPrefixes = ['/dashboard', '/agreements', '/institutions', '/reports', '/seguimiento', '/users'];

    // Si intenta acceder a rutas protegidas sin token
    const isProtected = protectedPrefixes.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
    if (isProtected && !token) {
        const loginUrl = new URL('/login', request.url);
        return NextResponse.redirect(loginUrl);
    }

    // Si ya tiene sesión activa y quiere entrar al login, redirigir al dashboard
    if (pathname === '/login' && token) {
        const dashboardUrl = new URL('/dashboard', request.url);
        return NextResponse.redirect(dashboardUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/', '/dashboard/:path*', '/agreements/:path*', '/institutions/:path*', '/reports/:path*', '/seguimiento/:path*', '/users/:path*', '/login'],
};