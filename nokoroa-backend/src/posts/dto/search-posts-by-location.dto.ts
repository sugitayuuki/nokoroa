import { Transform } from 'class-transformer';
import { IsOptional, IsNumber, IsString } from 'class-validator';

export class SearchPostsByLocationDto {
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseFloat(value as string))
  centerLat?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseFloat(value as string))
  centerLng?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseFloat(value as string))
  radius?: number; // キロメートル単位

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value as string))
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value as string))
  offset?: number;

  @IsOptional()
  @IsString()
  q?: string; // 検索クエリ
}
