import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { PostsService } from '../posts/posts.service';
import { ChatRequestDto } from './dto/chat-request.dto';
import { RelatedPostsRequestDto } from './dto/related-posts-request.dto';
import { SuggestionsRequestDto } from './dto/suggestions-request.dto';

@Injectable()
export class ChatService {
  private readonly aiServiceUrl: string;

  constructor(
    private configService: ConfigService,
    private postsService: PostsService,
  ) {
    this.aiServiceUrl =
      this.configService.get<string>('AI_SERVICE_URL') ||
      'http://localhost:8000';
  }

  async streamChat(dto: ChatRequestDto, res: Response): Promise<void> {
    const response = await fetch(`${this.aiServiceUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: dto.message,
        history: dto.history || [],
      }),
    });

    if (!response.ok || !response.body) {
      res.status(response.status).json({ error: 'AI service request failed' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
    } finally {
      res.end();
    }
  }

  async getSuggestions(dto: SuggestionsRequestDto): Promise<string[]> {
    const response = await fetch(
      `${this.aiServiceUrl}/api/chat/suggestions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: dto.message,
          ai_response: dto.ai_response,
        }),
      },
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.suggestions || [];
  }

  async getRelatedPosts(dto: RelatedPostsRequestDto) {
    try {
      const keywordsRes = await fetch(
        `${this.aiServiceUrl}/api/chat/related-keywords`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: dto.message,
            ai_response: dto.ai_response,
          }),
        },
      );

      if (!keywordsRes.ok) {
        return { posts: [] };
      }

      const keywordsData = await keywordsRes.json();
      const keywords = keywordsData.keywords;

      if (!keywords) {
        return { posts: [] };
      }

      const result = await this.postsService.search({
        location: keywords.location,
        limit: 3,
        offset: 0,
      });

      if (result.posts.length > 0) {
        return { posts: result.posts };
      }

      const fallbackResult = await this.postsService.search({
        q: keywords.location,
        limit: 3,
        offset: 0,
      });

      return { posts: fallbackResult.posts };
    } catch {
      return { posts: [] };
    }
  }
}
