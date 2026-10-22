import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { LocationsModule } from './locations/locations.module';
import { FollowsModule } from './follows/follows.module';
import { TripsModule } from './trips/trips.module';
import { PostsModule } from './posts/posts.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    UsersModule,
    FollowsModule,
    TripsModule,
    PostsModule,
    LocationsModule,
    WebhooksModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
