import { extname } from 'path';
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
import { diskStorage } from 'multer';
import { CreatePostDto } from './dto/create-post.dto';
import { SearchPostsByLocationDto } from './dto/search-posts-by-location.dto';
import { SearchPostsDto } from './dto/search-posts.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostsService } from './posts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post('upload-image')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads/images',
        filename: (req, file, callback) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          const filename = `${file.fieldname}-${uniqueSuffix}${ext}`;
          callback(null, filename);
        },
      }),
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
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return {
      message: 'File uploaded successfully',
      filename: file.filename,
      originalname: file.originalname,
      path: `/uploads/images/${file.filename}`,
      size: file.size,
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
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
  findAll(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.postsService.findAll(
      limit ? parseInt(limit) : 10,
      offset ? parseInt(offset) : 0,
    );
  }

  @Get('search')
  search(@Query() searchPostsDto: SearchPostsDto) {
    return this.postsService.search(searchPostsDto);
  }

  @Get('search-by-location')
  searchByLocation(@Query() searchDto: SearchPostsByLocationDto) {
    return this.postsService.searchByLocation(searchDto);
  }

  @Get('tags')
  getTags() {
    return this.postsService.getTags();
  }

  @Get('locations')
  getLocations() {
    return this.postsService.getLocations();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.postsService.findOne(+id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Request() req: { user: { id: number } },
    @Param('id') id: string,
    @Body() updatePostDto: UpdatePostDto,
  ) {
    return this.postsService.update(+id, updatePostDto, req.user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() req: { user: { id: number } }, @Param('id') id: string) {
    return this.postsService.remove(+id, req.user.id);
  }
}
