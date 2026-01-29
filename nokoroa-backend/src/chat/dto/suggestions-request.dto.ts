import { IsString } from 'class-validator';

export class SuggestionsRequestDto {
  @IsString()
  message: string;

  @IsString()
  ai_response: string;
}
