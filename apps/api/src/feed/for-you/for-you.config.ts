import { FeedSignal } from '../feed.types';

export interface ForYouConfig {
  // Linear weights per signal. Placeholder values until we have data to tune against.
  weights: Record<FeedSignal, number>;
  candidatesPerSource: number;
  recencyHalfLifeDays: number;
  diversity: {
    // How many of the most recent picks to compare against.
    authorWindow: number;
    // Score multiplier applied once per same-author item inside the window.
    repeatPenalty: number;
  };
  defaultPageSize: number;
  maxPageSize: number;
}

export const DEFAULT_FOR_YOU_CONFIG: ForYouConfig = {
  weights: {
    tasteMatch: 0.35,
    quality: 0.2,
    engagement: 0.2,
    recency: 0.15,
    community: 0.1,
  },
  candidatesPerSource: 200,
  // Itineraries stay useful for a long time, so decay slowly.
  recencyHalfLifeDays: 30,
  diversity: {
    authorWindow: 3,
    repeatPenalty: 0.5,
  },
  defaultPageSize: 20,
  maxPageSize: 50,
};

export const FOR_YOU_CONFIG = Symbol('FOR_YOU_CONFIG');
export const FOR_YOU_SOURCES = Symbol('FOR_YOU_SOURCES');
export const FOR_YOU_HYDRATORS = Symbol('FOR_YOU_HYDRATORS');
export const FOR_YOU_FILTERS = Symbol('FOR_YOU_FILTERS');
export const FOR_YOU_SCORER = Symbol('FOR_YOU_SCORER');
export const FOR_YOU_RERANKER = Symbol('FOR_YOU_RERANKER');
