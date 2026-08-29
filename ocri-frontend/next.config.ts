import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Redirecciones de compatibilidad para URLs antiguas eliminadas
      { source: '/agreements', destination: '/propuestas', permanent: false },
      { source: '/agreements/create', destination: '/propuestas/create', permanent: false },
      { source: '/agreements/:id', destination: '/convenios/:id', permanent: false },
      { source: '/convenios-vigentes', destination: '/convenios', permanent: false },
      { source: '/convenios/vigencia', destination: '/convenios', permanent: false },
      // Detalle del expediente completo (Etapa 1+2+3) en /convenios/:id.
      // Las rutas /propuestas/:id, /registro/:id y /seguimiento/:id son detalles
      // enfocados por etapa y se resuelven con páginas propias (ids numéricos).
    ];
  },
};

export default nextConfig;
