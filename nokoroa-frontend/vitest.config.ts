import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // tsconfig.json の paths (@/* -> ./src/*) と同じ解決をテストでも効かせる
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // 対象は純ロジックのみ。DOM を触るテストは含めないため node で足りる
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
