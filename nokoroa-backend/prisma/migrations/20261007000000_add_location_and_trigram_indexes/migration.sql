-- 全表走査になっていた 2 経路にインデックスを張る。
-- 20260926000000_add_missing_indexes の続きで、そこで漏れていた分を補う。
--
-- 注意: prisma migrate diff は post_embedding_embedding_idx (pgvector の HNSW) の
-- DROP INDEX も生成するが、Unsupported 型で schema.prisma に宣言できないだけの
-- drift であり実体は必要なため、意図的に含めていない
-- (20260926000000 と同じ方針。CI は .github/workflows/ci.yml の
--  "Verify pgvector HNSW index" で実在を検証している)。

-- 1) post.locationId は外部キーかつ絞り込み・集計キーだが索引が無かった。
--    PostgreSQL は外部キーに自動で索引を張らない。
--    これが無いと次がすべて post の Seq Scan になる:
--      - getLocations() の _count.posts
--        (locationId IN (...) GROUP BY "locationId")
--      - search({ location }) の locationId IN (SELECT id FROM location WHERE ...)
--      - location 行削除時の ON DELETE SET NULL
CREATE INDEX "post_locationId_idx" ON "public"."post"("locationId");

-- 2) キーワード検索は contains + mode:'insensitive' = ILIKE '%q%' で、
--    前方一致でないため B-tree を一切使えない。
--    posts.service.ts の search() は 1 回で findMany + count の 2 回走査し、
--    chat.service.ts のフォールバックは MAX_FALLBACK_KEYWORDS=5 回これを
--    直列実行するため、ベクトル検索が 0 件のチャット 1 リクエストで
--    最大 12 回の post 全表走査になる (post.content は最大 10,000 文字)。
--    pg_trgm の GIN 索引は ILIKE '%...%' に効くため、ここで用意する。
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 検索対象は post.title / post.content / "user".name / location.name の 4 列。
-- gin_trgm_ops は ILIKE の両端ワイルドカードでも使える。
CREATE INDEX "post_title_trgm_idx" ON "public"."post" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "post_content_trgm_idx" ON "public"."post" USING GIN ("content" gin_trgm_ops);
CREATE INDEX "user_name_trgm_idx" ON "public"."user" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "location_name_trgm_idx" ON "public"."location" USING GIN ("name" gin_trgm_ops);
