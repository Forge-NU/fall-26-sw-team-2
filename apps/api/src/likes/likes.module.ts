import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { LikesController } from './likes.controller';
import { LikesService } from './likes.service';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [LikesController],
  providers: [LikesService],
})
export class LikesModule {}
