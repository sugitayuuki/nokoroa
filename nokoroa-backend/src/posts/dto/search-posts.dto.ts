import { Type, Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsArray,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class SearchPostsDto {
  @IsOptional()
  @IsString()
  q?: string; // 検索クエリ（タイトル、コンテンツ、著者名で検索）

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }): string[] => {
    if (typeof value === 'string') {
      return value.split(',').map((tag) => tag.trim());
    }
    return value as string[];
  })
  tags?: string[]; // タグでフィルタリング

  @IsOptional()
  @IsString()
  location?: string; // 場所でフィルタリング

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  authorId?: number; // 著者IDでフィルタリング

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number = 10; // 取得件数制限

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  offset?: number = 0; // オフセット
}
