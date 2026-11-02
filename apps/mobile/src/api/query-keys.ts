// React Query keys, so screens that change a trip know what to refresh
export const queryKeys = {
  trip: (id: string) => ['trips', id] as const,
  tripPosts: (id: string) => ['trips', id, 'posts'] as const,
  userTrips: (userId: string) => ['users', userId, 'trips'] as const,
  activeTrips: ['me', 'trips', 'active'] as const,
};
