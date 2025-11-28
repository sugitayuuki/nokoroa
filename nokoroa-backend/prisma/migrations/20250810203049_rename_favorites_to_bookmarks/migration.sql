/*
  Warnings:

  - You are about to drop the `favorite` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."favorite" DROP CONSTRAINT "favorite_postId_fkey";

-- DropForeignKey
ALTER TABLE "public"."favorite" DROP CONSTRAINT "favorite_userId_fkey";

-- DropTable
DROP TABLE "public"."favorite";

-- CreateTable
CREATE TABLE "public"."bookmark" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    "postId" INTEGER NOT NULL,

    CONSTRAINT "bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bookmark_userId_postId_key" ON "public"."bookmark"("userId", "postId");

-- AddForeignKey
ALTER TABLE "public"."bookmark" ADD CONSTRAINT "bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bookmark" ADD CONSTRAINT "bookmark_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
