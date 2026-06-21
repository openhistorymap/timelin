import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
} from 'react';
import {
  Timeline as CoreTimeline,
  type Era,
  type PlayOptions,
  type Theme,
  type TimelineEvent,
  type TimelineGroup,
  type TimelineOptions,
  type ViewRange,
} from '@openhistorymap/timeline-core';

export interface TimelineProps {
  /** Controlled cursor year. Changes animate the cursor. */
  year?: number;
  /** Events to render in the event band. */
  events?: TimelineEvent[];
  /** Swimlane definitions (tag events via `event.group`). */
  groups?: TimelineGroup[];
  /** Layout mode: `'auto'` (default), `'swimlane'`, or `'flat'`. */
  groupMode?: 'auto' | 'swimlane' | 'flat';
  /** Grow height to fit swimlanes. Default true. */
  autoHeight?: boolean;
  /** Left label gutter width (px) in swimlane mode. Default 132. */
  groupGutter?: number;
  /** Curated era markers (defaults to the bundled OHM set). */
  eras?: Era[];
  /** Initial visible span in years (used only on first mount). */
  viewSpan?: number;
  /** Design-token overrides. */
  theme?: Partial<Theme>;
  /** Zoom clamps. */
  minSpan?: number;
  maxSpan?: number;
  /** Animate cursor on `year` changes. Default true. */
  animate?: boolean;
  /** Seek to an event's year when it is clicked. Default true. */
  seekOnEventClick?: boolean;

  onYearChange?: (year: number) => void;
  onRangeChange?: (range: ViewRange) => void;
  onEraSelect?: (era: Era) => void;
  onEventSelect?: (event: TimelineEvent) => void;
  onGroupSelect?: (group: TimelineGroup) => void;
  onPlay?: () => void;
  onPause?: () => void;

  className?: string;
  style?: CSSProperties;
}

/** Imperative handle exposed via `ref`. */
export interface TimelineHandle {
  play(opts?: PlayOptions): void;
  pause(): void;
  setView(start: number, end: number): void;
  centerOn(year: number, span?: number): void;
  getYear(): number;
  /** Escape hatch to the underlying core instance. */
  readonly instance: CoreTimeline | null;
}

/**
 * React binding for `@openhistorymap/timeline-core`. The component owns a single
 * core instance for its lifetime; props are synced imperatively so React never
 * re-creates the timeline.
 */
export const Timeline = forwardRef<TimelineHandle, TimelineProps>(function Timeline(props, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<CoreTimeline | null>(null);

  // Keep latest callbacks in a ref so the subscription effect runs once.
  const cbRef = useRef(props);
  cbRef.current = props;

  /* Create the core once. */
  useEffect(() => {
    if (!hostRef.current) return;
    const opts: TimelineOptions = {
      year: cbRef.current.year,
      events: cbRef.current.events,
      groups: cbRef.current.groups,
      groupMode: cbRef.current.groupMode,
      autoHeight: cbRef.current.autoHeight,
      groupGutter: cbRef.current.groupGutter,
      eras: cbRef.current.eras,
      viewSpan: cbRef.current.viewSpan,
      theme: cbRef.current.theme,
      minSpan: cbRef.current.minSpan,
      maxSpan: cbRef.current.maxSpan,
      animate: cbRef.current.animate,
      seekOnEventClick: cbRef.current.seekOnEventClick,
    };
    const tl = new CoreTimeline(hostRef.current, opts);
    coreRef.current = tl;

    const offs = [
      tl.on('yearChange', (y) => cbRef.current.onYearChange?.(y)),
      tl.on('rangeChange', (r) => cbRef.current.onRangeChange?.(r)),
      tl.on('eraSelect', (e) => cbRef.current.onEraSelect?.(e)),
      tl.on('eventSelect', (e) => cbRef.current.onEventSelect?.(e)),
      tl.on('groupSelect', (g) => cbRef.current.onGroupSelect?.(g)),
      tl.on('play', () => cbRef.current.onPlay?.()),
      tl.on('pause', () => cbRef.current.onPause?.()),
    ];

    return () => {
      offs.forEach((off) => off());
      tl.destroy();
      coreRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Sync controlled props. */
  useEffect(() => {
    if (props.year !== undefined) coreRef.current?.setYear(props.year, { silent: true });
  }, [props.year]);

  useEffect(() => {
    if (props.events) coreRef.current?.setEvents(props.events);
  }, [props.events]);

  useEffect(() => {
    if (props.groups) coreRef.current?.setGroups(props.groups);
  }, [props.groups]);

  useEffect(() => {
    if (props.eras) coreRef.current?.setEras(props.eras);
  }, [props.eras]);

  useEffect(() => {
    if (props.theme) coreRef.current?.setTheme(props.theme);
  }, [props.theme]);

  useImperativeHandle(
    ref,
    (): TimelineHandle => ({
      play: (opts) => coreRef.current?.play(opts),
      pause: () => coreRef.current?.pause(),
      setView: (s, e) => coreRef.current?.setView(s, e),
      centerOn: (y, span) => coreRef.current?.centerOn(y, span),
      getYear: () => coreRef.current?.getYear() ?? 0,
      get instance() {
        return coreRef.current;
      },
    }),
    [],
  );

  return <div ref={hostRef} className={props.className} style={props.style} />;
});
