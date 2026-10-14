import { FeedSignal } from '../feed.types';

export interface FypConfig {
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

export const DEFAULT_FYP_CONFIG: FypConfig = {
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

export const FYP_CONFIG = Symbol('FYP_CONFIG');
export const FYP_SOURCES = Symbol('FYP_SOURCES');
export const FYP_HYDRATORS = Symbol('FYP_HYDRATORS');
export const FYP_FILTERS = Symbol('FYP_FILTERS');
export const FYP_SCORER = Symbol('FYP_SCORER');
export const FYP_RERANKER = Symbol('FYP_RERANKER');
