import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { cleanupDatabase, prisma } from './setup';
import { AppModule } from '../src/app.module';
import {
  EMBEDDING_DIM,
  EmbeddingsService,
} from '../src/embeddings/embeddings.service';

/**
 * pgvector を使う raw SQL を、モックではなく実DBに対して検証する。
 *
 * 単体テストは Prisma をモックするため、SQL の識別子ミスや型キャストの誤りを
 * 検出できない。ここでは AI サービスだけをスタブし、SQL は実際に実行する。
 */
describe('Embeddings raw SQL (e2e)', () => {
  let app: INestApplication;
  let embeddings: EmbeddingsService;
  let authorId: number;

  const fakeVector = (seed: number) =>
    Array.from({ length: EMBEDDING_DIM }, (_, i) => ((i + seed) % 10) / 10);

  const stubAiService = (vector: number[]) => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ embedding: vector }),
      } as Response),
    ) as unknown as typeof fetch;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    embeddings = app.get(EmbeddingsService);
  });

  beforeEach(async () => {
    await cleanupDatabase();
    const author = await prisma.user.create({
      data: { email: 'emb@example.com', name: 'Emb', password: 'x' },
    });
    authorId = author.id;
  });

  afterAll(async () => {
    await cleanupDatabase();
    await app.close();
  });

  const createPost = async (title: string, isPublic = true) => {
    const post = await prisma.post.create({
      data: {
        title,
        content: `${title} の本文`,
        imageUrl: 'https://example.com/a.jpg',
        isPublic,
        authorId,
      },
    });
    return post.id;
  };

  it('埋め込みを保存し、コサイン距離で検索できる', async () => {
    const nearId = await createPost('近い投稿');
    const farId = await createPost('遠い投稿');

    stubAiService(fakeVector(0));
    await embeddings.generateForPost(nearId, '近い投稿', '本文');

    stubAiService(fakeVector(5));
    await embeddings.generateForPost(farId, '遠い投稿', '本文');

    // 近い投稿と同じベクトルで検索する
    stubAiService(fakeVector(0));
    const hits = await embeddings.searchSimilar('クエリ', 5);

    expect(hits.map((h) => h.postId)).toContain(nearId);
    expect(hits[0].postId).toBe(nearId);
    expect(hits[0].distance).toBeCloseTo(0, 5);
    // 距離順に並んでいる
    expect(hits[0].distance).toBeLessThanOrEqual(hits[1].distance);
    // Prisma raw の戻り値が number であること（BigInt ではない）
    expect(typeof hits[0].postId).toBe('number');
    expect(typeof hits[0].distance).toBe('number');
  });

  it('同じ投稿への再生成はUPSERTされ行が増えない', async () => {
    const postId = await createPost('更新される投稿');

    stubAiService(fakeVector(0));
    await embeddings.generateForPost(postId, 'v1', '本文1');
    stubAiService(fakeVector(3));
    await embeddings.generateForPost(postId, 'v2', '本文2');

    const rows = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count FROM post_embedding WHERE "postId" = ${postId}
    `;
    expect(Number(rows[0].count)).toBe(1);

    const stored = await prisma.$queryRaw<{ contentText: string }[]>`
      SELECT "contentText" FROM post_embedding WHERE "postId" = ${postId}
    `;
    expect(stored[0].contentText).toContain('v2');
  });

  it('非公開投稿は検索結果に含まれない', async () => {
    const privateId = await createPost('非公開投稿', false);

    stubAiService(fakeVector(0));
    await embeddings.generateForPost(privateId, '非公開投稿', '本文');

    stubAiService(fakeVector(0));
    const hits = await embeddings.searchSimilar('クエリ', 5);

    expect(hits.map((h) => h.postId)).not.toContain(privateId);
  });

  it('deleteForPost で行が削除される', async () => {
    const postId = await createPost('削除される投稿');

    stubAiService(fakeVector(0));
    await embeddings.generateForPost(postId, '削除される投稿', '本文');

    await embeddings.deleteForPost(postId);

    const rows = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count FROM post_embedding WHERE "postId" = ${postId}
    `;
    expect(Number(rows[0].count)).toBe(0);
  });

  it('SQLインジェクションを狙う文字列を入れても構文エラーにならず、データとして扱われる', async () => {
    const postId = await createPost('通常投稿');
    const malicious = `'); DROP TABLE post_embedding; --`;

    stubAiService(fakeVector(0));
    await embeddings.generateForPost(postId, malicious, malicious);

    // テーブルは健在で、悪意ある文字列は「値」として保存されている
    const stored = await prisma.$queryRaw<{ contentText: string }[]>`
      SELECT "contentText" FROM post_embedding WHERE "postId" = ${postId}
    `;
    expect(stored[0].contentText).toContain('DROP TABLE');

    stubAiService(fakeVector(0));
    const hits = await embeddings.searchSimilar(malicious, 5);
    expect(hits.map((h) => h.postId)).toContain(postId);
  });
});
