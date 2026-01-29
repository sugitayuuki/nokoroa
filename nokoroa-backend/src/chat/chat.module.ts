import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { PostsModule } from '../posts/posts.module';

@Module({
  imports: [ConfigModule, PostsModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
