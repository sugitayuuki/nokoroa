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
 */
function fromAuthCookie(req: Request): string | null {
  const cookies = req.cookies as Record<string, string> | undefined;
  return cookies?.[AUTH_COOKIE_NAME] ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      // ブラウザからのリクエストはクッキーで来る。Authorization ヘッダは
      // Swagger と既存の E2E のために残しており、クッキーが無いときだけ見る。
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
