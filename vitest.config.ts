import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    maxWorkers: 2,
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          fileParallelism: false,
          include: ['server/tests/**/*.test.ts', 'shared/tests/**/*.test.ts'],
        },
      },
      './client/vitest.config.ts',
    ],
  },
});
