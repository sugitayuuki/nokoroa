import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class SearchPostsSemanticDto {
  @ApiProperty({
    description: '意味検索クエリ（自然文）',
    example: '紅葉と温泉が楽しめる秋の旅行',
  })
  @IsString()
  @Transform(({ value }): string =>
    typeof value === 'string' ? value.trim() : '',
  )
  @MinLength(1)
  q!: string;

  @ApiPropertyOptional({
    description: '取得件数（1〜20）',
    example: 10,
    minimum: 1,
    maximum: 20,
    default: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  @Type(() => Number)
  limit?: number = 10;
}
