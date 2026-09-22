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
export const MAX_HISTORY_ITEMS = 20;
// 履歴にはAIの応答も積まれる。max_output_tokens=2048 の生成文は
// 日本語で2000文字を超えうるため、ユーザー入力より緩い上限にする。
export const MAX_HISTORY_CONTENT_LENGTH = 8000;
// 1リクエストで外部AIへ転送する履歴の総量。件数×1件長の組み合わせに
// 依存しないハードな上限として、転送直前に適用する。
export const MAX_HISTORY_TOTAL_LENGTH = 20000;

class MessageDto {
  @IsString()
  @MaxLength(32)
  role: string;

  @IsString()
  @MaxLength(MAX_HISTORY_CONTENT_LENGTH)
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
