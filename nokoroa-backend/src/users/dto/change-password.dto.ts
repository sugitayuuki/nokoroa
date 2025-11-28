import { IsString, MinLength, IsNotEmpty } from 'class-validator';

export class ChangePasswordDto {
  @IsNotEmpty()
  @IsString()
  currentPassword: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6, { message: 'パスワードは6文字以上である必要があります' })
  newPassword: string;

  @IsNotEmpty()
  @IsString()
  confirmPassword: string;
}
