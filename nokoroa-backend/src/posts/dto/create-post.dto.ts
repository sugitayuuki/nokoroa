import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  IsNumber,
  IsNotEmpty,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';

export class CreatePostDto {
  @ApiProperty({
    description: '投稿のタイトル',
    example: '京都旅行の思い出',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty({
    description: '投稿の本文',
    example: '先週末、京都に行ってきました。紅葉がとても綺麗でした！',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  content: string;

  @ApiProperty({
    description: '投稿画像のURL',
    example: 'https://example.com/images/kyoto.jpg',
  })
  @IsString()
  @IsNotEmpty({ message: '画像は必須です' })
  imageUrl: string;

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
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({
    description: '経度',
    example: 135.785,
  })
  @IsOptional()
  @IsNumber()
  longitude?: number;

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
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
