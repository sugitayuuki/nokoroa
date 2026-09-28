import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * 1リクエストで返せる最大件数。
 * 上限が無いと ?limit=1000000 で全件を一度に引けてしまい、DB とメモリを
 * 一撃で潰せる。既定値はエンドポイントごとの実績値を各 DTO 側で維持する。
 */
export const MAX_PAGE_LIMIT = 100;

/**
 * page / offset の実効上限。
 * 上限が無いと ?page=1e20 等が検証を通過し、skip の 64bit 超過で
 * Prisma P2033 → 500 になる(400 に寄せるための境界)。
 */
export const MAX_PAGE_NUMBER = 1_000_000;
export const MAX_PAGE_OFFSET = 10_000_000;

/**
 * クエリ値を数値へ正規化する。@Type(() => Number) を使わないのは、
 * 空文字が Number('') === 0 に化けて @Min で 400 になり、旧実装
 * (生 parseInt + falsy フォールバック)の「?limit= は既定値で 200」と
 * 非互換になるため。互換を保つのは「空文字・欠落・重複指定(配列)は
 * 既定値」の3ケースのみ。小数(?limit=12.5)は @IsInt で 400(旧 parseInt は
 * 黙って 12 に読み替えていた)。指数表記は Number.isInteger(1e1)===true のため
 * @IsInt を通り、範囲内なら旧 parseInt(1e1→1)と異なる値(10)で通る。
 * 範囲外は @Max/@Min で 400。不正入力の黙認より明示エラーを優先する方針。
 */
const toQueryInt =
  (fallback: number) =>
  ({ value }: { value: unknown }): unknown => {
    if (value === '' || value === null || value === undefined) {
      return fallback;
    }
    if (Array.isArray(value)) {
      return fallback;
    }
    return Number(value);
  };

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
  @Transform(toQueryInt(10))
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_LIMIT)
  limit: number = 10;

  @ApiPropertyOptional({
    description: 'オフセット',
    minimum: 0,
    maximum: MAX_PAGE_OFFSET,
    default: 0,
    example: 0,
  })
  @IsOptional()
  @Transform(toQueryInt(0))
  @IsInt()
  @Min(0)
  @Max(MAX_PAGE_OFFSET)
  offset: number = 0;
}

/** page / limit 形式のページネーション (follows) */
export class PagePaginationDto {
  @ApiPropertyOptional({
    description: 'ページ番号（1始まり）',
    minimum: 1,
    maximum: MAX_PAGE_NUMBER,
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Transform(toQueryInt(1))
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_NUMBER)
  page: number = 1;

  @ApiPropertyOptional({
    description: `1ページあたりの件数（1〜${MAX_PAGE_LIMIT}）`,
    minimum: 1,
    maximum: MAX_PAGE_LIMIT,
    default: 20,
    example: 20,
  })
  @IsOptional()
  @Transform(toQueryInt(20))
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_LIMIT)
  limit: number = 20;
}
