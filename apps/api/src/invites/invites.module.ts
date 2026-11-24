import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [InvitesController],
  providers: [InvitesService],
})
export class InvitesModule {}
