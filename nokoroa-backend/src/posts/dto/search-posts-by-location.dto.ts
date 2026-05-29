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
} from 'class-validator';

const toFiniteNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string') return undefined;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : undefined;
};

const toFiniteInt = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string') return undefined;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
};

export class SearchPostsByLocationDto {
  @ApiPropertyOptional({ description: '中心点の緯度', example: 35.6812 })
  @IsOptional()
  @Transform(({ value }) => toFiniteNumber(value))
  @IsNumber()
  @IsLatitude()
  centerLat?: number;

  @ApiPropertyOptional({ description: '中心点の経度', example: 139.7671 })
  @IsOptional()
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

  @ApiPropertyOptional({
    description: 'オフセット',
    example: 0,
    minimum: 0,
  })
  @IsOptional()
  @Transform(({ value }) => toFiniteInt(value))
  @IsInt()
  @Min(0)
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
