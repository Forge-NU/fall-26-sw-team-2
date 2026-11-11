import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
