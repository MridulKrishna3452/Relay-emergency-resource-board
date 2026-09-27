import { createApp } from './app';
import { env } from './lib/env';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`[relay] API listening on http://localhost:${env.PORT}/api`);
  console.log(`[relay] >>> Open the app in your browser: ${env.CLIENT_ORIGIN} <<<`);
});
