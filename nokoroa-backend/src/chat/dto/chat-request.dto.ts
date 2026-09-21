import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

// 入力はそのままAIサービス（外部API課金あり）へ転送されるため、
// DTOの時点で上限を設ける。
const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_ITEMS = 20;

class MessageDto {
  @IsString()
  @MaxLength(32)
  role: string;

  @IsString()
  @MaxLength(MAX_MESSAGE_LENGTH)
  content: string;
}

export class ChatRequestDto {
  @IsString()
  @MaxLength(MAX_MESSAGE_LENGTH)
  message: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_HISTORY_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => MessageDto)
  history?: MessageDto[];
}
