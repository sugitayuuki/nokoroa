import { ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user?: { id?: number; userId?: number };
}

export const USER_SCOPED_THROTTLE = 'user_scoped_throttle';

/**
 * この経路のレート制限をユーザー単位で行うことを示す。
 * グローバルの IP 単位ガードは、この印が付いた経路を評価しない。
 */
export const UserScopedThrottle = () => SetMetadata(USER_SCOPED_THROTTLE, true);

/**
 * アプリ全体に掛ける IP 単位のレート制限。
 *
 * @UserScopedThrottle() が付いた経路は評価しない。付けないと、
 * その経路の厳しい @Throttle 値(例: 20/分)が IP 単位でも適用され、
 * 共有NAT配下の別ユーザーが巻き添えで 429 になる。
 */
@Injectable()
export class GlobalThrottlerGuard extends ThrottlerGuard {
  protected shouldSkip(context: ExecutionContext): Promise<boolean> {
    const userScoped = this.reflector.getAllAndOverride<boolean>(
      USER_SCOPED_THROTTLE,
      [context.getHandler(), context.getClass()],
    );

    if (userScoped === true) return Promise.resolve(true);
    return super.shouldSkip(context);
  }
}

/**
 * レート制限の単位を「認証済みユーザー」にするガード。
 *
 * 既定の ThrottlerGuard は req.ip で数えるため、1 アカウントで複数 IP を
 * 使えば制限を回避できる。外部 AI への従量課金が発生する経路があるので、
 * ログイン済みのリクエストはユーザー単位で数える。
 * 認証ガードの後に適用しないと req.user を読めない点に注意
 * (グローバルガードは認証ガードより先に実行される)。
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: RequestWithUser): Promise<string> {
    const userId = req.user?.id ?? req.user?.userId;
    return Promise.resolve(userId ? `user-${userId}` : `ip-${req.ip}`);
  }
}
