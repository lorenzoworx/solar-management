import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['server/tests/**/*.test.ts', 'shared/tests/**/*.test.ts'],
        },
      },
      './client/vitest.config.ts',
    ],
  },
});
