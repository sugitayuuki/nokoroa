import { Server } from 'http';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import request from 'supertest';

import {
  MAX_PAGE_LIMIT,
  MAX_PAGE_NUMBER,
  MAX_PAGE_OFFSET,
  OffsetPaginationDto,
  PagePaginationDto,
} from './pagination.dto';
import { FollowsController } from '../follows/follows.controller';
import { FollowsService } from '../follows/follows.service';

/** ValidationPipe(transform + whitelist) と同じ条件で DTO を組み立てる */
function parseQuery<T extends object>(
  cls: new () => T,
  query: Record<string, unknown>,
) {
  const dto = plainToInstance(cls, query);
  return { dto, errors: validateSync(dto, { whitelist: true }) };
}

describe('OffsetPaginationDto (favorites)', () => {
  it('クエリ省略時は既存の既定値(limit=10 / offset=0)を保つ', () => {
    const { dto, errors } = parseQuery(OffsetPaginationDto, {});

    expect(errors).toHaveLength(0);
    expect(dto.limit).toBe(10);
    expect(dto.offset).toBe(0);
  });

  it('文字列のクエリを数値へ変換する', () => {
    const { dto, errors } = parseQuery(OffsetPaginationDto, {
      limit: '25',
      offset: '50',
    });

    expect(errors).toHaveLength(0);
    expect(dto.limit).toBe(25);
    expect(dto.offset).toBe(50);
  });

  it('数値でない limit を弾く(Prisma に NaN を渡して500になるのを防ぐ)', () => {
    const { errors } = parseQuery(OffsetPaginationDto, { limit: 'abc' });

    expect(errors.length).toBeGreaterThan(0);
  });

  it(`上限(${MAX_PAGE_LIMIT})ちょうどは通し、超えたら弾く`, () => {
    expect(
      parseQuery(OffsetPaginationDto, { limit: String(MAX_PAGE_LIMIT) }).errors,
    ).toHaveLength(0);
    expect(
      parseQuery(OffsetPaginationDto, { limit: String(MAX_PAGE_LIMIT + 1) })
        .errors.length,
    ).toBeGreaterThan(0);
  });

  it('limit=0 と負の offset を弾く', () => {
    expect(
      parseQuery(OffsetPaginationDto, { limit: '0' }).errors.length,
    ).toBeGreaterThan(0);
    expect(
      parseQuery(OffsetPaginationDto, { offset: '-1' }).errors.length,
    ).toBeGreaterThan(0);
  });
});

describe('PagePaginationDto (follows)', () => {
  it('クエリ省略時は既存の既定値(page=1 / limit=20)を保つ', () => {
    const { dto, errors } = parseQuery(PagePaginationDto, {});

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
  });

  it('文字列のクエリを数値へ変換する', () => {
    const { dto, errors } = parseQuery(PagePaginationDto, {
      page: '3',
      limit: '50',
    });

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(3);
    expect(dto.limit).toBe(50);
  });

  it('数値でない page / limit を弾く', () => {
    expect(
      parseQuery(PagePaginationDto, { page: 'abc' }).errors.length,
    ).toBeGreaterThan(0);
    expect(
      parseQuery(PagePaginationDto, { limit: 'abc' }).errors.length,
    ).toBeGreaterThan(0);
  });

  it('page は1始まりで、上限を超える limit は弾く', () => {
    expect(
      parseQuery(PagePaginationDto, { page: '0' }).errors.length,
    ).toBeGreaterThan(0);
    expect(
      parseQuery(PagePaginationDto, { limit: String(MAX_PAGE_LIMIT + 1) })
        .errors.length,
    ).toBeGreaterThan(0);
  });

  it('巨大な page / offset は 64bit 超過で Prisma 500 になる前に弾く', () => {
    // Number.isInteger は 1e20 でも true を返すため @Max が無いと素通りする
    expect(
      parseQuery(PagePaginationDto, { page: '99999999999999999999999' }).errors
        .length,
    ).toBeGreaterThan(0);
    expect(
      parseQuery(OffsetPaginationDto, { offset: '99999999999999999999999' })
        .errors.length,
    ).toBeGreaterThan(0);
    // 上限ちょうどは通す
    expect(
      parseQuery(PagePaginationDto, { page: String(MAX_PAGE_NUMBER) }).errors,
    ).toHaveLength(0);
    expect(
      parseQuery(OffsetPaginationDto, { offset: String(MAX_PAGE_OFFSET) })
        .errors,
    ).toHaveLength(0);
  });

  it('空文字クエリ(?limit=)は旧実装と同じく既定値へフォールバックする', () => {
    const offset = parseQuery(OffsetPaginationDto, { limit: '', offset: '' });
    expect(offset.errors).toHaveLength(0);
    expect(offset.dto.limit).toBe(10);
    expect(offset.dto.offset).toBe(0);

    const page = parseQuery(PagePaginationDto, { page: '', limit: '' });
    expect(page.errors).toHaveLength(0);
    expect(page.dto.page).toBe(1);
    expect(page.dto.limit).toBe(20);
  });

  it('重複指定(?limit=10&limit=20 → 配列)は 400 にせず既定値へ倒す', () => {
    const { dto, errors } = parseQuery(PagePaginationDto, {
      limit: ['10', '20'],
    });
    expect(errors).toHaveLength(0);
    expect(dto.limit).toBe(20);
  });
});

// DTO 単体ではなく、main.ts と同じ ValidationPipe を通した実際の HTTP 応答まで
// 確かめる。以前は生の parseInt で NaN が Prisma に渡り 500 になっていた。
describe('FollowsController のページネーション (HTTP)', () => {
  let app: INestApplication;
  let server: Server;

  const mockFollowsService = {
    getFollowers: jest.fn(),
    getFollowing: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [FollowsController],
      providers: [{ provide: FollowsService, useValue: mockFollowsService }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockFollowsService.getFollowers.mockResolvedValue({
      followers: [],
      total: 0,
      page: 1,
      totalPages: 0,
    });
  });

  it('?limit=abc は 500 ではなく 400 を返す', async () => {
    await request(server).get('/follows/1/followers?limit=abc').expect(400);

    expect(mockFollowsService.getFollowers).not.toHaveBeenCalled();
  });

  it(`?limit=${MAX_PAGE_LIMIT + 1} は上限超過として 400 を返す`, async () => {
    await request(server)
      .get(`/follows/1/followers?limit=${MAX_PAGE_LIMIT + 1}`)
      .expect(400);

    expect(mockFollowsService.getFollowers).not.toHaveBeenCalled();
  });

  it('クエリ省略時は既存の既定値(page=1 / limit=20)でサービスを呼ぶ', async () => {
    await request(server).get('/follows/1/followers').expect(200);

    expect(mockFollowsService.getFollowers).toHaveBeenCalledWith(1, 1, 20);
  });

  it('正常な page / limit はそのまま数値で渡る', async () => {
    await request(server)
      .get('/follows/1/followers?page=2&limit=30')
      .expect(200);

    expect(mockFollowsService.getFollowers).toHaveBeenCalledWith(1, 2, 30);
  });

  it('空値クエリ(?page=&limit=)は旧実装と同じく 200 + 既定値で通る', async () => {
    await request(server).get('/follows/1/followers?page=&limit=').expect(200);

    expect(mockFollowsService.getFollowers).toHaveBeenCalledWith(1, 1, 20);
  });
});
