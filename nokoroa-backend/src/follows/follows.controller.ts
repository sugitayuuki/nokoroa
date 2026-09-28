import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { FollowsService } from './follows.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../common/authenticated-request';
import { PagePaginationDto } from '../common/pagination.dto';

@ApiTags('follows')
@Controller('follows')
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @Post(':userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'フォローする',
    description: '指定したユーザーをフォローします',
  })
  @ApiParam({
    name: 'userId',
    description: 'フォロー対象のユーザーID',
    example: 1,
  })
  @ApiResponse({ status: 201, description: 'フォロー成功' })
  @ApiResponse({ status: 400, description: '自分自身はフォローできません' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  @ApiResponse({ status: 404, description: 'ユーザーが見つかりません' })
  async follow(
    @Request() req: AuthenticatedRequest,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return await this.followsService.follow(req.user.userId, userId);
  }

  @Delete(':userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'フォロー解除',
    description: '指定したユーザーのフォローを解除します',
  })
  @ApiParam({
    name: 'userId',
    description: 'フォロー解除対象のユーザーID',
    example: 1,
  })
  @ApiResponse({ status: 200, description: 'フォロー解除成功' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  async unfollow(
    @Request() req: AuthenticatedRequest,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return await this.followsService.unfollow(req.user.userId, userId);
  }

  @Get('check/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'フォロー状態確認',
    description: '指定したユーザーをフォローしているか確認します',
  })
  @ApiParam({ name: 'userId', description: '確認対象のユーザーID', example: 1 })
  @ApiResponse({ status: 200, description: '確認成功' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  async checkFollowStatus(
    @Request() req: AuthenticatedRequest,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return await this.followsService.checkFollowStatus(req.user.userId, userId);
  }

  @Get(':userId/followers')
  @ApiOperation({
    summary: 'フォロワー一覧取得',
    description: '指定したユーザーのフォロワー一覧を取得します',
  })
  @ApiParam({ name: 'userId', description: 'ユーザーID', example: 1 })
  @ApiResponse({ status: 200, description: '取得成功' })
  @ApiResponse({ status: 400, description: 'ページネーション指定が不正です' })
  async getFollowers(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() pagination: PagePaginationDto,
  ) {
    return await this.followsService.getFollowers(
      userId,
      pagination.page,
      pagination.limit,
    );
  }

  @Get(':userId/following')
  @ApiOperation({
    summary: 'フォロー中一覧取得',
    description: '指定したユーザーがフォローしているユーザー一覧を取得します',
  })
  @ApiParam({ name: 'userId', description: 'ユーザーID', example: 1 })
  @ApiResponse({ status: 200, description: '取得成功' })
  @ApiResponse({ status: 400, description: 'ページネーション指定が不正です' })
  async getFollowing(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() pagination: PagePaginationDto,
  ) {
    return await this.followsService.getFollowing(
      userId,
      pagination.page,
      pagination.limit,
    );
  }

  @Get(':userId/stats')
  @ApiOperation({
    summary: 'フォロー統計取得',
    description: 'フォロワー数・フォロー中数を取得します',
  })
  @ApiParam({ name: 'userId', description: 'ユーザーID', example: 1 })
  @ApiResponse({ status: 200, description: '取得成功' })
  async getFollowStats(@Param('userId', ParseIntPipe) userId: number) {
    return await this.followsService.getFollowStats(userId);
  }
}
