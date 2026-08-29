import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
    const token = request.cookies.get("access_token")?.value;
    const { pathname } = request.nextUrl;

    // Áreas protegidas: todas las páginas autenticadas del ciclo de vida del convenio
    const protectedPrefixes = [
        "/dashboard",
        "/propuestas",
        "/registro",
        "/convenios",
        "/seguimiento",
        "/institutions",
        "/dependencias",
        "/reports",
        "/users",
    ];

    // Si intenta acceder a rutas protegidas sin token
    const isProtected = protectedPrefixes.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
    if (isProtected && !token) {
        const loginUrl = new URL("/login", request.url);
        return NextResponse.redirect(loginUrl);
    }

    // Si ya tiene sesión activa y quiere entrar al login, redirigir al dashboard
    if (pathname === "/login" && token) {
        const dashboardUrl = new URL("/dashboard", request.url);
        return NextResponse.redirect(dashboardUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/",
        "/dashboard/:path*",
        "/propuestas/:path*",
        "/registro/:path*",
        "/convenios/:path*",
        "/seguimiento/:path*",
        "/institutions/:path*",
        "/dependencias/:path*",
        "/reports/:path*",
        "/users/:path*",
        "/login",
    ],
};
