import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: '127.0.0.1', port: 3306, user: 'root', password: 'root', database: 'ocri_db',
});

const tables = [
  'agreements', 'documents', 'opinion_requests', 'process_events',
  'deliverables', 'deliverable_observations', 'agreement_responsables',
  'institutions', 'agreement_types', 'dependencias', 'document_types', 'users', 'app_config',
];

for (const t of tables) {
  const [r] = await conn.execute(`SELECT COUNT(*) AS n FROM \`${t}\``);
  console.log(`  ${t.padEnd(30)} ${r[0].n}`);
}
await conn.end();
