import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile, VerifyCallback } from 'passport-google-oauth20';

/**
 * Google OAuth の必須設定を環境変数から取得する。
 *
 * 既定値へのフォールバックは行わない。空文字で passport に渡すと、
 * clientID はライブラリ内部の TypeError、callbackURL は redirect_uri の
 * 無言の欠落という分かりにくい壊れ方をするため、起動時に失敗させる
 * (JWT_SECRET の getJwtSecret と同じ方針)。
 */
function requireGoogleEnv(configService: ConfigService, key: string): string {
  const value = configService.get<string>(key)?.trim();
  if (!value) {
    throw new Error(
      `${key} is not set. Set it before starting the application.`,
    );
  }
  return value;
}

/**
 * Google 認証後に req.user へ載る値。
 * auth.service.googleLogin が実際に読む 4 つだけを持つ。
 * OAuth のアクセストークンは使わないので保持しない
 * (使わない資格情報をリクエストに載せて引き回さない)。
 */
export interface GoogleUser {
  email: string;
  name: string;
  picture: string;
  googleId: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private configService: ConfigService) {
    super({
      clientID: requireGoogleEnv(configService, 'GOOGLE_CLIENT_ID'),
      clientSecret: requireGoogleEnv(configService, 'GOOGLE_CLIENT_SECRET'),
      callbackURL: requireGoogleEnv(configService, 'GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const { name, emails, photos } = profile;
    const user: GoogleUser = {
      email: emails?.[0]?.value ?? '',
      name: (name?.givenName ?? '') + ' ' + (name?.familyName ?? ''),
      picture: photos?.[0]?.value ?? '',
      googleId: profile.id,
    };
    done(null, user);
  }
}
