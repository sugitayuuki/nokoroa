import { IsString, MaxLength } from 'class-validator';

export class RelatedPostsRequestDto {
  @IsString()
  @MaxLength(2000)
  message: string;

  @IsString()
  @MaxLength(8000)
  ai_response: string;
}
