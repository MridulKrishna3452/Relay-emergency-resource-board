import { execSync } from 'child_process';
import path from 'path';

export default function setup() {
  // Create a fresh schema in the test database before the suite runs.
  execSync('npx prisma db push --force-reset --skip-generate', {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
    stdio: 'ignore',
  });
}
