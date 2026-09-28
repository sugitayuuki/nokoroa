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

export interface GoogleUser {
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  picture: string;
  googleId: string;
  accessToken: string;
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
    accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const { name, emails, photos } = profile;
    const user: GoogleUser = {
      email: emails?.[0]?.value ?? '',
      firstName: name?.givenName ?? '',
      lastName: name?.familyName ?? '',
      name: (name?.givenName ?? '') + ' ' + (name?.familyName ?? ''),
      picture: photos?.[0]?.value ?? '',
      googleId: profile.id,
      accessToken,
    };
    done(null, user);
  }
}
