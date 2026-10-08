import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import {
  Strategy,
  StrategyOptions,
  Profile,
  VerifyCallback,
} from 'passport-google-oauth20';

import { OAuthStateCookieStore } from '../oauth-state.store';

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
 *
 * email は「Google 側で確認済み」であることが前提。AuthService.googleLogin は
 * この email で既存アカウントを探して googleId を紐付けるため、未確認の
 * メールアドレスが入ると他人のアカウントを乗っ取れてしまう。
 * この前提を担保しているのは下の GoogleStrategy.validate のみ
 * （GoogleUser を作る経路は他に無い）。
 */
export interface GoogleUser {
  email: string;
  name: string;
  picture: string;
  googleId: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(private configService: ConfigService) {
    super({
      clientID: requireGoogleEnv(configService, 'GOOGLE_CLIENT_ID'),
      clientSecret: requireGoogleEnv(configService, 'GOOGLE_CLIENT_SECRET'),
      callbackURL: requireGoogleEnv(configService, 'GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
      // コールバックが認証クッキーを発行する以上、そのリクエストが本人の開始した
      // 認証の続きであることを確かめる必要がある。詳細は OAuthStateCookieStore。
      //
      // `store` は passport-oauth2 が解釈するオプションだが
      // @types/passport-google-oauth20 の StrategyOptions には宣言が無いため、
      // ここだけ型を広げて渡す（実体は lib/strategy.js の options.store）。
      store: new OAuthStateCookieStore(),
    } as StrategyOptions & { store: OAuthStateCookieStore });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const { name, emails, photos } = profile;
    const primaryEmail = emails?.[0];

    // メールアドレスが無い / Google 側で未確認の場合はログインを拒否する。
    // googleLogin は email で既存ユーザーを探して googleId を紐付けるため、
    // 未確認のメールアドレスを信じると「他人のメールで作った Google アカウント」
    // から既存ユーザーを乗っ取れてしまう。
    // verified は Google の userinfo の email_verified（真偽値）由来なので、
    // true との厳密比較で判定する。
    if (!primaryEmail?.value || primaryEmail.verified !== true) {
      // 厳密比較なので、Google が将来 email_verified の形を変えると
      // 「全 Google ログインが拒否される」形で壊れる(安全側ではあるが可用性は全損)。
      // 障害時に原因へ辿れるよう、拒否の理由を型つきで残す。
      // メールアドレス自体は個人情報なのでログに出さない。
      this.logger.warn(
        `Rejected Google login: hasEmail=${Boolean(primaryEmail?.value)} ` +
          `verified=${JSON.stringify(primaryEmail?.verified)}`,
      );
      done(
        new UnauthorizedException(
          'Google アカウントの確認済みメールアドレスが取得できませんでした',
        ),
      );
      return;
    }

    const user: GoogleUser = {
      // 上の検証を通った値をそのまま使う。emails?.[0]?.value を読み直すと
      // 「確認済みであることを検証した値」との対応が切れる。
      email: primaryEmail.value,
      name: (name?.givenName ?? '') + ' ' + (name?.familyName ?? ''),
      picture: photos?.[0]?.value ?? '',
      googleId: profile.id,
    };
    done(null, user);
  }
}
