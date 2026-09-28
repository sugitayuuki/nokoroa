import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  IsNumber,
  MaxLength,
  ArrayMaxSize,
  IsUrl,
} from 'class-validator';

export class UpdatePostDto {
  @ApiPropertyOptional({
    description: '投稿のタイトル',
    example: '京都旅行の思い出（更新版）',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    description: '投稿の本文',
    example: '先週末、京都に行ってきました。紅葉がとても綺麗でした！',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  content?: string;

  @ApiPropertyOptional({
    description: '投稿画像のURL',
    example: 'https://example.com/images/kyoto.jpg',
  })
  @IsOptional()
  // require_tld: false は localhost / compose のサービス名を許可するため。
  // javascript: data: 相対パス等の遮断は protocols + require_protocol が担う。
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    require_tld: false,
  })
  @MaxLength(2048)
  imageUrl?: string;

  @ApiPropertyOptional({
    description: '場所の名前',
    example: '清水寺',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @ApiPropertyOptional({
    description: '都道府県',
    example: '京都府',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  prefecture?: string;

  @ApiPropertyOptional({
    description: '緯度',
    example: 34.9949,
  })
  // null は「座標なし」の明示値。@IsOptional() は null を検証スキップするため通る。
  // 編集画面は「場所未変更で座標なしの投稿」を null 明示で送り、
  // getOrCreateLocation が {name, latitude: null, longitude: null} で
  // 既存の座標なし行に一致できるようにしている(省略すると名前のみ一致になる)
  @IsOptional()
  @IsNumber()
  latitude?: number | null;

  @ApiPropertyOptional({
    description: '経度',
    example: 135.785,
  })
  @IsOptional()
  @IsNumber()
  longitude?: number | null;

  @ApiPropertyOptional({
    description: 'タグの配列',
    example: ['京都', '紅葉', '寺社仏閣'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: '公開設定（true: 公開, false: 非公開）',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
