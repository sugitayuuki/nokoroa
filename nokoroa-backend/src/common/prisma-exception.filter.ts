import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';

/**
 * Prisma の既知エラーを HTTP ステータスへ写像する。
 *
 * 未処理のままだと、利用者起因の一意制約違反(メールアドレス重複など)まで
 * 500 になり、さらに Prisma のメッセージ(テーブル名・カラム名)が
 * レスポンスに載る可能性がある。
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter
  extends BaseExceptionFilter
  implements ExceptionFilter
{
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(
    exception: Prisma.PrismaClientKnownRequestError,
    host: ArgumentsHost,
  ): void {
    this.logger.warn(`Prisma error ${exception.code}`);

    switch (exception.code) {
      case 'P2002':
        super.catch(new ConflictException('既に登録されています'), host);
        return;
      case 'P2025':
        super.catch(new NotFoundException('対象が見つかりません'), host);
        return;
      default:
        super.catch(
          new HttpException(
            'Internal server error',
            HttpStatus.INTERNAL_SERVER_ERROR,
          ),
          host,
        );
    }
  }
}
