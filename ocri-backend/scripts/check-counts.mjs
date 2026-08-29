import mysql from 'mysql2/promise';
import 'dotenv/config';

const url = new URL(process.env.DATABASE_URL ?? '');
const conn = await mysql.createConnection({
  host: url.hostname || '127.0.0.1',
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username) || 'ocri',
  password: decodeURIComponent(url.password) || '',
  database: url.pathname.slice(1) || 'ocri',
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
