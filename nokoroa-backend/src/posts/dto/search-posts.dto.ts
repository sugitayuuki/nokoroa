import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsArray,
  IsInt,
  IsNumber,
  Min,
  Max,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';

import { MAX_PAGE_OFFSET } from '../../common/pagination.dto';

/** 検索語の最大長。search-posts-by-location.dto.ts の q と揃える。 */
const MAX_QUERY_LENGTH = 200;
/** タグ指定の最大数。CreatePostDto の @ArrayMaxSize(20) と揃える。 */
const MAX_TAG_FILTERS = 20;

export class SearchPostsDto {
  // GET /api/posts/search は無認証で、q は title / content / author.name の
  // ILIKE '%q%' に渡る(索引が効かない全表走査)。長さ上限が無いと
  // 巨大なパターンで CPU を焼かれるため、兄弟 DTO と同じ 200 文字で切る。
  @ApiPropertyOptional({
    description: '検索クエリ（タイトル、コンテンツ、著者名で検索）',
    example: '京都',
    maxLength: MAX_QUERY_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_QUERY_LENGTH)
  q?: string;

  @ApiPropertyOptional({
    description: 'タグでフィルタリング（カンマ区切り）',
    example: '京都,紅葉',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TAG_FILTERS)
  @IsString({ each: true })
  @MaxLength(MAX_QUERY_LENGTH, { each: true })
  @Transform(({ value }): string[] | undefined => {
    if (typeof value === 'string') {
      // '' を split すると [''] になり「タグ名が空文字の投稿」を探して
      // 必ず 0 件になる。q / location は falsy 判定で無視されるので、
      // tags も空指定は「絞り込みなし」に揃える。
      const tags = value
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
      return tags.length > 0 ? tags : undefined;
    }
    return value as string[] | undefined;
  })
  tags?: string[];

  @ApiPropertyOptional({
    description: '場所でフィルタリング',
    example: '清水寺',
    maxLength: MAX_QUERY_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_QUERY_LENGTH)
  location?: string;

  @ApiPropertyOptional({
    description: '著者IDでフィルタリング',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  authorId?: number;

  // limit / offset は Prisma の take / skip へそのまま渡る。
  // @IsNumber だけだと小数が通り take: 1.5 で PrismaClientValidationError に、
  // offset に上限が無いと skip が 64bit を超えて P2033 になる。どちらも
  // PrismaClientKnownRequestError 以外 / 既定分岐なので PrismaExceptionFilter が
  // 400 に写像できず 500 になる。common/pagination.dto.ts と同じ境界で弾く。
  @ApiPropertyOptional({
    description: '取得件数（1〜50）',
    example: 10,
    minimum: 1,
    maximum: 50,
    default: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'オフセット',
    example: 0,
    minimum: 0,
    maximum: MAX_PAGE_OFFSET,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_PAGE_OFFSET)
  @Type(() => Number)
  offset?: number = 0;
}
