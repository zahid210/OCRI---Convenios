import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // El runtime usa @prisma/adapter-mariadb (acepta `mariadb://`), pero el CLI
    // de Prisma (migrate) solo entiende `mysql://`. Se normaliza aquí, sin tocar
    // la variable DATABASE_URL que consume la app.
    url: process.env['DATABASE_URL']?.replace(/^mariadb:\/\//, 'mysql://'),
  },
});
