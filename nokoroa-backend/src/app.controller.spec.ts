import { Test, TestingModule } from '@nestjs/testing';

import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('healthCheck', () => {
    // ALB の health_check が叩く唯一の経路。200 を返さなくなると
    // ECS タスクが全台 unhealthy になる (terraform/modules/alb/main.tf)。
    it('200 で応答できる形を返す', () => {
      expect(appController.healthCheck()).toEqual({ status: 'ok' });
    });
  });
});
