import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  UserScopedThrottle,
  UserThrottlerGuard,
} from '../common/user-throttler.guard';
import { ChatRequestDto } from './dto/chat-request.dto';
import { RelatedPostsRequestDto } from './dto/related-posts-request.dto';
import { SuggestionsRequestDto } from './dto/suggestions-request.dto';

// 外部AI(Gemini)への従量課金が発生する経路のため、既定より厳しく制限する。
// JwtAuthGuard の後に UserThrottlerGuard を置くことでユーザー単位で数え、
// 1アカウントが複数IPを使っても回避できないようにする。
// @UserScopedThrottle() でグローバルのIP単位ガードを外さないと、この 20/分が
// IP単位でも適用され、共有NAT配下の別ユーザーが巻き添えで 429 になる。
@Controller('chat')
@UseGuards(JwtAuthGuard, UserThrottlerGuard)
@UserScopedThrottle()
@Throttle({ default: { ttl: 60_000, limit: 20 } })
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('stream')
  async stream(
    @Body() dto: ChatRequestDto,
    @Res() res: Response,
  ): Promise<void> {
    await this.chatService.streamChat(dto, res);
  }

  @Post('suggestions')
  async suggestions(
    @Body() dto: SuggestionsRequestDto,
  ): Promise<{ suggestions: string[] }> {
    const suggestions = await this.chatService.getSuggestions(dto);
    return { suggestions };
  }

  @Post('related-posts')
  async relatedPosts(@Body() dto: RelatedPostsRequestDto) {
    return this.chatService.getRelatedPosts(dto);
  }
}
