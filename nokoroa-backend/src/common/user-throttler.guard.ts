import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user?: { id?: number; userId?: number };
}

/**
 * レート制限の単位を「認証済みユーザー」にするガード。
 *
 * 既定の ThrottlerGuard は req.ip で数えるため、同一 IP の別ユーザーが
 * 互いの枠を食い合う一方、1 アカウントで複数 IP を使えば制限を回避できる。
 * 外部 AI への従量課金が発生する経路があるので、ログイン済みの
 * リクエストはユーザー単位で数える。未認証は従来どおり IP 単位。
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: RequestWithUser): Promise<string> {
    const userId = req.user?.id ?? req.user?.userId;
    return Promise.resolve(userId ? `user-${userId}` : `ip-${req.ip}`);
  }
}
