import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: '127.0.0.1',
  port: 3306,
  user: 'ocri',
  password: 'OcriDB@Coop2025',
  database: 'ocri',
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
