import { describe, expect, it, vi } from 'vitest';

import { consumeChatStream } from '../useChatStream';

/** 文字列の配列を SSE のストリームとして読ませる */
function readerOf(frames: string[]) {
  const encoder = new TextEncoder();
  let index = 0;
  return {
    read: () =>
      Promise.resolve(
        index < frames.length
          ? { done: false, value: encoder.encode(frames[index++]) }
          : { done: true, value: undefined },
      ),
  } as unknown as ReadableStreamDefaultReader<Uint8Array>;
}

async function consume(frames: string[]) {
  const onText = vi.fn();
  const onRelatedPosts = vi.fn();
  const result = await consumeChatStream(
    readerOf(frames),
    onText,
    onRelatedPosts,
  );
  return { ...result, onText, onRelatedPosts };
}

describe('consumeChatStream', () => {
  it('本文を順に onText へ渡す', async () => {
    const { fullResponse, onText } = await consume([
      'data: こんにちは\n\n',
      'data: 旅行のご相談ですね\n\n',
      'data: [DONE]\n\n',
    ]);

    expect(fullResponse).toBe('こんにちは旅行のご相談ですね');
    expect(onText).toHaveBeenCalledTimes(2);
  });

  // AIサービスが backend 向けに送る申告。コメント行なので data 行を持たず、
  // 本文として表示されてはいけない。
  it('申告コメント行を本文として扱わない', async () => {
    const { fullResponse, onText } = await consume([
      'data: 回答です\n\n',
      ':used_posts {"ids": [1, 2]}\n\n',
      'data: [DONE]\n\n',
    ]);

    expect(fullResponse).toBe('回答です');
    expect(onText).toHaveBeenCalledTimes(1);
  });

  it('名前付きの related_posts を関連投稿として受け取る', async () => {
    const posts = [{ id: 1, title: 'T' }];
    const { relatedPosts, onRelatedPosts, fullResponse } = await consume([
      'data: 回答です\n\n',
      `event: related_posts\ndata: ${JSON.stringify({ type: 'related_posts', posts })}\n\n`,
      'data: [DONE]\n\n',
    ]);

    expect(onRelatedPosts).toHaveBeenCalledOnce();
    expect(relatedPosts).toEqual(posts);
    expect(fullResponse).toBe('回答です');
  });

  // 名前を付けない旧 backend とも繋がること
  it('event 名が無くても type で related_posts を判別する', async () => {
    const posts = [{ id: 9, title: 'T' }];
    const { relatedPosts } = await consume([
      `data: ${JSON.stringify({ type: 'related_posts', posts })}\n\n`,
      'data: [DONE]\n\n',
    ]);

    expect(relatedPosts).toEqual(posts);
  });

  // 制御イベントでない JSON は本文。一律に捨てると画面から本文が消える。
  it('制御イベントでないJSONの本文は表示する', async () => {
    const { fullResponse } = await consume([
      'data: {"type": "旅館", "name": "星のや"}\n\n',
      'data: [DONE]\n\n',
    ]);

    expect(fullResponse).toBe('{"type": "旅館", "name": "星のや"}');
  });

  it('改行を含む本文を複数の data 行から復元する', async () => {
    const { fullResponse } = await consume([
      'data: 1行目\ndata: 2行目\n\n',
      'data: [DONE]\n\n',
    ]);

    expect(fullResponse).toBe('1行目\n2行目');
  });

  it('[ERROR] 番兵で例外を投げる', async () => {
    await expect(
      consume(['data: [ERROR] chat stream failed\n\n']),
    ).rejects.toThrow('[ERROR]');
  });
});
