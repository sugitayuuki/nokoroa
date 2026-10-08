import {
  ExecutionContext,
  ForbiddenException,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import {
  ALLOW_CROSS_SITE_NAVIGATION_KEY,
  AllowCrossSiteNavigation,
} from './allow-cross-site-navigation.decorator';
import { FetchMetadataGuard } from './fetch-metadata.guard';

// `this` を使わないことを明示する（ハンドラを値として取り回すため）
class StubController {
  @AllowCrossSiteNavigation()
  oauthRoute(this: void): void {}

  protectedRoute(this: void): void {}
}

// 印をコントローラ単位で付けても効かないことの検証用
@SetMetadata(ALLOW_CROSS_SITE_NAVIGATION_KEY, true)
class ClassMarkedController {
  someRoute(this: void): void {}
}

/**
 * 実際のルートと同じ経路でメタデータを読ませたいので、Reflector はモックせず
 * デコレータを付けたスタブのメソッドを `getHandler()` に返す。
 */
function contextFor(
  handler: () => void,
  req: {
    method?: string;
    path?: string;
    headers?: Record<string, string>;
  },
  controller: unknown = StubController,
): ExecutionContext {
  const headers: Record<string, string> = {
    host: 'api.example.com',
    ...(req.headers ?? {}),
  };
  const request = {
    method: req.method ?? 'GET',
    path: req.path ?? '/',
    headers,
    header: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;

  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => controller,
  } as unknown as ExecutionContext;
}

const CROSS_SITE_NAVIGATION = {
  'sec-fetch-site': 'cross-site',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-dest': 'document',
};

describe('FetchMetadataGuard', () => {
  let guard: FetchMetadataGuard;
  const stub = new StubController();
  const classMarked = new ClassMarkedController();

  beforeEach(() => {
    guard = new FetchMetadataGuard(new Reflector());
  });

  describe('印による許可', () => {
    it('印を付けたハンドラはトップレベル遷移を通す', () => {
      // パスは一切見ない（見ていた頃に起きた事故は API_GLOBAL_PREFIX の JSDoc）
      expect(
        guard.canActivate(
          contextFor(stub.oauthRoute, {
            path: '/api/auth/google/callback',
            headers: CROSS_SITE_NAVIGATION,
          }),
        ),
      ).toBe(true);
    });

    it('印が無いハンドラのクロスサイトは拒否する', () => {
      expect(() =>
        guard.canActivate(
          contextFor(stub.protectedRoute, {
            path: '/api/auth/me',
            headers: CROSS_SITE_NAVIGATION,
          }),
        ),
      ).toThrow(ForbiddenException);
    });

    it.each([
      'cross-site, cross-site',
      'cross-site,cross-site',
      'same-origin, cross-site',
      'Cross-Site',
      'cross-site;x=1',
      'unknown-future-value',
    ])('自サイト扱いできない Sec-Fetch-Site は拒否する (%s)', (site) => {
      // 経路上の装置が同名ヘッダを足すと Express が連結する。単純一致だと
      // ここで素通りし、全ルートがクロスサイトから到達可能になる
      expect(() =>
        guard.canActivate(
          contextFor(stub.protectedRoute, {
            headers: {
              'sec-fetch-site': site,
              'sec-fetch-mode': 'navigate',
              'sec-fetch-dest': 'document',
            },
          }),
        ),
      ).toThrow(ForbiddenException);
    });

    it('印をコントローラ単位で付けても効かない', () => {
      // 効かせると、後から足したルートが無言で検査の外に出る
      expect(() =>
        guard.canActivate(
          contextFor(
            classMarked.someRoute,
            { path: '/api/anything', headers: CROSS_SITE_NAVIGATION },
            ClassMarkedController,
          ),
        ),
      ).toThrow(ForbiddenException);
    });
  });

  describe('印が付いてもトップレベル遷移に限る', () => {
    it('埋め込み(no-cors)は拒否する', () => {
      // 画像等でコールバックを叩かせ、進行中ログインの state を壊す経路
      expect(() =>
        guard.canActivate(
          contextFor(stub.oauthRoute, {
            headers: {
              'sec-fetch-site': 'cross-site',
              'sec-fetch-mode': 'no-cors',
              'sec-fetch-dest': 'image',
            },
          }),
        ),
      ).toThrow(ForbiddenException);
    });

    it('iframe からのナビゲーションは拒否する', () => {
      // iframe も sec-fetch-mode は navigate を送るため、dest で分ける
      expect(() =>
        guard.canActivate(
          contextFor(stub.oauthRoute, {
            headers: {
              'sec-fetch-site': 'cross-site',
              'sec-fetch-mode': 'navigate',
              'sec-fetch-dest': 'iframe',
            },
          }),
        ),
      ).toThrow(ForbiddenException);
    });

    // dest 側だけで拒否できてしまうケースばかりだと mode 側の判定が
    // 無保護になり、「冗長だから」と削る改変がテストで止まらない
    it.each([
      { desc: 'dest を送らない', dest: undefined },
      { desc: 'dest は document', dest: 'document' },
    ])(
      'Sec-Fetch-Mode だけが埋め込みを示していても拒否する ($desc)',
      ({ dest }) => {
        expect(() =>
          guard.canActivate(
            contextFor(stub.oauthRoute, {
              headers: {
                'sec-fetch-site': 'cross-site',
                'sec-fetch-mode': 'no-cors',
                ...(dest === undefined ? {} : { 'sec-fetch-dest': dest }),
              },
            }),
          ),
        ).toThrow(ForbiddenException);
      },
    );

    it('Sec-Fetch-Mode / Dest が重複して連結されていても通す', () => {
      // 拒否側だけ連結耐性を入れると、正規のログインがここで 403 になる
      expect(
        guard.canActivate(
          contextFor(stub.oauthRoute, {
            headers: {
              'sec-fetch-site': 'cross-site, cross-site',
              'sec-fetch-mode': 'navigate, navigate',
              'sec-fetch-dest': 'document, document',
            },
          }),
        ),
      ).toBe(true);
    });

    it('Sec-Fetch-Mode / Dest を送らないクライアントは通す', () => {
      // 他の検査と同じく「ヘッダ無し = ブラウザ以外」として扱う
      expect(
        guard.canActivate(
          contextFor(stub.oauthRoute, {
            headers: { 'sec-fetch-site': 'cross-site' },
          }),
        ),
      ).toBe(true);
    });
  });

  describe('印を付けても外れない検査', () => {
    it('印が付いても許可オリジン以外の更新系は拒否する', () => {
      // 印は「クロスサイトから到達してよい」であって
      // 「Origin を信用してよい」ではない
      expect(() =>
        guard.canActivate(
          contextFor(stub.oauthRoute, {
            method: 'POST',
            headers: {
              ...CROSS_SITE_NAVIGATION,
              origin: 'https://evil.example',
            },
          }),
        ),
      ).toThrow(ForbiddenException);
    });

    it('印を付けても同一オリジンの非 navigate は通す(Swagger の Try it out)', () => {
      // 印が効くのはクロスサイトのときだけ。印のせいで自サイトからの
      // fetch が 403 になると、原因がデコレータ側にあると気づけない
      expect(
        guard.canActivate(
          contextFor(stub.oauthRoute, {
            headers: {
              'sec-fetch-site': 'same-origin',
              'sec-fetch-mode': 'cors',
              'sec-fetch-dest': 'empty',
            },
          }),
        ),
      ).toBe(true);
    });
  });

  describe('拒否ログ', () => {
    // 「印が外れた事故」と「正常な遮断」をログで見分けるための文言。
    // ここが崩れると、運用上はログを見ても原因が分からなくなる。
    let warn: jest.SpyInstance;

    beforeEach(() => {
      warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warn.mockRestore();
    });

    it('印が無い拒否には解決先のハンドラを添える', () => {
      expect(() =>
        guard.canActivate(
          contextFor(stub.protectedRoute, { headers: CROSS_SITE_NAVIGATION }),
        ),
      ).toThrow(ForbiddenException);

      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('StubController.protectedRoute'),
      );
    });

    it('埋め込みからの拒否には mode / dest を添える', () => {
      expect(() =>
        guard.canActivate(
          contextFor(stub.oauthRoute, {
            headers: {
              'sec-fetch-site': 'cross-site',
              'sec-fetch-mode': 'no-cors',
              'sec-fetch-dest': 'image',
            },
          }),
        ),
      ).toThrow(ForbiddenException);

      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('sec-fetch-mode=no-cors sec-fetch-dest=image'),
      );
    });
  });

  describe('印と関係ない既存の検査', () => {
    it('許可オリジン以外からの更新系を拒否する', () => {
      expect(() =>
        guard.canActivate(
          contextFor(stub.protectedRoute, {
            method: 'POST',
            path: '/api/auth/login',
            headers: { origin: 'https://evil.example' },
          }),
        ),
      ).toThrow(ForbiddenException);
    });

    it('API と同一オリジンからの更新系は通す', () => {
      expect(
        guard.canActivate(
          contextFor(stub.protectedRoute, {
            method: 'POST',
            path: '/api/auth/login',
            headers: { origin: 'https://api.example.com' },
          }),
        ),
      ).toBe(true);
    });

    it('Fetch Metadata も Origin も無いクライアント(curl 等)は通す', () => {
      expect(
        guard.canActivate(
          contextFor(stub.protectedRoute, { path: '/api/posts' }),
        ),
      ).toBe(true);
    });
  });
});
