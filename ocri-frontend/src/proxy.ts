import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { roleHome } from "@/lib/auth";

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

/** Claims que nos interesan del JWT emitido por el backend. */
interface JwtClaims {
    sub?: number | string;
    email?: string;
    role?: string;
    exp?: number;
}

const base64UrlToBuffer = (part: string): Buffer =>
    Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64");

let missingSecretWarned = false;

/**
 * Verifica firma HS256 y expiración del access_token. Devuelve null si el
 * token no es utilizable.
 *
 * El rol se toma SIEMPRE de aquí y nunca de la cookie `user`: esa cookie la
 * escribe el cliente y cualquier visitante puede forjarla para que el proxy
 * le deje pasar. La API sigue exigiendo el JWT igualmente, pero la UI tampoco
 * debe rendirse ante una cookie manipulada.
 */
function verifyJwt(token: string): JwtClaims | null {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        if (!missingSecretWarned) {
            missingSecretWarned = true;
            console.error(
                "[proxy] JWT_SECRET no está definido: se deniega toda sesión (fail closed).",
            );
        }
        return null;
    }

    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;

    let headerJson: { alg?: string };
    try {
        headerJson = JSON.parse(base64UrlToBuffer(header).toString("utf8"));
    } catch {
        return null;
    }
    // El backend emite HS256. Rechazar cualquier otro algoritmo (p. ej.
    // "none" o uno asimétrico) evita el ataque de cambio de algoritmo.
    if (headerJson.alg !== "HS256") return null;

    let provided: Buffer;
    try {
        provided = base64UrlToBuffer(signature);
    } catch {
        return null;
    }
    const expected = createHmac("sha256", secret)
        .update(`${header}.${payload}`)
        .digest();
    if (expected.length !== provided.length) return null;
    if (!timingSafeEqual(expected, provided)) return null;

    let claims: JwtClaims;
    try {
        claims = JSON.parse(base64UrlToBuffer(payload).toString("utf8"));
    } catch {
        return null;
    }

    if (typeof claims.exp === "number" && claims.exp * 1000 <= Date.now()) {
        return null;
    }
    if (!claims.role) return null;
    return claims;
}

// ¿Puede `role` entrar a `pathname`? (además del requisito de token)
function roleAllowed(role: string | undefined, pathname: string): boolean {
    if (role === "admin") return true;

    // Asistente (registro de propuestas): SOLO el alta.
    if (role === "asistente") {
        return pathname === "/propuestas/create" || pathname.startsWith("/propuestas/create/");
    }

    // Procesador (Berna): el flujo completo y también el alta de propuestas,
    // para cubrir el registro cuando el asistente no esté. Sin administración.
    if (role === "procesador") {
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

/** Vacia las cookies de sesión en la respuesta (token inválido o caducado). */
function clearSession(response: NextResponse): NextResponse {
    response.cookies.set("access_token", "", { path: "/", maxAge: 0 });
    response.cookies.set("user", "", { path: "/", maxAge: 0 });
    return response;
}

export function proxy(request: NextRequest) {
    const token = request.cookies.get("access_token")?.value;
    const { pathname } = request.nextUrl;

    // Solo hay sesión si la firma y la expiración aguantan; una cookie con un
    // token basura (o forjado) cuenta como no tener sesión.
    const claims = token ? verifyJwt(token) : null;

    const isProtected = protectedPrefixes.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );

    // Sin sesión válida en ruta protegida: a login (y se limpian cookies
    // inválidas para que no vuelvan a mandarse en cada petición).
    if (isProtected && !claims) {
        const response = NextResponse.redirect(new URL("/login", request.url));
        return token ? clearSession(response) : response;
    }

    const home = roleHome(claims?.role);

    // Raíz con sesión: a la pantalla de inicio del rol
    if (pathname === "/" && claims) {
        return NextResponse.redirect(new URL(home, request.url));
    }

    // Si ya tiene sesión activa y quiere entrar al login, redirigir a su inicio
    if (pathname === "/login" && claims) {
        return NextResponse.redirect(new URL(home, request.url));
    }

    // Restricción por rol: si la página no le corresponde, va a su inicio
    if (isProtected && claims && !roleAllowed(claims.role, pathname) && pathname !== home) {
        return NextResponse.redirect(new URL(home, request.url));
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
