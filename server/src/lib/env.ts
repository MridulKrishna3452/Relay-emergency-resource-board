import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required env var ${name}. Copy server/.env.example to server/.env`);
  return value;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  // API_PORT (not PORT) so a PORT meant for another tool (e.g. Vite) never collides.
  PORT: Number(process.env.API_PORT ?? 4000),
  JWT_SECRET: required('JWT_SECRET'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '7d',
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
};

export const isProd = env.NODE_ENV === 'production';
