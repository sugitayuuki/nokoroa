import { IsString } from 'class-validator';

export class RelatedPostsRequestDto {
  @IsString()
  message: string;

  @IsString()
  ai_response: string;
}
