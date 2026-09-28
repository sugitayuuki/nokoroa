import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { FavoritesService } from './favorites.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OffsetPaginationDto } from '../common/pagination.dto';

@ApiTags('favorites')
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post(':postId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'ブックマーク追加',
    description: '投稿をブックマークに追加します',
  })
  @ApiParam({ name: 'postId', description: '投稿ID', example: 1 })
  @ApiResponse({ status: 201, description: '追加成功' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  @ApiResponse({ status: 404, description: '投稿が見つかりません' })
  async addFavorite(
    @Param('postId', ParseIntPipe) postId: number,
    @Request() req: { user: { userId: number } },
  ) {
    return this.favoritesService.addFavorite(req.user.userId, postId);
  }

  @Delete(':postId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'ブックマーク解除',
    description: '投稿のブックマークを解除します',
  })
  @ApiParam({ name: 'postId', description: '投稿ID', example: 1 })
  @ApiResponse({ status: 200, description: '解除成功' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  async removeFavorite(
    @Param('postId', ParseIntPipe) postId: number,
    @Request() req: { user: { userId: number } },
  ) {
    return this.favoritesService.removeFavorite(req.user.userId, postId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'ブックマーク一覧取得',
    description: '自分のブックマーク一覧を取得します',
  })
  @ApiResponse({ status: 200, description: '取得成功' })
  @ApiResponse({ status: 400, description: 'ページネーション指定が不正です' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  async getUserFavorites(
    @Request() req: { user: { userId: number } },
    @Query() pagination: OffsetPaginationDto,
  ) {
    return this.favoritesService.getUserFavorites(
      req.user.userId,
      pagination.limit,
      pagination.offset,
    );
  }

  @Get('check/:postId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'ブックマーク状態確認',
    description: '投稿のブックマーク状態を確認します',
  })
  @ApiParam({ name: 'postId', description: '投稿ID', example: 1 })
  @ApiResponse({ status: 200, description: '確認成功' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  async checkFavoriteStatus(
    @Param('postId', ParseIntPipe) postId: number,
    @Request() req: { user: { userId: number } },
  ) {
    return this.favoritesService.checkFavoriteStatus(req.user.userId, postId);
  }

  @Get('stats/:postId')
  @ApiOperation({
    summary: 'ブックマーク統計取得',
    description: '投稿のブックマーク数を取得します',
  })
  @ApiParam({ name: 'postId', description: '投稿ID', example: 1 })
  @ApiResponse({ status: 200, description: '取得成功' })
  async getFavoriteStats(@Param('postId', ParseIntPipe) postId: number) {
    return this.favoritesService.getFavoriteStats(postId);
  }
}
