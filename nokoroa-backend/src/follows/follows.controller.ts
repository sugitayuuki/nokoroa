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
import { FollowsService } from './follows.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
    email: string;
  };
}

@Controller('follows')
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @Post(':userId')
  @UseGuards(JwtAuthGuard)
  async follow(
    @Request() req: AuthenticatedRequest,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return await this.followsService.follow(req.user.userId, userId);
  }

  @Delete(':userId')
  @UseGuards(JwtAuthGuard)
  async unfollow(
    @Request() req: AuthenticatedRequest,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return await this.followsService.unfollow(req.user.userId, userId);
  }

  @Get('check/:userId')
  @UseGuards(JwtAuthGuard)
  async checkFollowStatus(
    @Request() req: AuthenticatedRequest,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return await this.followsService.checkFollowStatus(req.user.userId, userId);
  }

  @Get(':userId/followers')
  async getFollowers(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return await this.followsService.getFollowers(
      userId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Get(':userId/following')
  async getFollowing(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return await this.followsService.getFollowing(
      userId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Get(':userId/stats')
  async getFollowStats(@Param('userId', ParseIntPipe) userId: number) {
    return await this.followsService.getFollowStats(userId);
  }
}
