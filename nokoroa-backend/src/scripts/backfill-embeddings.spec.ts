import { exitCodeFor, tallyBackfill } from './backfill-embeddings';

import type { EmbeddingsService } from '../embeddings/embeddings.service';

describe('tallyBackfill', () => {
  // backfill はプロバイダ切替時の唯一の復旧手段で、README は
  // 「成否は終了コードで判定してください」を運用手順に組み込んでいる。
  // その終了コードの根拠がここの勘定なので、取り違えを固定する。
  const logger = { warn: jest.fn() };

  const buildEmbeddings = (
    impl: (postId: number) => Promise<boolean>,
  ): Pick<EmbeddingsService, 'generateForPostStrict'> => ({
    generateForPostStrict: jest.fn((postId: number) => impl(postId)),
  });

  const posts = [1, 2, 3].map((id) => ({
    id,
    title: `t${id}`,
    content: `c${id}`,
  }));

  beforeEach(() => jest.clearAllMocks());

  it('全件書けたら success だけが増える', async () => {
    const tally = await tallyBackfill(
      posts,
      buildEmbeddings(() => Promise.resolve(true)),
      logger,
    );

    expect(tally).toEqual({ success: 3, skipped: 0, failed: 0 });
  });

  it('例外は failed に数え、success には混ぜない', async () => {
    // 旧実装は失敗をログに出して正常 return する側を呼んでいたため、
    // 全件失敗しても success=N / failed=0 と報告していた。
    const tally = await tallyBackfill(
      posts,
      buildEmbeddings((id) =>
        id === 2 ? Promise.reject(new Error('503')) : Promise.resolve(true),
      ),
      logger,
    );

    expect(tally).toEqual({ success: 2, skipped: 0, failed: 1 });
  });

  it('書かなかった投稿は skipped に数え、success には混ぜない', async () => {
    // 埋め込みが作られていないのに success に数えると、
    // 「直したつもり」で歯抜けのまま運用が続く。
    const tally = await tallyBackfill(
      posts,
      buildEmbeddings((id) => Promise.resolve(id !== 3)),
      logger,
    );

    expect(tally).toEqual({ success: 2, skipped: 1, failed: 0 });
  });

  it('1 件失敗しても残りを最後まで処理する', async () => {
    const embeddings = buildEmbeddings((id) =>
      id === 1 ? Promise.reject(new Error('503')) : Promise.resolve(true),
    );

    const tally = await tallyBackfill(posts, embeddings, logger);

    expect(embeddings.generateForPostStrict).toHaveBeenCalledTimes(3);
    expect(tally.success).toBe(2);
  });
});

describe('exitCodeFor', () => {
  // README が「成否は終了コードで判定してください」を運用手順にしている。
  it('失敗が 1 件でもあれば非ゼロ', () => {
    expect(exitCodeFor({ success: 9, skipped: 0, failed: 1 })).toBe(1);
  });

  it('全件成功なら 0', () => {
    expect(exitCodeFor({ success: 3, skipped: 0, failed: 0 })).toBe(0);
  });

  it('skipped だけなら 0（失敗ではなく対象外のため）', () => {
    expect(exitCodeFor({ success: 0, skipped: 5, failed: 0 })).toBe(0);
  });
});
