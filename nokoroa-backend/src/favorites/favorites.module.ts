import { Module } from '@nestjs/common';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';

@Module({
  controllers: [FavoritesController],
  // PrismaService は @Global() な PrismaModule が提供する（再宣言すると別インスタンスになる）
  providers: [FavoritesService],
})
export class FavoritesModule {}
