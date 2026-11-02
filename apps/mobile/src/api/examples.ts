// The example for an endpoint that isn't built yet: there's no
// /api/examples/travelers on the API. Copy this shape for real ones (see
// docs/process/mobile-data-layer.md).
import type { PaginatedResponse, UserResponse } from 'shared-types';

import { apiGet } from '@/api/client';
import { mockDelay, mockPage, withMock } from '@/api/mock';

const FIRST_NAMES = ['Maya', 'Priya', 'Noah', 'Jordan', 'Sofia', 'Kenji', 'Amara', 'Leo', 'Ines'];
const LAST_NAMES = ['Chen', 'Shah', 'Okafor', 'Silva', 'Tanaka', 'Novak', 'Haddad', 'Rossi'];

const travelers: UserResponse[] = Array.from({ length: 45 }, (_, i) => {
  const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
  const lastName = LAST_NAMES[i % LAST_NAMES.length];
  return {
    id: `mock-user-${i + 1}`,
    firstName,
    lastName,
    username: `${firstName}.${lastName}${i + 1}`.toLowerCase(),
    avatarUrl: null,
  };
});

export const listExampleTravelers = withMock<
  [cursor: string | null, signal?: AbortSignal],
  PaginatedResponse<UserResponse>
>({
  live: false,
  real: (cursor, signal) => apiGet('/api/examples/travelers', { cursor, limit: 20 }, { signal }),
  mock: async (cursor) => {
    await mockDelay();
    return mockPage(travelers, cursor);
  },
});
