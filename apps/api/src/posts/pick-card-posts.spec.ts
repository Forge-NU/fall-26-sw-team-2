import { pickCardPosts } from './posts.service';

// Candidates as listCardPostsForTrips reads them, already in trip order
function post(
  id: string,
  visitedOn: string,
  { place = false, image = false, tripId = 'trip' } = {},
) {
  return {
    id,
    tripId,
    visitedOn: new Date(visitedOn),
    locationId: place ? `loc-${id}` : null,
    customLocationName: null,
    media: image ? [{ id: `media-${id}` }] : [],
  };
}

describe('pickCardPosts', () => {
  it("keeps one post a day when it has the day's place and image", () => {
    expect(
      pickCardPosts([
        post('a', '2026-09-12', { place: true, image: true }),
        post('b', '2026-09-12', { place: true, image: true }),
        post('c', '2026-09-13', { place: true, image: true }),
        post('d', '2026-09-13', { place: true, image: true }),
      ]),
    ).toEqual(['a', 'c']);
  });

  it("keeps the day's first located post and first image when they differ", () => {
    expect(
      pickCardPosts([
        post('a', '2026-09-12'),
        post('b', '2026-09-12', { image: true }),
        post('c', '2026-09-12', { place: true }),
        post('d', '2026-09-12', { place: true, image: true }),
      ]),
    ).toEqual(['b', 'c']);
  });

  it('counts a custom location name as a place', () => {
    expect(
      pickCardPosts([
        { ...post('a', '2026-09-12'), customLocationName: 'Grandma’s' },
        post('b', '2026-09-12', { place: true }),
      ]),
    ).toEqual(['a']);
  });

  it('keeps the first post of a day with no place or image anywhere', () => {
    expect(
      pickCardPosts([
        post('a', '2026-09-12'),
        post('b', '2026-09-12'),
        post('c', '2026-09-13', { place: true, image: true }),
      ]),
    ).toEqual(['c', 'a']);
  });

  it('picks per trip, so the same date on two trips is two days', () => {
    expect(
      pickCardPosts([
        post('a', '2026-09-12', { place: true, image: true, tripId: 't1' }),
        post('b', '2026-09-12', { place: true, image: true, tripId: 't2' }),
      ]),
    ).toEqual(['a', 'b']);
  });

  it('bounds a card by its days, not its posts', () => {
    const posts = Array.from({ length: 300 }, (_, i) =>
      post(`p${i}`, `2026-09-${String(12 + (i % 3)).padStart(2, '0')}`, {
        place: true,
        image: true,
      }),
    );
    expect(pickCardPosts(posts)).toEqual(['p0', 'p1', 'p2']);
  });
});
