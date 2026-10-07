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
 * 「未指定」と「指定されたが数値として不正」を区別する。
 *
 * 不正値も undefined に潰すと、?centerLat=abc&centerLng=def が
 * 「座標の指定なし」と解釈されて距離条件なしで 200 が返り、
 * 呼び出し側が誤りに気付けない。NaN を返せば @IsNumber が弾いて 400 になる
 * (class-validator の isNumber は既定で NaN を許可しない)。
 * 欠落・空文字だけを undefined にする。
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
 *
 * posts.service.ts の searchByLocation は
 * `centerLat !== undefined && centerLng !== undefined` のときだけ距離式を組む。
 * 片方だけ渡すと距離計算・radius での絞り込み・距離順ソートがすべて落ち、
 * 「半径 1km」の意図に対して座標を持つ全公開投稿が新着順で 200 で返る
 * (400 でも空結果でもないので呼び出し側が誤りに気付けない)。
 * 片方だけ来た場合に欠けている側を検証対象に含めて 400 にする。
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
