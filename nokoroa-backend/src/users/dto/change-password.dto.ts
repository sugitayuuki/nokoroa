import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, IsNotEmpty } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    description: '現在のパスワード',
    example: 'currentPassword123',
  })
  @IsNotEmpty()
  @IsString()
  currentPassword: string;

  @ApiProperty({
    description: '新しいパスワード（8文字以上）',
    example: 'newPassword123',
    minLength: 8,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(8, { message: 'パスワードは8文字以上である必要があります' })
  newPassword: string;

  @ApiProperty({
    description: '新しいパスワード（確認用）',
    example: 'newPassword123',
  })
  @IsNotEmpty()
  @IsString()
  confirmPassword: string;
}
