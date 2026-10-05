import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';

import { createValidationPipe } from './validation';

/**
 * 本番(main.ts)と E2E で**必ず一致していなければならない**リクエスト処理の設定。
 *
 * ここに集約している理由: cookie-parser を main.ts にだけ書くと、E2E は自前で
 * アプリを組み直しているため main.ts の 1 行を消しても全テストが緑のままになる
 * （本番だけブラウザのクッキー認証が全滅し、Swagger の Bearer だけ通る状態になる）。
 * 両者が同じ関数を呼ぶことで、この配線の回帰が E2E で落ちるようにする。
 *
 * helmet / CORS / setGlobalPrefix / Swagger など、E2E が再現していない設定は
 * ここには入れない（入れると既存 E2E のパスが全部変わる）。
 */
export function applySharedHttpSetup(app: INestApplication): void {
  // JWT は httpOnly クッキーで渡すため、req.cookies を使えるようにする。
  // これが無いと JwtStrategy のクッキー取り出しが常に空振りする。
  app.use(cookieParser());
  // 素の ValidationPipe だと transform が効かないため、共通の設定を使う。
  app.useGlobalPipes(createValidationPipe());
}
