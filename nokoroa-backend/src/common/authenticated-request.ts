import { Request } from 'express';

/**
 * JwtStrategy.validate() が返す値。req.user に入る。
 *
 * 注意: 型名 Request は @nestjs/common からも export されているが、そちらは
 * パラメータデコレータ（値）であって型ではない。`extends Request` で誤って
 * そちらを参照すると Fetch API の Request に解決され、req.params 等が
 * 型から消える。ここでは express の Request を明示的に import している。
 */
export interface AuthUser {
  id: number;
  userId: number;
  email: string;
}

/** JwtAuthGuard を通過したリクエスト。user は必ず存在する。 */
export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

/** OptionalJwtAuthGuard を通過したリクエスト。未認証なら user は undefined。 */
export interface OptionallyAuthenticatedRequest extends Request {
  user?: AuthUser;
}
