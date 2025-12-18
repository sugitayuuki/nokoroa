import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class S3Service {
  private s3Client: S3Client | null = null;
  private bucketName: string;
  private region: string;
  private isDevelopment: boolean;
  private backendUrl: string;

  constructor(private configService: ConfigService) {
    this.region = this.configService.get('AWS_REGION') || 'ap-northeast-1';
    this.bucketName =
      this.configService.get('AWS_BUCKET_NAME') || 'nokoroa-prod-uploads';
    this.isDevelopment =
      this.configService.get('NODE_ENV') !== 'production' &&
      !this.configService.get('AWS_ACCESS_KEY_ID');
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
    const uniqueSuffix = `${Date.now()}-${randomBytes(8).toString('hex')}`;
    const extension = file.originalname.split('.').pop();
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
      ContentType: file.mimetype,
    });

    await this.s3Client?.send(command);

    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
  }
}
