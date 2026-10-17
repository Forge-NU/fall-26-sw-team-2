import type { FeedAction } from '../feed.types';

export interface FypConfig {
  // Baseline P(action) per impression, used for trips without much data yet.
  actionPriors: Record<FeedAction, number>;
  // How many impressions' worth of weight the prior gets against a trip's own data.
  priorStrength: number;
  // Multiply predicted probabilities, not raw counts. Negative for negative actions.
  actionWeights: Record<FeedAction, number>;
  recency: { halfLifeDays: number; floor: number };
  authorDiversity: { decay: number; floor: number };
  // position is 0-based.
  newAuthorSlot: { impressionThreshold: number; position: number };
  candidatesPerSource: number;
  defaultPageSize: number;
  maxPageSize: number;
}

// Placeholder values until we have data to tune against.
export const DEFAULT_FYP_CONFIG: FypConfig = {
  actionPriors: {
    open: 0.1,
    like: 0.05,
    save: 0.02,
    addToTrip: 0.005,
    share: 0.005,
    comment: 0.005,
    followAuthor: 0.003,
    hide: 0.005,
    report: 0.0005,
  },
  priorStrength: 20,
  actionWeights: {
    open: 1,
    like: 2,
    save: 6,
    addToTrip: 10,
    share: 6,
    comment: 4,
    followAuthor: 8,
    hide: -20,
    report: -100,
  },
  // Trips stay useful for a long time, so decay slowly and never below half.
  recency: { halfLifeDays: 30, floor: 0.5 },
  authorDiversity: { decay: 0.6, floor: 0.25 },
  newAuthorSlot: { impressionThreshold: 500, position: 2 },
  candidatesPerSource: 200,
  defaultPageSize: 20,
  maxPageSize: 50,
};

export const FYP_CONFIG = Symbol('FYP_CONFIG');
export const FYP_VIEWER_HYDRATORS = Symbol('FYP_VIEWER_HYDRATORS');
export const FYP_SOURCES = Symbol('FYP_SOURCES');
export const FYP_CANDIDATE_HYDRATORS = Symbol('FYP_CANDIDATE_HYDRATORS');
export const FYP_FILTERS = Symbol('FYP_FILTERS');
export const FYP_SCORERS = Symbol('FYP_SCORERS');
export const FYP_SELECTOR = Symbol('FYP_SELECTOR');
export const FYP_SIDE_EFFECTS = Symbol('FYP_SIDE_EFFECTS');
export const FYP_CARD_LOADER = Symbol('FYP_CARD_LOADER');
