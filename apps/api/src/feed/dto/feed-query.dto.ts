import { IsIn, IsOptional } from 'class-validator';
import type { FeedType } from 'shared-types';
import { PaginationQueryDto } from '../../common/pagination';

export const FEED_TYPES = ['friends', 'local'] as const satisfies FeedType[];

// GET /api/feed?type=friends|local&cursor=&limit=. type defaults to friends.
export class FeedQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(FEED_TYPES)
  type: FeedType = 'friends';
}
