import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/agreements', destination: '/propuestas', permanent: false },
      { source: '/agreements/create', destination: '/propuestas/create', permanent: false },
      { source: '/agreements/:id', destination: '/propuestas/:id', permanent: false },
      { source: '/agreements/:id/process', destination: '/propuestas/:id', permanent: false },
      { source: '/convenios-vigentes', destination: '/convenios', permanent: false },
      { source: '/convenios/vigencia', destination: '/convenios', permanent: false },
    ];
  },
};

export default nextConfig;
