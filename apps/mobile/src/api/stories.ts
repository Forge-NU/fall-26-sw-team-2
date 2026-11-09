import type { CreateStoryRequest, StoryResponse } from 'shared-types';

import { apiRequest } from '@/api/client';
import { withMock } from '@/api/mock';
import { mockCreateStory } from '@/api/mock-backend';

export const createStory = withMock({
  live: true,
  real: (body: CreateStoryRequest) => apiRequest<StoryResponse>('POST', '/api/stories', body),
  mock: mockCreateStory,
});
