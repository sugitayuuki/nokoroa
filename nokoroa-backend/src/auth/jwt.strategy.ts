import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AUTH_COOKIE_NAME } from './auth-cookie';
import { getJwtSecret } from './jwt-secret';

interface JwtPayload {
  sub: number;
  email: string;
}

/**
 * httpOnly クッキーから JWT を取り出す。
 * cookie-parser が未適用の経路でも落ちないよう、req.cookies は無い前提で読む。
 *
 * 文字列以外は null にする: cookie-parser は値が `j:` で始まると JSON として
 * パースしてオブジェクトを入れてくるため、宣言どおり string だけを返す。
 */
function fromAuthCookie(req: Request): string | null {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[AUTH_COOKIE_NAME];
  return typeof value === 'string' ? value : null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      // ブラウザからのリクエストはクッキーで来る。Authorization ヘッダは
      // Swagger と既存の E2E のために残している。
      // 順序はクッキー優先で、**クッキーがある限り Authorization は評価されない**
      // (passport-jwt の fromExtractors は最初に非 null を返した抽出器で確定する)。
      // つまり同じブラウザで nokoroa にログイン済みのまま Swagger の Authorize を
      // 使うと、入力した Bearer ではなくクッキー側のセッションで実行される。
      // Swagger で別ユーザーを試すときはクッキーを消すこと。
      jwtFromRequest: ExtractJwt.fromExtractors([
        fromAuthCookie,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  validate(payload: JwtPayload) {
    return { id: payload.sub, userId: payload.sub, email: payload.email };
  }
}
