import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserThrottlerGuard } from '../common/user-throttler.guard';
import { ChatRequestDto } from './dto/chat-request.dto';
import { RelatedPostsRequestDto } from './dto/related-posts-request.dto';
import { SuggestionsRequestDto } from './dto/suggestions-request.dto';

// 外部AI(Gemini)への従量課金が発生する経路のため、既定より厳しく制限する。
// JwtAuthGuard の後に UserThrottlerGuard を置くことで、IPではなく
// ユーザー単位で数える(同一IPの別ユーザーが枠を食い合わない / 複数IPでも回避できない)。
@Controller('chat')
@UseGuards(JwtAuthGuard, UserThrottlerGuard)
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
