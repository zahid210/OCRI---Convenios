import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { parseUserCookie, roleHome, CurrentUser } from "@/lib/auth";

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

// ¿Puede `role` entrar a `pathname`? (además del requisito de token)
function roleAllowed(role: string | undefined, pathname: string): boolean {
    if (role === "admin") return true;

    // Asistente (registo de propuestas): SOLO el alta.
    if (role === "asistente") {
        return pathname === "/propuestas/create" || pathname.startsWith("/propuestas/create/");
    }

    // Procesador (Berna): el flujo completo, sin alta ni administración.
    if (role === "procesador") {
        if (pathname === "/propuestas/create" || pathname.startsWith("/propuestas/create/")) return false;
        if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return false;
        if (pathname === "/institutions" || pathname.startsWith("/institutions/")) return false;
        if (pathname === "/reports" || pathname.startsWith("/reports/")) return false;
        if (pathname === "/dependencias" || pathname.startsWith("/dependencias/")) return false;
        if (pathname === "/users" || pathname.startsWith("/users/")) return false;
        return true;
    }

    // Viewer: solo lectura de bandejas y consultas (sin alta ni administración).
    if (pathname === "/propuestas/create" || pathname.startsWith("/propuestas/create/")) return false;
    if (pathname === "/dependencias" || pathname.startsWith("/dependencias/")) return false;
    if (pathname === "/users" || pathname.startsWith("/users/")) return false;
    return true;
}

export function proxy(request: NextRequest) {
    const token = request.cookies.get("access_token")?.value;
    const { pathname } = request.nextUrl;

    const isProtected = protectedPrefixes.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );

    // Si intenta acceder a rutas protegidas sin token
    if (isProtected && !token) {
        const loginUrl = new URL("/login", request.url);
        return NextResponse.redirect(loginUrl);
    }

    // Raíz con sesión: a la pantalla de inicio del rol
    if (pathname === "/" && token) {
        return NextResponse.redirect(new URL(roleFrom(request), request.url));
    }

    // Si ya tiene sesión activa y quiere entrar al login, redirigir a su inicio
    if (pathname === "/login" && token) {
        return NextResponse.redirect(new URL(roleFrom(request), request.url));
    }

    // Restricción por rol: si la página no le corresponde, va a su inicio
    if (isProtected && token && !roleAllowed(userRole(request), pathname)) {
        const home = roleFrom(request);
        if (pathname !== home) {
            return NextResponse.redirect(new URL(home, request.url));
        }
    }

    return NextResponse.next();
}

function userRole(request: NextRequest): string | undefined {
    const user = parseUserCookie(request.cookies.get("user")?.value) as CurrentUser | null;
    return user?.role;
}

function roleFrom(request: NextRequest): string {
    return roleHome(userRole(request));
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