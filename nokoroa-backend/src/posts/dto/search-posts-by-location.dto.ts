import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsNumber,
  IsString,
  Min,
  Max,
  IsInt,
  IsLatitude,
  IsLongitude,
  MaxLength,
  ValidateIf,
} from 'class-validator';

import { MAX_PAGE_OFFSET } from '../../common/pagination.dto';

/**
 * 「未指定」(undefined) と「指定されたが不正」(NaN) を区別する。
 * 不正値も undefined に潰すと「座標の指定なし」と解釈されて 200 が返り、
 * 呼び出し側が誤りに気付けない。NaN なら @IsNumber が 400 にする。
 */
const toFiniteNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return Number.NaN;
  return parseFloat(value);
};

/** toFiniteNumber と同じ方針。不正値は NaN にして @IsInt に弾かせる。 */
const toFiniteInt = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return Number.NaN;
  return parseInt(value, 10);
};

/**
 * 緯度・経度は「両方指定」か「両方省略」のみ許す。
 * searchByLocation は両方揃ったときだけ距離式を組むため、片方だけだと
 * radius も距離順ソートも黙って無効化され、全公開投稿が 200 で返ってしまう。
 */
const geoPairGiven = (o: SearchPostsByLocationDto): boolean =>
  o.centerLat !== undefined || o.centerLng !== undefined;

export class SearchPostsByLocationDto {
  @ApiPropertyOptional({ description: '中心点の緯度', example: 35.6812 })
  @ValidateIf(geoPairGiven)
  @Transform(({ value }) => toFiniteNumber(value))
  @IsNumber()
  @IsLatitude()
  centerLat?: number;

  @ApiPropertyOptional({ description: '中心点の経度', example: 139.7671 })
  @ValidateIf(geoPairGiven)
  @Transform(({ value }) => toFiniteNumber(value))
  @IsNumber()
  @IsLongitude()
  centerLng?: number;

  @ApiPropertyOptional({
    description: '検索半径（キロメートル単位、最大 500km）',
    example: 10,
    minimum: 0.1,
    maximum: 500,
  })
  @IsOptional()
  @Transform(({ value }) => toFiniteNumber(value))
  @IsNumber()
  @Min(0.1)
  @Max(500)
  radius?: number;

  @ApiPropertyOptional({
    description: '取得件数（最大 100）',
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Transform(({ value }) => toFiniteInt(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  // 生 SQL の OFFSET へ渡るため上限が必須。無いと bigint の範囲を超えて
  // Postgres 側でエラーになり、PrismaExceptionFilter も拾えず 500 になる。
  @ApiPropertyOptional({
    description: 'オフセット',
    example: 0,
    minimum: 0,
    maximum: MAX_PAGE_OFFSET,
  })
  @IsOptional()
  @Transform(({ value }) => toFiniteInt(value))
  @IsInt()
  @Min(0)
  @Max(MAX_PAGE_OFFSET)
  offset?: number;

  @ApiPropertyOptional({
    description: '検索クエリ',
    example: '東京',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;
}
