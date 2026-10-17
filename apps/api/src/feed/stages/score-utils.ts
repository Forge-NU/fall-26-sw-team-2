import type { FeedCandidate } from '../feed.types';

// Highest score first; ties go to the newer itinerary, then by id so order is stable.
export function compareByScore(a: FeedCandidate, b: FeedCandidate): number {
  return (
    b.score - a.score ||
    b.createdAt.getTime() - a.createdAt.getTime() ||
    a.itineraryId.localeCompare(b.itineraryId)
  );
}

// Scales a score so a multiplier below 1 always demotes and above 1 always promotes,
// including when the score is negative.
export function applyMultiplier(score: number, multiplier: number): number {
  return score >= 0 ? score * multiplier : score / multiplier;
}
