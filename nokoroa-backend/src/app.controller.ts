import { Controller, Get } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';

@Controller()
export class AppController {
  /**
   * ALB backend target group のヘルスチェック先。
   *
   * setGlobalPrefix('api') があるため実際のパスは `GET /api` で、
   * terraform/modules/alb/main.tf の `health_check { path = "/api" }` が
   * これを 30 秒間隔で叩いている (matcher は "200" なので本文は任意)。
   * 200 を返さなくなると ECS タスクが全台 unhealthy になりサービスが落ちる。
   * NestJS の雛形に見えるが消してはいけない。
   */
  @Get()
  @ApiExcludeEndpoint()
  healthCheck(): { status: string } {
    return { status: 'ok' };
  }
}
