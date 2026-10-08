import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { AllowCrossSite } from './allow-cross-site.decorator';
import { FetchMetadataGuard } from './fetch-metadata.guard';

// `this` を使わないことを明示する（ハンドラを値として取り回すため）
class StubController {
  @AllowCrossSite()
  oauthRoute(this: void): void {}

  protectedRoute(this: void): void {}
}

/**
 * 実際のルートと同じ経路でメタデータを読ませたいので、Reflector はモックせず
 * デコレータを付けたスタブのメソッドを `getHandler()` に返す。
 */
function contextFor(
  handler: () => void,
  req: { method?: string; path?: string; headers?: Record<string, string> },
): ExecutionContext {
  const headers = req.headers ?? {};
  const request = {
    method: req.method ?? 'GET',
    path: req.path ?? '/',
    headers: { host: 'api.example.com', ...headers },
    header: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;

  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => StubController,
  } as unknown as ExecutionContext;
}

describe('FetchMetadataGuard', () => {
  let guard: FetchMetadataGuard;
  const stub = new StubController();

  beforeEach(() => {
    guard = new FetchMetadataGuard(new Reflector());
  });

  it('setGlobalPrefix 配下でも OAuth ルートのトップレベル遷移を通す', () => {
    // 本番の req.path は /api/... になる。許可判定をパス文字列で持つと
    // ここだけ許可レーンに乗らず、正規の Google ログインが 403 になる
    expect(
      guard.canActivate(
        contextFor(stub.oauthRoute, {
          path: '/api/auth/google/callback',
          headers: {
            'sec-fetch-site': 'cross-site',
            'sec-fetch-mode': 'navigate',
          },
        }),
      ),
    ).toBe(true);
  });

  it('OAuth ルートでもトップレベル遷移以外は拒否する', () => {
    // 埋め込み(no-cors)でコールバックを叩かせ、進行中ログインの state を壊す経路
    expect(() =>
      guard.canActivate(
        contextFor(stub.oauthRoute, {
          path: '/api/auth/google/callback',
          headers: {
            'sec-fetch-site': 'cross-site',
            'sec-fetch-mode': 'no-cors',
          },
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('印の無いルートはクロスサイトを拒否する', () => {
    expect(() =>
      guard.canActivate(
        contextFor(stub.protectedRoute, {
          path: '/api/auth/me',
          headers: {
            'sec-fetch-site': 'cross-site',
            'sec-fetch-mode': 'navigate',
          },
        }),
      ),
    ).toThrow(ForbiddenException);
  });

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

  it('API と同一オリジン(Swagger の Try it out)からの更新系は通す', () => {
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
