-- 非ユニークインデックスの追加。
-- PostgreSQL は外部キーに自動でインデックスを張らず、複合 unique は先頭列以外の
-- 単独絞り込みに使えないため、実際のクエリに合わせて明示する。
--
-- 注意: prisma migrate diff は post_embedding_embedding_idx (pgvector の HNSW) の
-- DROP INDEX も生成するが、Unsupported 型で schema.prisma に宣言できないだけの
-- drift であり実体は必要なため、意図的に含めていない。

-- 一覧: where isPublic + order by createdAt desc (posts.service.ts findAll)
CREATE INDEX "post_isPublic_createdAt_idx" ON "public"."post"("isPublic", "createdAt");

-- プロフィール / マイ投稿: author 単位 + createdAt 降順 (users.service.ts)
CREATE INDEX "post_authorId_createdAt_idx" ON "public"."post"("authorId", "createdAt");

-- タグ絞り込みとタグ別件数の集計は tagId 単独 (@@unique は postId が先頭で使えない)
CREATE INDEX "post_tag_tagId_idx" ON "public"."post_tag"("tagId");

-- ブックマーク一覧: userId 絞り込み + createdAt 降順 (favorites.service.ts)
CREATE INDEX "bookmark_userId_createdAt_idx" ON "public"."bookmark"("userId", "createdAt");

-- 投稿ごとのブックマーク数は postId 単独 (@@unique は userId が先頭で使えない)
CREATE INDEX "bookmark_postId_idx" ON "public"."bookmark"("postId");

-- フォロワー一覧: followingId 絞り込み + createdAt 降順 (@@unique は followerId が先頭)
CREATE INDEX "follow_followingId_createdAt_idx" ON "public"."follow"("followingId", "createdAt");

-- フォロー中一覧: followerId 絞り込み + createdAt 降順 (unique は並び順を賄えない)
CREATE INDEX "follow_followerId_createdAt_idx" ON "public"."follow"("followerId", "createdAt");
