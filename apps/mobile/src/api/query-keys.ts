// React Query keys, so screens that change a trip or a follow know what to refresh
export const queryKeys = {
  trip: (id: string) => ['trips', id] as const,
  tripPosts: (id: string) => ['trips', id, 'posts'] as const,
  userTrips: (userId: string) => ['users', userId, 'trips'] as const,
  // The profile's paged trip list. Under userTrips, so invalidating that refreshes it too.
  userTripPages: (userId: string) => ['users', userId, 'trips', 'pages'] as const,
  userPosts: (userId: string) => ['users', userId, 'posts'] as const,
  activeTrips: ['me', 'trips', 'active'] as const,
  myProfile: ['me', 'profile'] as const,
  profile: (userId: string) => ['users', userId, 'profile'] as const,
  followStatus: (userId: string) => ['users', userId, 'follow-status'] as const,
  followList: (userId: string, list: 'followers' | 'following') => ['users', userId, list] as const,
  // Search results for one type. Follows update every cached people search (useFollow).
  searchPeople: ['search', 'people'] as const,
  search: (type: 'people' | 'places', q: string) => ['search', type, q] as const,
};
