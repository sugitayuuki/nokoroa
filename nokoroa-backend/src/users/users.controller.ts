import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';

import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { S3Service } from '../common/s3.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserResponse } from './interfaces/create-user-response.interface';
import { UsersService } from './users.service';

interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
    email: string;
  };
}

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly s3Service: S3Service,
  ) {}

  @Post('signup')
  // アカウントの大量生成を抑止する
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({
    summary: 'ユーザー登録',
    description: '新規ユーザーを登録します',
  })
  @ApiResponse({ status: 201, description: '登録成功' })
  @ApiResponse({ status: 400, description: '入力値エラー' })
  @ApiResponse({
    status: 409,
    description: 'メールアドレスが既に使用されています',
  })
  async signup(
    @Body() createUserDto: CreateUserDto,
  ): Promise<CreateUserResponse> {
    const response = await this.usersService.create(createUserDto);
    return response;
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '自分のプロフィール取得',
    description: 'ログインユーザーのプロフィールを取得します',
  })
  @ApiResponse({ status: 200, description: '取得成功' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  async getProfile(@Request() req: AuthenticatedRequest) {
    return this.usersService.findById(req.user.userId, req.user.userId);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'ユーザー情報取得',
    description:
      '指定したユーザーの情報を取得します。非公開投稿とメールアドレスは本人のみに返します',
  })
  @ApiParam({ name: 'id', description: 'ユーザーID', example: 1 })
  @ApiResponse({ status: 200, description: '取得成功' })
  @ApiResponse({ status: 404, description: 'ユーザーが見つかりません' })
  async getUserById(
    @Param('id', ParseIntPipe) id: number,
    @Request()
    req: AuthenticatedRequest & { user?: { userId: number; email: string } },
  ) {
    const currentUserId = req.user?.userId;
    return this.usersService.findById(id, currentUserId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('profile')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'プロフィール更新',
    description: 'ログインユーザーのプロフィールを更新します',
  })
  @ApiResponse({ status: 200, description: '更新成功' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  async updateProfile(
    @Request() req: AuthenticatedRequest,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(req.user.userId, updateUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Put('change-password')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'パスワード変更',
    description: 'ログインユーザーのパスワードを変更します',
  })
  @ApiResponse({ status: 200, description: '変更成功' })
  @ApiResponse({
    status: 400,
    description: '現在のパスワードが正しくありません',
  })
  @ApiResponse({ status: 401, description: '認証エラー' })
  async changePassword(
    @Request() req: AuthenticatedRequest,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(req.user.userId, changePasswordDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('upload-avatar')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'アバター画像アップロード',
    description: 'プロフィール画像をアップロードします',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: '画像ファイル（jpg, jpeg, png, gif, webp、5MB以下）',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'アップロード成功' })
  @ApiResponse({ status: 400, description: 'ファイルが不正です' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
          return cb(
            new BadRequestException('Only image files are allowed!'),
            false,
          );
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  async uploadAvatar(
    @Request() req: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const avatarUrl = await this.s3Service.uploadFile(file, 'public/avatars');
    return this.usersService.updateAvatar(req.user.userId, avatarUrl);
  }
}
