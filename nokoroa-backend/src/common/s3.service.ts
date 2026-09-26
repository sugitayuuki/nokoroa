import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { isProductionLikeEnv } from './environment';
import { InvalidImageUploadError, resolveImageUpload } from './image-upload';

@Injectable()
export class S3Service {
  private s3Client: S3Client | null = null;
  private bucketName: string;
  private region: string;
  private isDevelopment: boolean;
  private backendUrl: string;

  constructor(private configService: ConfigService) {
    this.region = this.configService.get('AWS_REGION') || 'ap-northeast-1';
    // 環境判定は common/environment.ts に集約する
    // (箇所ごとに基準が違うと staging で挙動が食い違うため)
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    const usesS3 = isProductionLikeEnv(nodeEnv);
    this.isDevelopment = !usesS3;

    // 本番バケット名を既定値にすると、設定漏れに気付かないまま
    // 本番バケットへ書きに行ってしまうためフォールバックしない。
    this.bucketName = this.configService.get('AWS_BUCKET_NAME') || '';
    if (usesS3 && !this.bucketName) {
      throw new Error('AWS_BUCKET_NAME is not set.');
    }
    const port = this.configService.get<number>('PORT') ?? 4000;
    this.backendUrl =
      this.configService.get('BACKEND_URL') || `http://localhost:${port}`;

    if (!this.isDevelopment) {
      this.s3Client = new S3Client({
        region: this.region,
      });
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'public/images',
  ): Promise<string> {
    // 拡張子と Content-Type はここで確定する。コントローラの fileFilter は
    // 早期リジェクト用であり、保存経路の検証をここへ集約しないと
    // 呼び出し元が増えたときに素通りする。
    let extension: string;
    let contentType: string;
    try {
      ({ extension, contentType } = resolveImageUpload(file));
    } catch (err) {
      if (err instanceof InvalidImageUploadError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }

    const uniqueSuffix = `${Date.now()}-${randomBytes(8).toString('hex')}`;
    const filename = `${uniqueSuffix}.${extension}`;

    // 開発環境: ローカルファイルシステムに保存
    if (this.isDevelopment) {
      const uploadDir = path.join(process.cwd(), 'uploads', folder);

      // ディレクトリが存在しない場合は作成
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filePath = path.join(uploadDir, filename);
      fs.writeFileSync(filePath, file.buffer);

      return `${this.backendUrl}/uploads/${folder}/${filename}`;
    }

    // 本番環境: S3にアップロード
    const key = `${folder}/${filename}`;
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: file.buffer,
      // file.mimetype はクライアント申告なので使わない。許可リスト由来の値のみ。
      //
      // なお X-Content-Type-Options: nosniff は S3 単体では付けられない。
      // PutObject の Metadata は x-amz-meta-* 接頭辞付きで返るためブラウザは
      // 無視する。付けるなら CloudFront のレスポンスヘッダーポリシーが必要。
      // 現状は Content-Type が image/* に固定されるためスニッフィングで
      // HTML 化されることはなく、必須ではない。
      ContentType: contentType,
    });

    await this.s3Client?.send(command);

    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
  }
}
