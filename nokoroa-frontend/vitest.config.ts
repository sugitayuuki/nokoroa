import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  // tsconfig は jsx: 'preserve'（Next がビルド時に変換する）なので、
  // テスト実行時だけ React 17 以降の自動ランタイムで変換させる。
  // 無いと JSX が classic 変換になり「React is not defined」で落ちる。
  esbuild: { jsx: 'automatic' },
  resolve: {
    // tsconfig.json の paths (@/* -> ./src/*) と同じ解決をテストでも効かせる
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // 既定は純ロジック向けの node。DOM が必要なテストは先頭に
    // `// @vitest-environment jsdom` を書いて個別に切り替える
    // (全体を jsdom にすると、SSR 前提の分岐を検証しているテストが壊れる)。
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
