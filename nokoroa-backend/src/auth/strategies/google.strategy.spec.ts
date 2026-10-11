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

  // 実際に観測された不具合。givenName + familyName の連結は常に「名 姓」に
  // なるため、姓を先に書く文化圏の利用者が逆順で登録されていた。
  // 既定の buildProfile は displayName と連結結果がどちらも 'Google User' で
  // 両者を区別できないため、ここでは順序が食い違うプロフィールを使う。
  it('姓を先に書く名前は displayName の順序をそのまま使う', () => {
    const done = validate({
      id: 'google-123',
      displayName: '杉田 裕貴',
      name: { givenName: '裕貴', familyName: '杉田' },
      emails: [{ value: 'verified@example.com', verified: true }],
      photos: [{ value: 'https://example.com/avatar.jpg' }],
      provider: 'google',
    } as Profile);

    expect(done).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ name: '杉田 裕貴' }),
    );
  });

  // displayName が無いときだけ連結に落とす。順序の手がかりが無いので
  // 従来どおり「名 姓」で繋ぐ。
  it('displayName が空なら givenName + familyName に落とす', () => {
    const done = validate({
      id: 'google-123',
      displayName: '   ',
      name: { givenName: 'Ada', familyName: 'Lovelace' },
      emails: [{ value: 'verified@example.com', verified: true }],
      photos: [{ value: 'https://example.com/avatar.jpg' }],
      provider: 'google',
    } as Profile);

    expect(done).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ name: 'Ada Lovelace' }),
    );
  });

  // 片方しか無い場合に余分な空白が残らないこと(以前は ' ' 連結のため
  // 'Ada ' のように末尾へ空白が付いた)
  it('姓が無い場合に余分な空白を付けない', () => {
    const done = validate({
      id: 'google-123',
      displayName: '',
      name: { givenName: 'Ada' },
      emails: [{ value: 'verified@example.com', verified: true }],
      photos: [{ value: 'https://example.com/avatar.jpg' }],
      provider: 'google',
    } as Profile);

    expect(done).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ name: 'Ada' }),
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
