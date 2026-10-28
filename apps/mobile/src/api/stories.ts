import { apiRequest, USE_MOCK_API } from '@/api/client';
import { mockCreateStory } from '@/api/mocks';
import type { CreateStoryRequest, StoryResponse } from '@/api/types';

export function createStory(body: CreateStoryRequest): Promise<StoryResponse> {
  if (USE_MOCK_API) return mockCreateStory(body);
  return apiRequest('POST', '/api/stories', body);
}
