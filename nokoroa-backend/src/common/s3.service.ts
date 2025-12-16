import { randomBytes } from 'crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;
  private region: string;

  constructor(private configService: ConfigService) {
    this.region = this.configService.get('AWS_REGION') || 'ap-northeast-1';
    this.bucketName =
      this.configService.get('AWS_BUCKET_NAME') || 'nokoroa-prod-uploads';

    this.s3Client = new S3Client({
      region: this.region,
    });
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'public/images',
  ): Promise<string> {
    const uniqueSuffix = `${Date.now()}-${randomBytes(8).toString('hex')}`;
    const extension = file.originalname.split('.').pop();
    const key = `${folder}/${uniqueSuffix}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    await this.s3Client.send(command);

    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
  }
}
