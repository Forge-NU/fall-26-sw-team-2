import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { FollowsModule } from './follows/follows.module';
import { TripsModule } from './trips/trips.module';
import { PostsModule } from './posts/posts.module';

@Module({
  imports: [UsersModule, TripsModule, PostsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
