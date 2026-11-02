import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PageLimitDto } from '../../common/pagination';

// The likes list is keyed by the liker's user ID (a Clerk ID, not a UUID), so
// that's the cursor.
export class LikesQueryDto extends PageLimitDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  cursor?: string;
}
