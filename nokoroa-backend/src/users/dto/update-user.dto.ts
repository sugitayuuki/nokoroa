import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * プロフィール更新の入力。
 *
 * password と email は意図的に含めない。
 * ここに置くと現在のパスワードを検証しないまま変更できてしまい、
 * 盗まれたトークン1本で恒久的な乗っ取りが成立する。
 * パスワード変更は PUT /users/change-password（現在のパスワード必須）を使う。
 */
export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'ユーザー名（2文字以上）',
    example: '山田太郎',
    minLength: 2,
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: '名前は2文字以上である必要があります' })
  @MaxLength(50, { message: '名前は50文字以内である必要があります' })
  name?: string;

  @ApiPropertyOptional({
    description: '自己紹介文',
    example: '旅行が大好きです！',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: '自己紹介は500文字以内である必要があります' })
  bio?: string;
}
