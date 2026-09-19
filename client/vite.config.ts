import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const base = process.env.APP_BASE_PATH ?? '/';
if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(base)) {
  throw new Error('APP_BASE_PATH must be / or a path such as /projects/solar-management/, including its trailing slash.');
}

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5175,
    strictPort: true,
    proxy: {
      [base + 'api']: {
        target: 'http://127.0.0.1:' + (process.env.API_PORT ?? '3001'),
        rewrite: (path) => '/' + path.slice(base.length),
      },
    },
  },
});
