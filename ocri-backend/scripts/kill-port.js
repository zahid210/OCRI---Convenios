/**
 * Mata SOLO el proceso que escucha en el puerto dado (por defecto 3000).
 * No toca otros procesos node.
 */

const { execSync } = require('child_process');
const port = process.argv[2] || '3000';

try {
  const output = execSync(`netstat -ano | findstr ":${port}" | findstr "LISTENING"`, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const pids = [...new Set(output.trim().split('\n').map(l => l.trim().split(/\s+/).pop()).filter(Boolean))];

  if (pids.length === 0) {
    console.log(`Puerto ${port} libre.`);
  } else {
    for (const pid of pids) {
      try {
        execSync(`taskkill /F /PID ${pid}`, { stdio: 'pipe' });
        console.log(`Proceso PID ${pid} en puerto ${port} terminado.`);
      } catch {
        console.log(`PID ${pid} ya no existía.`);
      }
    }
  }
} catch {
  console.log(`Puerto ${port} libre.`);
}
