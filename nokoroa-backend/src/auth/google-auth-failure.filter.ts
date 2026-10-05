import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

import { frontendBaseUrl } from '../common/frontend-url';

/**
 * Google 認証コールバックの失敗をフロントエンドへ戻す。
 *
 * このエンドポイントはブラウザのトップレベル遷移で到達するため、素の JSON を
 * 返すと **API オリジン上のエラーページで行き止まり**になり、ユーザーには
 * アプリへ戻る導線が無い。しかも失敗の多くはやり直せるもので、攻撃とは限らない。
 *
 * - 同意画面で時間がかかり state が失効した
 * - 複数タブでログインを始めて state が上書きされた
 * - `?code=` 付きの URL をリロードした（state は 1 度で使い切る）
 * - Google 側で未確認のメールアドレスだった
 *
 * フロントの `/auth/callback` へ戻せば、着地後に未ログインと判定されて
 * 「認証に失敗しました」のトーストが出てトップへ移動する。
 * **クエリは付けない**（この PR でトークンを URL から外した方針に合わせ、
 * 認証関連の情報を URL に載せない形を保つ）。
 */
@Catch()
export class GoogleAuthFailureFilter implements ExceptionFilter {
  private readonly logger = new Logger(GoogleAuthFailureFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    // クロスサイト拒否（FetchMetadataGuard）は「やり直せる失敗」ではなく遮断。
    // リダイレクトで隠すと、攻撃者側には正規の失敗と区別がつかなくなるうえ、
    // 拒否したはずのリクエストに応答を返す形になるため 403 のまま返す。
    if (exception instanceof ForbiddenException) {
      res.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    this.logger.warn(
      `Google callback failed: ${
        exception instanceof Error ? exception.message : String(exception)
      }`,
    );

    // 失敗時の応答もキャッシュさせない（state は store 側が消す）
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(`${frontendBaseUrl()}/auth/callback`);
  }
}
