import { IsOptional, IsString, IsUUID } from 'class-validator';
import { CharLength } from '../../common/char-length';
import { Trim } from '../../common/trim';

export const COMMENT_MAX_LENGTH = 500;

export class CreateCommentDto {
  // 1 to 500 characters after trimming (#33 DOC-1)
  @Trim()
  @IsString()
  @CharLength(1, COMMENT_MAX_LENGTH)
  body: string;

  // The comment being replied to. A reply to a reply is stored under the
  // same top-level comment, so replies never nest.
  @IsOptional()
  @IsUUID('all')
  parentCommentId?: string;
}
