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
  // passport は認証に失敗すると user に false を渡す。そのまま返すと
  // request.user が false になり「未認証」の判定が効かないため undefined に揃える。
  // 基底の handleRequest は <TUser>(...) => TUser と宣言されており、
  // 「未認証なら値を返さない」を型で表現できない。undefined を返すのがこの
  // ガードの役目なので、ここだけ TUser へ寄せる。
  handleRequest<TUser = unknown>(_err: unknown, user: TUser): TUser {
    return (user || undefined) as TUser;
  }
}
