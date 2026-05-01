-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "post_embedding" (
    "id" SERIAL NOT NULL,
    "postId" INTEGER NOT NULL,
    "contentText" TEXT NOT NULL,
    "embedding" vector(768) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_embedding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "post_embedding_postId_key" ON "post_embedding"("postId");

-- Vector index for cosine similarity search (HNSW for high-quality ANN)
CREATE INDEX "post_embedding_embedding_idx"
  ON "post_embedding"
  USING hnsw (embedding vector_cosine_ops);

-- AddForeignKey
ALTER TABLE "post_embedding"
  ADD CONSTRAINT "post_embedding_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "post"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
