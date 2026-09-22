import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { isDevelopmentEnv } from '../common/environment';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // queryログはWHERE句の値(メールアドレス等)をそのまま出力するため、
    // 開発環境に限定する(本番のログ基盤への流出とテスト出力の汚染を防ぐ)。
    super({
      log: isDevelopmentEnv()
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
