import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'ユーザー名（2文字以上）',
    example: '山田太郎',
    minLength: 2,
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: '名前は2文字以上である必要があります' })
  name?: string;

  @ApiPropertyOptional({
    description: 'メールアドレス',
    example: 'user@example.com',
  })
  @IsOptional()
  @IsEmail({}, { message: '有効なメールアドレスを入力してください' })
  email?: string;

  @ApiPropertyOptional({
    description: 'パスワード（8文字以上）',
    example: 'newpassword123',
    minLength: 8,
  })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'パスワードは8文字以上である必要があります' })
  password?: string;

  @ApiPropertyOptional({
    description: '自己紹介文',
    example: '旅行が大好きです！',
  })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({
    description: 'アバター画像URL',
    example: 'https://example.com/avatar.jpg',
  })
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
