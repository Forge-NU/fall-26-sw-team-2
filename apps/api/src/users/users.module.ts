import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FollowsModule } from '../follows/follows.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [PrismaModule, FollowsModule, StorageModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
