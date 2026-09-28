import { ValidationPipe } from '@nestjs/common';

/**
 * アプリ全体で使う ValidationPipe の唯一の生成箇所。
 *
 * e2e が素の `new ValidationPipe()` を使うと transform が効かず、
 * @Query() DTO の数値が文字列のまま Prisma に渡って 500 になるなど、
 * 本番(main.ts)と異なる挙動をテストしてしまう。オプションの正は
 * ここだけに置き、main.ts と HTTP を叩く e2e の双方がこれを使う。
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}
