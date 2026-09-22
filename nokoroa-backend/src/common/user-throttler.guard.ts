import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user?: { id?: number; userId?: number };
}

/** レート制限をユーザー単位で数える throttler の名前 */
export const USER_THROTTLER = 'user';

export function trackedUserId(context: ExecutionContext): number | undefined {
  const req = context.switchToHttp().getRequest<RequestWithUser>();
  return req.user?.id ?? req.user?.userId;
}

/**
 * レート制限の単位を「認証済みユーザー」にするガード。
 *
 * 既定の ThrottlerGuard は req.ip で数えるため、1 アカウントで複数 IP を
 * 使えば制限を回避できる。外部 AI への従量課金が発生する経路があるので、
 * ログイン済みのリクエストはユーザー単位で数える。
 *
 * 認証ガードの後に適用しないと req.user を読めない。NestJS は
 * globalGuards.concat(scopedGuards) の順で実行するため、グローバル登録では
 * 認証ガードより先に走ってしまう（実装: @nestjs/core の guards-context-creator）。
 * したがってこのガードは @UseGuards(JwtAuthGuard, UserThrottlerGuard) の形で
 * コントローラに適用する。
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: RequestWithUser): Promise<string> {
    const userId = req.user?.id ?? req.user?.userId;
    return Promise.resolve(userId ? `user-${userId}` : `ip-${req.ip}`);
  }
}
