import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FollowsModule } from '../follows/follows.module';

@Module({
  imports: [PrismaModule, FollowsModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
