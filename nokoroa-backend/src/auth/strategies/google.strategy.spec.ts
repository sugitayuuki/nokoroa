import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Profile } from 'passport-google-oauth20';

import { GoogleStrategy } from './google.strategy';
import { GOOGLE_CALLBACK_PATH } from '../google-callback-path';

describe('GoogleStrategy', () => {
  const configService = {
    get: (key: string) =>
      ({
        GOOGLE_CLIENT_ID: 'client-id',
        GOOGLE_CLIENT_SECRET: 'client-secret',
        GOOGLE_CALLBACK_URL: `http://localhost:4000${GOOGLE_CALLBACK_PATH}`,
      })[key],
  } as unknown as ConfigService;

  // describe 本体で new すると、コンストラクタが throw した場合に
  // 個別テストの失敗ではなくスイート全体の収集エラーになり原因が読めない
  let strategy: GoogleStrategy;

  beforeAll(() => {
    strategy = new GoogleStrategy(configService);
  });

  const buildProfile = (emails: Profile['emails']): Profile =>
    ({
      id: 'google-123',
      displayName: 'Google User',
      name: { givenName: 'Google', familyName: 'User' },
      emails,
      photos: [{ value: 'https://example.com/avatar.jpg' }],
      provider: 'google',
    }) as Profile;

  const validate = (profile: Profile) => {
    const done = jest.fn<void, [unknown, unknown?]>();
    strategy.validate('access-token', 'refresh-token', profile, done);
    return done;
  };

  it('確認済みメールアドレスならログインを許可する', () => {
    const done = validate(
      buildProfile([{ value: 'verified@example.com', verified: true }]),
    );

    expect(done).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        email: 'verified@example.com',
        googleId: 'google-123',
        name: 'Google User',
      }),
    );
  });

  // 未確認メールを信じると、他人のメールで作った Google アカウントから
  // 既存ユーザーに googleId を紐付けられてしまう(アカウント乗っ取り)
  it('未確認メールアドレスではログインを拒否する', () => {
    const done = validate(
      buildProfile([{ value: 'unverified@example.com', verified: false }]),
    );

    expect(done).toHaveBeenCalledWith(expect.any(UnauthorizedException));
    expect(done.mock.calls[0][1]).toBeUndefined();
  });

  it('verified が欠けている場合もログインを拒否する(未確認として扱う)', () => {
    const done = validate(
      buildProfile([
        { value: 'unknown@example.com' } as {
          value: string;
          verified: boolean;
        },
      ]),
    );

    expect(done).toHaveBeenCalledWith(expect.any(UnauthorizedException));
  });

  it('メールアドレスが無い場合はログインを拒否する', () => {
    const done = validate(buildProfile([]));

    expect(done).toHaveBeenCalledWith(expect.any(UnauthorizedException));
  });

  it('emails 自体が無い場合もログインを拒否する', () => {
    const done = validate(buildProfile(undefined));

    expect(done).toHaveBeenCalledWith(expect.any(UnauthorizedException));
  });
});
