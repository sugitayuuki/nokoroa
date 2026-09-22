import { Reflector } from '@nestjs/core';
import { ThrottlerModuleOptions } from '@nestjs/throttler';

import { UserThrottlerGuard } from './user-throttler.guard';

describe('UserThrottlerGuard', () => {
  const guard = new UserThrottlerGuard(
    { throttlers: [] } as unknown as ThrottlerModuleOptions,
    {} as never,
    new Reflector(),
  );

  // protected メンバをテストから呼ぶためのアクセサ
  const track = (req: unknown): Promise<string> =>
    (
      guard as unknown as { getTracker(r: unknown): Promise<string> }
    ).getTracker(req);

  it('認証済みリクエストはユーザー単位で数える', async () => {
    await expect(track({ user: { id: 7 }, ip: '1.2.3.4' })).resolves.toBe(
      'user-7',
    );
  });

  it('userId 形式のペイロードでもユーザー単位で数える', async () => {
    await expect(track({ user: { userId: 9 }, ip: '1.2.3.4' })).resolves.toBe(
      'user-9',
    );
  });

  it('未認証リクエストはIP単位で数える', async () => {
    await expect(track({ ip: '1.2.3.4' })).resolves.toBe('ip-1.2.3.4');
  });

  it('同一IPでもユーザーが違えば別の枠になる', async () => {
    const a = await track({ user: { id: 1 }, ip: '1.2.3.4' });
    const b = await track({ user: { id: 2 }, ip: '1.2.3.4' });

    expect(a).not.toBe(b);
  });
});
