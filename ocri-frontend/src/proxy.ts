import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { roleHome } from "@/lib/auth";

// ── Cookies de sesión ─────────────────────────────────────────────────────
// `access_token` es httpOnly: el navegador la adjunta sola en cada petición
// pero el JavaScript de la página NO puede leerla, de modo que un XSS no
// puede exfiltrarla. Quien la escribe y la vacía es este proxy; el navegador
// solo la transporta. `user` queda legible porque la UI la lee para mostrar
// el nombre en el layout, pero la autorización SIEMPRE sale del JWT
// verificado, nunca de esa cookie.
const SESSION_COOKIE = "access_token";
const USER_COOKIE = "user";

// Duración de la cookie = duración del JWT (JWT_EXPIRES_IN: '8h' en
// ocri-backend/src/auth/auth.module.ts). Si cambia uno, debe cambiar el otro.
const SESSION_TTL_SECONDS = 8 * 60 * 60;

/** URL interna del backend (la misma variable que usa la rewrite de next.config.ts). */
function backendUrl(): string | null {
    return process.env.API_PROXY_URL?.trim().replace(/\/+$/, "") || null;
}

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
    response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    response.cookies.set(USER_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
}

/**
 * Acepta peticiones del mismo origen (host del `Origin` == header `Host`) o
 * sin header `Origin` (curl, scripts). Los navegadores envían `Origin` en
 * todas las peticiones POST, incluidas las del propio origen; un sitio de
 * terceros no supera esta comprobación (CSRF de login/logout).
 *
 * Se compara el host del `Origin` contra el header `Host` ignorando el esquema:
 * detrás de un proxy TLS la petición puede llegar en HTTP interno mientras la
 * página se sirve por HTTPS, y lo que importa es dominino:puerto.
 */
function sameOriginOrNoOrigin(request: NextRequest): boolean {
    const origin = request.headers.get("origin");
    if (!origin) return true;
    let parsed: URL;
    try {
        parsed = new URL(origin);
    } catch {
        return false;
    }
    return parsed.host === request.headers.get("host");
}

/**
 * POST /api/auth/login: autentica contra el backend y entrega la sesión como
 * cookie httpOnly. El token NUNCA viaja en el cuerpo de la respuesta, de modo
 * que el JavaScript de la página no puede leerlo ni guardarlo.
 */
async function handleLogin(request: NextRequest): Promise<NextResponse> {
    // Anti login-CSRF: un formulario en un sitio de terceros no supera esta
    // comprobación de origen.
    if (!sameOriginOrNoOrigin(request)) {
        return NextResponse.json(
            { message: "Origen de la petición no permitido." },
            { status: 403 },
        );
    }

    const backend = backendUrl();
    if (!backend) {
        return NextResponse.json(
            {
                message:
                    "API_PROXY_URL no está definido: el frontend no puede autenticar contra el backend.",
            },
            { status: 500 },
        );
    }

    let upstream: Response;
    try {
        upstream = await fetch(`${backend}/api/auth/login`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: await request.text(),
        });
    } catch {
        return NextResponse.json(
            { message: "No se pudo conectar con el backend de autenticación." },
            { status: 502 },
        );
    }

    // Credenciales inválidas (401) u otro error del backend: se reenvía tal cual.
    if (!upstream.ok) {
        return new NextResponse(await upstream.text(), {
            status: upstream.status,
            headers: { "content-type": "application/json" },
        });
    }

    let payload: { access_token?: string; user?: unknown };
    try {
        payload = (await upstream.json()) as typeof payload;
    } catch {
        return NextResponse.json(
            { message: "El backend devolvió una respuesta inesperada." },
            { status: 502 },
        );
    }

    if (!payload.access_token || !payload.user) {
        return NextResponse.json(
            { message: "El backend no devolvió un token de sesión válido." },
            { status: 502 },
        );
    }

    // `secure` solo cuando la petición llega por HTTPS: en el despliegue local
    // (HTTP puro) una cookie `secure` la descartaría el navegador.
    const secure = request.nextUrl.protocol === "https:";

    const response = NextResponse.json({ user: payload.user });
    response.cookies.set(SESSION_COOKIE, payload.access_token, {
        httpOnly: true,
        sameSite: "lax",
        secure,
        path: "/",
        maxAge: SESSION_TTL_SECONDS,
    });
    // `ResponseCookies.set()` ya URL-encoda el valor; `parseUserCookie`
    // (lib/auth.ts) decodifica una vez. Pasamos el JSON crudo, igual que hacía
    // js-cookie antes del refactor httpOnly.
    response.cookies.set(USER_COOKIE, JSON.stringify(payload.user), {
        // Legible por la UI (muestra el nombre); sin peso en autorización.
        sameSite: "lax",
        secure,
        path: "/",
        maxAge: SESSION_TTL_SECONDS,
    });
    return response;
}

/**
 * POST /api/auth/logout: única forma de vaciar la cookie httpOnly. Con la
 * misma comprobación de origen que el login para evitar que un sitio de
 * terceros cierre la sesión de la víctima (logout CSRF).
 */
function handleLogout(request: NextRequest): NextResponse {
    if (!sameOriginOrNoOrigin(request)) {
        return NextResponse.json(
            { message: "Origen de la petición no permitido." },
            { status: 403 },
        );
    }
    return clearSession(NextResponse.json({ ok: true }));
}

/**
 * Peticiones al API con sesión en cookie: el proxy inyecta el header
 * `Authorization` (con el JWT verificado) antes de que la rewrite de
 * next.config.ts lo mande al backend, de modo que el JavaScript de la página
 * nunca ve el token.
 *
 * - Cookie inválida o caducada → 401 y cookies limpiadas, para no reenviar la
 *   cookie vieja en cada petición.
 * - Sin cookie (scripts con Bearer propio, endpoints públicos como
 *   /api/health) → pasa tal cual: el backend sigue siendo quien decide.
 */
function proxyApi(
    request: NextRequest,
    token: string | undefined,
): NextResponse {
    if (!token) return NextResponse.next();

    if (!verifyJwt(token)) {
        const response = NextResponse.json(
            { message: "Sesión expirada. Inicie sesión nuevamente." },
            { status: 401 },
        );
        return clearSession(response);
    }

    // Un cliente que ya trae su propio Authorization (curl, Postman, scripts)
    // no se toca.
    if (request.headers.get("authorization")) return NextResponse.next();

    const headers = new Headers(request.headers);
    headers.set("authorization", `Bearer ${token}`);
    return NextResponse.next({ request: { headers } });
}

export function proxy(request: NextRequest) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const { pathname } = request.nextUrl;

    // ── Rutas del API ────────────────────────────────────────────────────
    // /api/* pasa por aquí ANTES de la rewrite beforeFiles que lo proxea al
    // backend, así que este es el punto donde se gestiona la sesión del API
    // (login/logout) y se inyecta el Authorization verificado.
    if (pathname.startsWith("/api/")) {
        if (pathname === "/api/auth/login" && request.method === "POST") {
            return handleLogin(request);
        }
        if (pathname === "/api/auth/logout") {
            return handleLogout(request);
        }
        return proxyApi(request, token);
    }

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
        "/api/:path*",
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
