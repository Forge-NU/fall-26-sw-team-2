// React Query keys, so screens that change a trip or a follow know what to refresh
export const queryKeys = {
  trip: (id: string) => ['trips', id] as const,
  tripPosts: (id: string) => ['trips', id, 'posts'] as const,
  userTrips: (userId: string) => ['users', userId, 'trips'] as const,
  // The profile's paged trip list. Under userTrips, so invalidating that refreshes it too.
  userTripPages: (userId: string) => ['users', userId, 'trips', 'pages'] as const,
  // Not ['posts', id] alone, so invalidating it leaves the likes and comments lists be
  post: (id: string) => ['posts', id, 'detail'] as const,
  // The post's detail, likes and comments together, e.g. once it's deleted
  postAll: (id: string) => ['posts', id] as const,
  userPosts: (userId: string) => ['users', userId, 'posts'] as const,
  activeTrips: ['me', 'trips', 'active'] as const,
  myProfile: ['me', 'profile'] as const,
  profile: (userId: string) => ['users', userId, 'profile'] as const,
  followStatus: (userId: string) => ['users', userId, 'follow-status'] as const,
  followList: (userId: string, list: 'followers' | 'following') => ['users', userId, list] as const,
  storiesFeed: ['stories', 'feed'] as const,
  tripStories: (tripId: string) => ['trips', tripId, 'stories'] as const,
  // The owner's pending invites, and the people search on the invite screen (#138)
  tripInvites: (tripId: string) => ['trips', tripId, 'invites'] as const,
  inviteSearch: (tripId: string, q: string) => ['trips', tripId, 'invite-search', q] as const,
  notifications: ['me', 'notifications', 'list'] as const,
  unreadNotifications: ['me', 'notifications', 'unread-count'] as const,
  // One search: the "All" preview or one type's pages, for the text and the
  // filters that apply (as JSON). Follows update the cached people searches
  // and previews (useFollow).
  searchPeople: ['search', 'people'] as const,
  searchPreview: ['search', 'all'] as const,
  search: (tab: 'all' | 'people' | 'places' | 'trips' | 'posts', q: string, filters: string) =>
    ['search', tab, q, filters] as const,
};
