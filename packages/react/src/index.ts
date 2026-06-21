export { Timeline } from './Timeline';
export type { TimelineProps, TimelineHandle } from './Timeline';

// Re-export the core types/values so React consumers need only one dependency.
export {
  DEFAULT_ERAS,
  TIMELINE_CSS,
  numericYear,
  formatYear,
  formatPlainYear,
  formatYearRange,
} from '@openhistorymap/timeline-core';
export type {
  DecimalYear,
  Era,
  TimelineEvent,
  TimelineGroup,
  Theme,
  ViewRange,
  PlayOptions,
} from '@openhistorymap/timeline-core';
