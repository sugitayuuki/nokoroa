import {
  assertKnownEnv,
  isDevelopmentEnv,
  isProductionLikeEnv,
  isTestEnv,
} from './environment';

/** NODE_ENV を一時的に差し替える(引数に undefined を渡すと既定値が効くため) */
function withNodeEnv<T>(value: string | undefined, fn: () => T): T {
  const original = process.env.NODE_ENV;
  if (value === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = value;
  }
  try {
    return fn();
  } finally {
    process.env.NODE_ENV = original;
  }
}

describe('environment', () => {
  describe('isDevelopmentEnv', () => {
    it('development のときだけ true', () => {
      expect(isDevelopmentEnv('development')).toBe(true);
      expect(isDevelopmentEnv('production')).toBe(false);
      expect(isDevelopmentEnv('staging')).toBe(false);
      expect(isDevelopmentEnv('test')).toBe(false);
    });

    it('未設定は開発環境とみなさない', () => {
      expect(withNodeEnv(undefined, () => isDevelopmentEnv())).toBe(false);
    });
  });

  describe('isProductionLikeEnv', () => {
    it('開発・テスト以外は本番相当として扱う', () => {
      expect(isProductionLikeEnv('production')).toBe(true);
      expect(isProductionLikeEnv('prod')).toBe(true);
      expect(isProductionLikeEnv('staging')).toBe(true);
      expect(withNodeEnv(undefined, () => isProductionLikeEnv())).toBe(true);
    });

    it('開発とテストは本番相当にしない', () => {
      expect(isProductionLikeEnv('development')).toBe(false);
      expect(isProductionLikeEnv('test')).toBe(false);
    });
  });

  describe('isTestEnv', () => {
    it('test のときだけ true', () => {
      expect(isTestEnv('test')).toBe(true);
      expect(isTestEnv('production')).toBe(false);
      expect(withNodeEnv(undefined, () => isTestEnv())).toBe(false);
    });
  });

  describe('assertKnownEnv', () => {
    it('想定内の値は通す', () => {
      for (const env of [
        'development',
        'test',
        'staging',
        'production',
        'prod',
      ]) {
        expect(() => assertKnownEnv(env)).not.toThrow();
      }
      expect(() =>
        withNodeEnv(undefined, () => assertKnownEnv()),
      ).not.toThrow();
    });

    it('打ち間違いは起動時に弾く', () => {
      expect(() => assertKnownEnv('prodution')).toThrow(/not recognized/);
      expect(() => assertKnownEnv('Production')).toThrow(/not recognized/);
    });
  });
});
