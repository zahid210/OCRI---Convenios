import mysql from 'mysql2/promise';

const password = process.env.DB_PASSWORD;
if (!password) {
  console.error(
    'DB_PASSWORD no definida. Exportar la credencial del despliegue antes de ejecutar, p. ej.:\n' +
      '  DB_PASSWORD="$DB_PASSWORD" node scripts/clean-db.mjs',
  );
  process.exit(1);
}

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'ocri',
  password,
  database: process.env.DB_NAME || 'ocri',
});

try {
  await conn.execute('SET FOREIGN_KEY_CHECKS = 0');

  const tables = [
    'deliverable_observations',
    'deliverables',
    'documents',
    'opinion_requests',
    'process_events',
    'agreement_responsables',
    'agreements',
  ];

  for (const table of tables) {
    const [result] = await conn.execute(`DELETE FROM \`${table}\``);
    console.log(`  DELETE ${table}: ${result.affectedRows} fila(s) eliminada(s)`);
  }

  await conn.execute('SET FOREIGN_KEY_CHECKS = 1');
  console.log('\nBase de datos limpia. Catálogos preservados.');
} catch (e) {
  console.error('Error:', e.message);
  await conn.execute('SET FOREIGN_KEY_CHECKS = 1');
} finally {
  await conn.end();
}
