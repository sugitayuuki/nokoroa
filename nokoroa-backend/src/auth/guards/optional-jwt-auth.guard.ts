import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * 認証を必須にしないJWTガード。
 * トークンが無い場合もリクエストを通し、有効なトークンがある場合のみ
 * request.user を設定する。「公開リソースは誰でも、非公開リソースは所有者だけ」
 * を単一のエンドポイントで表現するために使う。
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(_err: unknown, user: TUser): TUser {
    return user || undefined;
  }
}
