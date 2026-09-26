import { PutObjectCommand } from '@aws-sdk/client-s3';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { S3Service } from './s3.service';

const sendMock = jest.fn<Promise<unknown>, [PutObjectCommand]>();

jest.mock('@aws-sdk/client-s3', () => {
  const actual =
    jest.requireActual<typeof import('@aws-sdk/client-s3')>(
      '@aws-sdk/client-s3',
    );
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({ send: sendMock })),
  };
});

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

function makeFile(
  originalname: string,
  buffer: Buffer,
  mimetype = 'image/jpeg',
): Express.Multer.File {
  return { originalname, buffer, mimetype } as Express.Multer.File;
}

describe('S3Service.uploadFile', () => {
  let service: S3Service;

  beforeEach(async () => {
    sendMock.mockReset().mockResolvedValue({});
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        S3Service,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'NODE_ENV') return 'production';
              if (key === 'AWS_BUCKET_NAME') return 'test-bucket';
              if (key === 'AWS_REGION') return 'ap-northeast-1';
              return undefined;
            },
          },
        },
      ],
    }).compile();
    service = module.get(S3Service);
  });

  function lastPutInput() {
    return sendMock.mock.calls[0][0].input;
  }

  it('Content-Type はクライアント申告ではなく拡張子から決める', async () => {
    // これが core の防御。mimetype を信用すると S3 が text/html として
    // 配信し、公開 URL 上で任意 JS が実行される。
    await service.uploadFile(makeFile('photo.jpg', JPEG, 'text/html'));

    expect(lastPutInput().ContentType).toBe('image/jpeg');
  });

  it('中身が HTML のファイルは BadRequest で弾き、S3 へ送らない', async () => {
    const attack = makeFile(
      'xss.jpg',
      Buffer.from('<html><script>alert(document.domain)</script></html>'),
      'text/html',
    );

    await expect(service.uploadFile(attack)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('許可外の拡張子は弾く', async () => {
    await expect(
      service.uploadFile(makeFile('a.svg', JPEG, 'image/svg+xml')),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('保存するキーの拡張子は小文字に正規化される', async () => {
    const url = await service.uploadFile(makeFile('IMG_0001.JPG', JPEG));

    expect(lastPutInput().Key).toMatch(/^public\/images\/[\w-]+\.jpg$/);
    expect(url).toContain('.jpg');
  });

  it('S3 単体では付けられないヘッダをメタデータで偽装しない', async () => {
    // x-amz-meta-* 接頭辞付きで返るためブラウザは無視する。付けても効かない
    // ものを付けると「対策済み」と誤認される。
    await service.uploadFile(makeFile('photo.jpg', JPEG));

    expect(lastPutInput().Metadata).toBeUndefined();
  });

  it('ファイル名は推測できない値に置き換える', async () => {
    await service.uploadFile(makeFile('../../etc/passwd.jpg', JPEG));

    const key = lastPutInput().Key ?? '';
    expect(key).not.toContain('..');
    expect(key).not.toContain('passwd');
  });
});
