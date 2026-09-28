import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * 1リクエストで返せる最大件数。
 * 上限が無いと ?limit=1000000 で全件を一度に引けてしまい、DB とメモリを
 * 一撃で潰せる。既定値はエンドポイントごとの実績値を各 DTO 側で維持する。
 */
export const MAX_PAGE_LIMIT = 100;

/** limit / offset 形式のページネーション (favorites) */
export class OffsetPaginationDto {
  @ApiPropertyOptional({
    description: `取得件数（1〜${MAX_PAGE_LIMIT}）`,
    minimum: 1,
    maximum: MAX_PAGE_LIMIT,
    default: 10,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_LIMIT)
  limit: number = 10;

  @ApiPropertyOptional({
    description: 'オフセット',
    minimum: 0,
    default: 0,
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;
}

/** page / limit 形式のページネーション (follows) */
export class PagePaginationDto {
  @ApiPropertyOptional({
    description: 'ページ番号（1始まり）',
    minimum: 1,
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: `1ページあたりの件数（1〜${MAX_PAGE_LIMIT}）`,
    minimum: 1,
    maximum: MAX_PAGE_LIMIT,
    default: 20,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_LIMIT)
  limit: number = 20;
}
