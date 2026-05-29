import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Put,
  Delete,
  Request,
  HttpStatus,
  HttpCode,
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
  ApiQuery,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { S3Service } from '../common/s3.service';
import { CreatePostDto } from './dto/create-post.dto';
import { SearchPostsByLocationDto } from './dto/search-posts-by-location.dto';
import { SearchPostsSemanticDto } from './dto/search-posts-semantic.dto';
import { SearchPostsDto } from './dto/search-posts.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostsService } from './posts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly s3Service: S3Service,
  ) {}

  @Post('upload-image')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '投稿画像アップロード',
    description: '投稿用の画像をアップロードします',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
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
    FileInterceptor('image', {
      storage: memoryStorage(),
      fileFilter: (req, file, callback) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
          return callback(
            new BadRequestException('Only image files are allowed!'),
            false,
          );
        }
        callback(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
      },
    }),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const url = await this.s3Service.uploadFile(file, 'public/images');

    return {
      message: 'File uploaded successfully',
      originalname: file.originalname,
      url,
      size: file.size,
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '投稿作成', description: '新しい投稿を作成します' })
  @ApiResponse({ status: 201, description: '作成成功' })
  @ApiResponse({ status: 400, description: '入力値エラー' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  create(
    @Request() req: { user: { id: number } },
    @Body() createPostDto: CreatePostDto,
  ) {
    return this.postsService.create({
      ...createPostDto,
      authorId: req.user.id,
    });
  }

  @Get()
  @ApiOperation({
    summary: '投稿一覧取得',
    description: '公開されている投稿の一覧を取得します',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: '取得件数',
    example: 10,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'オフセット',
    example: 0,
  })
  @ApiResponse({ status: 200, description: '取得成功' })
  findAll(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.postsService.findAll(
      limit ? parseInt(limit) : 10,
      offset ? parseInt(offset) : 0,
    );
  }

  @Get('search')
  @ApiOperation({
    summary: '投稿検索',
    description: 'キーワード、タグ、場所で投稿を検索します',
  })
  @ApiResponse({ status: 200, description: '検索成功' })
  search(@Query() searchPostsDto: SearchPostsDto) {
    return this.postsService.search(searchPostsDto);
  }

  @Get('search/semantic')
  @ApiOperation({
    summary: '意味検索（ベクトル検索）',
    description:
      '自然文クエリを Gemini で埋め込み、pgvector の cosine 類似度で投稿を検索します',
  })
  @ApiResponse({ status: 200, description: '検索成功' })
  searchSemantic(@Query() dto: SearchPostsSemanticDto) {
    return this.postsService.searchSemantic(dto);
  }

  @Get('search-by-location')
  @ApiOperation({
    summary: '位置情報検索',
    description: '指定した位置の周辺の投稿を検索します',
  })
  @ApiResponse({ status: 200, description: '検索成功' })
  searchByLocation(@Query() searchDto: SearchPostsByLocationDto) {
    return this.postsService.searchByLocation(searchDto);
  }

  @Get('tags')
  @ApiOperation({
    summary: 'タグ一覧取得',
    description: '使用されているタグの一覧を取得します',
  })
  @ApiResponse({ status: 200, description: '取得成功' })
  getTags() {
    return this.postsService.getTags();
  }

  @Get('locations')
  @ApiOperation({
    summary: '場所一覧取得',
    description: '投稿に登録されている場所の一覧を取得します',
  })
  @ApiResponse({ status: 200, description: '取得成功' })
  getLocations() {
    return this.postsService.getLocations();
  }

  @Get(':id')
  @ApiOperation({
    summary: '投稿詳細取得',
    description: '指定したIDの投稿を取得します',
  })
  @ApiParam({ name: 'id', description: '投稿ID', example: 1 })
  @ApiResponse({ status: 200, description: '取得成功' })
  @ApiResponse({ status: 404, description: '投稿が見つかりません' })
  findOne(@Param('id') id: string) {
    return this.postsService.findOne(+id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '投稿更新', description: '自分の投稿を更新します' })
  @ApiParam({ name: 'id', description: '投稿ID', example: 1 })
  @ApiResponse({ status: 200, description: '更新成功' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  @ApiResponse({ status: 403, description: '権限がありません' })
  @ApiResponse({ status: 404, description: '投稿が見つかりません' })
  update(
    @Request() req: { user: { id: number } },
    @Param('id') id: string,
    @Body() updatePostDto: UpdatePostDto,
  ) {
    return this.postsService.update(+id, updatePostDto, req.user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '投稿削除', description: '自分の投稿を削除します' })
  @ApiParam({ name: 'id', description: '投稿ID', example: 1 })
  @ApiResponse({ status: 204, description: '削除成功' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  @ApiResponse({ status: 403, description: '権限がありません' })
  @ApiResponse({ status: 404, description: '投稿が見つかりません' })
  remove(@Request() req: { user: { id: number } }, @Param('id') id: string) {
    return this.postsService.remove(+id, req.user.id);
  }
}
