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
    let contextPosts: Array<{
      title: string;
      content: string;
      location: string;
      author: string;
    }> = [];
    let relatedPostsRaw: unknown[] = [];

    try {
      const searchResult = await this.postsService.search({
        q: dto.message,
        limit: 5,
        offset: 0,
      });

      let posts = searchResult.posts;

      if (posts.length === 0) {
        const words = dto.message
          .split(/[\s\u3000,、。のはがをでにへともより]+/)
          .filter((w) => w.length >= 2);
        const seen = new Set<number>();
        for (const word of words) {
          const wordResult = await this.postsService.search({
            q: word,
            limit: 5,
            offset: 0,
          });
          for (const post of wordResult.posts) {
            if (!seen.has(post.id)) {
              seen.add(post.id);
              posts.push(post);
            }
          }
          if (posts.length >= 5) break;
        }
        posts = posts.slice(0, 5);
      }

      if (posts.length > 0) {
        relatedPostsRaw = posts;
        contextPosts = posts.map(
          (post: {
            title?: string;
            content?: string;
            location?: string | { name?: string };
            author?: string | { name?: string };
          }) => ({
            title: post.title || '',
            content: post.content || '',
            location:
              typeof post.location === 'string'
                ? post.location
                : post.location?.name || '',
            author:
              typeof post.author === 'string'
                ? post.author
                : post.author?.name || '',
          }),
        );
      }
    } catch {
      // noop
    }

    const response = await fetch(`${this.aiServiceUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: dto.message,
        history: dto.history || [],
        context_posts: contextPosts,
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
      if (relatedPostsRaw.length > 0) {
        const relatedPostsEvent = JSON.stringify({
          type: 'related_posts',
          posts: relatedPostsRaw,
        });
        res.write(`data: ${relatedPostsEvent}\n\n`);
      }
    } finally {
      res.end();
    }
  }

  async getSuggestions(dto: SuggestionsRequestDto): Promise<string[]> {
    const response = await fetch(`${this.aiServiceUrl}/api/chat/suggestions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: dto.message,
        ai_response: dto.ai_response,
      }),
    });

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
