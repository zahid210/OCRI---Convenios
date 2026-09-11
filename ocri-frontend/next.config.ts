import type { NextConfig } from "next";

// Todo el API del backend vive bajo el prefijo /api (setGlobalPrefix en el
// backend). El frontend lo proxea por el mismo origen cuando `API_PROXY_URL`
// está definido (producción/Docker) con UNA sola rewrite: así las páginas de la
// UI (/seguimiento, /users, /reports, /institutions, /dependencias, …) nunca
// colisionan con las rutas del API, que antes las secuestraban.

async function apiRewrites() {
  const target = process.env.API_PROXY_URL?.trim().replace(/\/+$/, "");
  if (!target) return [];

  return [
    { source: "/api/:path*", destination: `${target}/api/:path*` },
  ];
}

const nextConfig: NextConfig = {
  // Build autocontenido para producción: genera .next/standalone que solo
  // necesita node para servir toda la app (un solo puerto).
  output: "standalone",

  async headers() {
    const csp = [
      "default-src 'self'",
      // Next inyecta el runtime y el payload RSC en <script> inline sin nonce;
      // 'unsafe-inline' es la contrapartida de no usar nonces (proxy). El resto
      // de la política bloquea orígenes externos, frames y objectos embebidos.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      // connect-src permite https: porque el storage S3-compatible emite URLs
      // prefirmadas en dominios externos para las descargas.
      "connect-src 'self' http://localhost:3000 http://localhost:3001 https:",
      "worker-src 'self' blob:",
      "child-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          // Solo se envía por HTTPS en despliegues reales; aquí el valor es
          // seguro incluso en dev (no activa nada si la conexión es HTTP).
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
          { key: "Content-Security-Policy", value: csp },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },

  async rewrites() {
    // beforeFiles: el proxy del API precede a redirects, rutas de fs y dinámicas,
    // para que /agreements, /process, etc. siempre lleguen al backend y nunca a
    // una página de la UI (evita conflicto con las redirecciones de compat).
    return {
      beforeFiles: await apiRewrites(),
      afterFiles: [],
    };
  },

  async redirects() {
    return [
      // Redirecciones de compatibilidad para URLs antiguas eliminadas.
      // /agreements/* NO está aquí: vive en el API y el rewrite beforeFiles lo
      // proxea al backend (si quedara, la redirección capturaría las llamadas).
      { source: '/convenios-vigentes', destination: '/convenios', permanent: false },
      { source: '/convenios/vigencia', destination: '/convenios', permanent: false },
      // Detalle del expediente completo (Etapa 1+2+3) en /convenios/:id.
      // Las rutas /propuestas/:id, /registro/:id y /seguimiento/:id son detalles
      // enfocados por etapa y se resuelven con páginas propias (ids numéricos).
    ];
  },
};

export default nextConfig;