import type { Audience, Place, Stats } from './types';

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Combines places into one rating: average weighted by number of reviews,
 * summed logs, and distinct people. A country or area with no places gets 0
 * reviews, so it never shows a rating it can't back up.
 */
export function aggregate(places: Place[], audience: Audience): Stats {
  let reviews = 0;
  let weighted = 0;
  let logs = 0;
  let globalPeople = 0;
  const friends = new Set<string>();

  for (const pl of places) {
    const st = pl.stats[audience];
    reviews += st.reviews;
    weighted += st.rating * st.reviews;
    logs += st.logs;
    globalPeople += st.people;
    if (st.logs > 0) pl.friendNames.forEach((n) => friends.add(n));
  }

  const people = audience === 'me' ? (logs > 0 ? 1 : 0) : audience === 'friends' ? friends.size : globalPeople;
  return { rating: reviews ? round1(weighted / reviews) : 0, reviews, logs, people };
}
