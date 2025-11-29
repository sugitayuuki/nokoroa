-- CreateTable
CREATE TABLE "location" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT '日本',
    "prefecture" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_tag" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,

    CONSTRAINT "post_tag_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add columns to user
ALTER TABLE "user" ADD COLUMN "googleId" TEXT;
ALTER TABLE "user" ADD COLUMN "provider" TEXT;
ALTER TABLE "user" ALTER COLUMN "password" DROP NOT NULL;

-- AlterTable: Modify post table
ALTER TABLE "post" DROP COLUMN IF EXISTS "latitude";
ALTER TABLE "post" DROP COLUMN IF EXISTS "longitude";
ALTER TABLE "post" DROP COLUMN IF EXISTS "location";
ALTER TABLE "post" DROP COLUMN IF EXISTS "tags";
ALTER TABLE "post" ADD COLUMN "locationId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "location_name_latitude_longitude_key" ON "location"("name", "latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "tag_name_key" ON "tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tag_slug_key" ON "tag"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "post_tag_postId_tagId_key" ON "post_tag"("postId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "user_googleId_key" ON "user"("googleId");

-- AddForeignKey
ALTER TABLE "post" ADD CONSTRAINT "post_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_tag" ADD CONSTRAINT "post_tag_postId_fkey" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_tag" ADD CONSTRAINT "post_tag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
