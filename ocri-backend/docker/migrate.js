/* eslint-disable */
// Baseline idempotente para bases preexistentes con el esquema creado pero sin
// historial de migraciones (p. ej. bases anteriores a versionar el esquema). No
// ejecuta DDL: solo marca la migración inicial como aplicada, para que
// `prisma migrate deploy` no intente volver a crear las tablas.
const mariadb = require('mariadb');
const { execFileSync } = require('child_process');

const BASELINE = '20261013000000_init';
const PRISMA = '/app/node_modules/.bin/prisma';
const url = process.env.DATABASE_URL;

async function main() {
  if (!url) return;
  const u = new URL(url);

  let conn;
  try {
    conn = await mariadb.createConnection({
      host: u.hostname,
      port: u.port ? Number(u.port) : 3306,
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, ''),
      connectTimeout: 10000,
    });
  } catch (e) {
    // La base aún no responde: dejamos que `migrate deploy` lo intente/reporte.
    console.error('[migrate] no se pudo conectar a la base:', e.message);
    return;
  }

  const tableExists = async (name) => {
    const rows = await conn.query(
      'SELECT COUNT(*) AS c FROM information_schema.tables ' +
        'WHERE table_schema = DATABASE() AND table_name = ?',
      [name],
    );
    return Number(rows[0].c) > 0;
  };

  const hasMigrations = await tableExists('_prisma_migrations');
  const hasSchema = await tableExists('agreements');
  await conn.end();

  if (!hasMigrations && hasSchema) {
    console.log(
      `[migrate] base con esquema sin historial → baseline ${BASELINE}`,
    );
    execFileSync(PRISMA, ['migrate', 'resolve', '--applied', BASELINE], {
      stdio: 'inherit',
    });
  } else if (!hasSchema) {
    console.log('[migrate] base vacía → migrate deploy creará el esquema');
  }
}

main().catch((e) => {
  console.error('[migrate] error:', e);
  process.exit(1);
});
