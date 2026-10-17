import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { StoriesModule } from './stories/stories.module';

@Module({
  imports: [UsersModule, StoriesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
