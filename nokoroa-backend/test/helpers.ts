import { Server } from 'http';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { LoginResponse } from './types';

export async function createUserAndLogin(
  app: INestApplication,
  email: string,
  password: string = 'password123',
  name: string = 'Test User',
): Promise<{ accessToken: string; userId: number }> {
  const server = app.getHttpServer() as Server;

  await request(server).post('/users/signup').send({
    email,
    password,
    name,
  });

  const loginResponse = await request(server)
    .post('/auth/login')
    .send({ email, password });

  const body = loginResponse.body as LoginResponse;

  return {
    accessToken: body.access_token,
    userId: body.user.id,
  };
}
