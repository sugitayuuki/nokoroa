import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  // next.config 側の JSX 設定はテストに効かないため、自動ランタイムを明示する
  // (指定しないと JSX を含むテストが React is not defined で落ちる)
  esbuild: { jsx: 'automatic' },
  resolve: {
    // tsconfig.json の paths (@/* -> ./src/*) と同じ解決をテストでも効かせる
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // 既定は純ロジック向けの node。DOM が必要なファイルは先頭の
    // `// @vitest-environment jsdom` で個別に切り替える
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
