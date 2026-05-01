import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { PostsService } from '../posts/posts.service';
import { ChatRequestDto } from './dto/chat-request.dto';
import { RelatedPostsRequestDto } from './dto/related-posts-request.dto';
import { SuggestionsRequestDto } from './dto/suggestions-request.dto';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly aiServiceUrl: string;

  constructor(
    private configService: ConfigService,
    private postsService: PostsService,
    private embeddingsService: EmbeddingsService,
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

    type ChatPost = {
      id: number;
      title?: string;
      content?: string;
      location?: string | null | { name?: string };
      author?: string | { name?: string };
      [key: string]: unknown;
    };
    const toChatPost = (p: unknown): ChatPost => p as ChatPost;

    try {
      const posts: ChatPost[] = (await this.searchByVector(dto.message, 5)).map(
        toChatPost,
      );

      if (posts.length === 0) {
        const searchResult = await this.postsService.search({
          q: dto.message,
          limit: 5,
          offset: 0,
        });
        for (const p of searchResult.posts) posts.push(toChatPost(p));
      }

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
          for (const p of wordResult.posts) {
            if (!seen.has(p.id)) {
              seen.add(p.id);
              posts.push(toChatPost(p));
            }
          }
          if (posts.length >= 5) break;
        }
        if (posts.length > 5) posts.length = 5;
      }

      if (posts.length > 0) {
        relatedPostsRaw = posts;
        contextPosts = posts.map((post) => ({
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
        }));
      }
    } catch (error) {
      this.logger.warn(
        `Failed to search related posts: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    let response: globalThis.Response;
    try {
      response = await fetch(`${this.aiServiceUrl}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: dto.message,
          history: dto.history || [],
          context_posts: contextPosts,
        }),
        signal: AbortSignal.timeout(60_000),
      });
    } catch (err) {
      this.logger.error(
        `AI chat fetch failed: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      res.status(502).json({ error: 'AI service unreachable' });
      return;
    }

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

    const data = (await response.json()) as { suggestions?: string[] };
    return data.suggestions ?? [];
  }

  private async searchByVector(
    query: string,
    limit: number,
  ): Promise<Array<Record<string, unknown>>> {
    const hits = await this.embeddingsService.searchSimilar(query, limit);
    if (hits.length === 0) return [];

    const ids = hits.map((h) => h.postId);
    const posts = await this.postsService.findManyByIds(ids);
    const byId = new Map(
      posts.map((p) => [(p as unknown as { id: number }).id, p]),
    );

    const found: Record<string, unknown>[] = [];
    for (const hit of hits) {
      const post = byId.get(hit.postId);
      if (post) found.push(post as unknown as Record<string, unknown>);
    }
    return found;
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

      const keywordsData = (await keywordsRes.json()) as {
        keywords?: { location?: string };
      };
      const keywords = keywordsData.keywords;

      if (!keywords) {
        return { posts: [] };
      }

      const location = keywords.location ?? '';

      const result = await this.postsService.search({
        location,
        limit: 3,
        offset: 0,
      });

      if (result.posts.length > 0) {
        return { posts: result.posts };
      }

      const fallbackResult = await this.postsService.search({
        q: location,
        limit: 3,
        offset: 0,
      });

      return { posts: fallbackResult.posts };
    } catch (error) {
      this.logger.warn(
        `Failed to get related posts: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return { posts: [] };
    }
  }
}
