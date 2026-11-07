import { PATH_METADATA } from '@nestjs/common/constants';
import { FollowsController } from './follows.controller';

describe('FollowsController', () => {
  // The global 'api' prefix comes from main.ts, so the path must not repeat it (#87)
  it('is mounted at users', () => {
    expect(Reflect.getMetadata(PATH_METADATA, FollowsController)).toBe('users');
  });
});
