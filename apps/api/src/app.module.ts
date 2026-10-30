import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { LocationsModule } from './locations/locations.module';
import { FollowsModule } from './follows/follows.module';
import { TripsModule } from './trips/trips.module';
import { PostsModule } from './posts/posts.module';
import { StoriesModule } from './stories/stories.module';
import { MediaModule } from './media/media.module';
import { LikesModule } from './likes/likes.module';
import { SavesModule } from './saves/saves.module';
import { CommentsModule } from './comments/comments.module';

@Module({
  imports: [
    UsersModule,
    FollowsModule,
    TripsModule,
    PostsModule,
    LocationsModule,
    StoriesModule,
    MediaModule,
    LikesModule,
    SavesModule,
    CommentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
