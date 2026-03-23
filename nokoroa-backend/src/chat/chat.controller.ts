import { Body, Controller, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { ChatService } from './chat.service';
import { ChatRequestDto } from './dto/chat-request.dto';
import { RelatedPostsRequestDto } from './dto/related-posts-request.dto';
import { SuggestionsRequestDto } from './dto/suggestions-request.dto';

@Controller('chat')
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
