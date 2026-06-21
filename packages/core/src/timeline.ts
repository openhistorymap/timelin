import {
  DecimalYear,
  Era,
  PlayOptions,
  Theme,
  TimelineEvent,
  TimelineEventName,
  TimelineListener,
  TimelineOptions,
  ViewRange,
} from './types';
import { formatPlainYear, formatYear, formatYearRange, numericYear } from './time';
import { DEFAULT_ERAS } from './eras';
import { CSS, STYLE_ELEMENT_ID } from './styles';

const SVG_NS = 'http://www.w3.org/2000/svg';

/* Maps a Theme key to its CSS custom property on the root. */
const THEME_VARS: Record<keyof Theme, string> = {
  groundDeep: '--timelin-ground-deep',
  ground: '--timelin-ground',
  groundRaised: '--timelin-ground-raised',
  hairline: '--timelin-hairline',
  hairlineBright: '--timelin-hairline-bright',
  inkSoft: '--timelin-ink-soft',
  ink: '--timelin-ink',
  inkBright: '--timelin-ink-bright',
  brass: '--timelin-brass',
  brassSoft: '--timelin-brass-soft',
  fontDisplay: '--timelin-font-display',
  fontBody: '--timelin-font-body',
};

interface Tick {
  year: number;
  x: number;
  major: boolean;
  label?: string;
}

interface PlacedEvent {
  ev: TimelineEvent;
  x0: number;
  x1: number;
  lane: number;
  isSpan: boolean;
}

/**
 * A framework-agnostic, deep-time interactive timeline.
 *
 * Render it into any element; it draws an SVG ruler whose axis is a continuous
 * decimal-year scale (BCE → CE on one line), a band of events, curated era
 * markers, and a weighted "now" cursor with playback. Pan by dragging, zoom
 * with the wheel, seek by clicking. Everything is observable via {@link on}.
 *
 * ```ts
 * const tl = new Timeline(document.getElementById('tl')!, {
 *   year: 1492,
 *   events: [{ id: 'a', year: 1492, title: 'Columbus reaches the Americas' }],
 * });
 * tl.on('yearChange', (y) => console.log('now at', y));
 * ```
 */
export class Timeline {
  private root: HTMLElement;
  private wrap!: HTMLDivElement;
  private svg!: SVGSVGElement;
  private gTicks!: SVGGElement;
  private gLabels!: SVGGElement;
  private gEras!: SVGGElement;
  private gEvents!: SVGGElement;
  private gCursor!: SVGGElement;
  private readout!: HTMLDivElement;
  private readoutPlain!: HTMLSpanElement;
  private tooltip!: HTMLDivElement;

  private opts: Required<Omit<TimelineOptions, 'theme' | 'view'>> & {
    theme?: Partial<Theme>;
  };

  private width = 1000;
  private height = 120;
  private viewStart = 766;
  private viewEnd = 966;

  private cursorYear = 866;
  private cursorX = 0;

  private eras: Era[];
  private events: TimelineEvent[];
  private placed: PlacedEvent[] = [];

  private hoveredEra: number | null = null;
  private hoveredEvent: string | null = null;

  /* interaction state */
  private dragging = false;
  private dragStartX = 0;
  private dragStartView: [number, number] = [0, 0];
  private dragMoved = false;

  private resizeObs?: ResizeObserver;
  private cursorRaf?: number;
  private playRaf?: number;
  private playLast = 0;
  private playOpts: Required<PlayOptions> | null = null;

  private listeners: { [K in TimelineEventName]?: Set<TimelineListener<K>> } = {};
  private destroyed = false;

  constructor(host: HTMLElement, options: TimelineOptions = {}) {
    this.root = host;
    this.opts = {
      year: options.year ?? 866,
      viewSpan: options.viewSpan ?? 240,
      eras: options.eras ?? DEFAULT_ERAS,
      events: options.events ?? [],
      minSpan: options.minSpan ?? 20,
      maxSpan: options.maxSpan ?? 20000,
      injectStyles: options.injectStyles ?? true,
      animate: options.animate ?? true,
      seekOnEventClick: options.seekOnEventClick ?? true,
      theme: options.theme,
    };

    this.eras = this.opts.eras.slice();
    this.events = this.opts.events.slice();
    this.cursorYear = numericYear(this.opts.year);

    if (this.opts.injectStyles) injectStyles();
    this.buildDom();
    if (this.opts.theme) this.setTheme(this.opts.theme);

    const initialView = options.view;
    this.measure();
    if (initialView) {
      this.viewStart = initialView.start;
      this.viewEnd = initialView.end;
    } else {
      this.centerOn(this.cursorYear, this.opts.viewSpan);
    }
    this.recompute();

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObs = new ResizeObserver(() => this.resize());
      this.resizeObs.observe(this.root);
    }
  }

  /* ===================================================================== */
  /* DOM construction                                                       */
  /* ===================================================================== */

  private buildDom() {
    this.root.classList.add('timelin-root');
    this.root.innerHTML = '';

    this.wrap = document.createElement('div');
    this.wrap.className = 'timelin-wrap';

    this.svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
    this.svg.setAttribute('class', 'timelin-ruler');
    this.svg.setAttribute('preserveAspectRatio', 'none');

    this.gTicks = svgGroup('timelin-ticks');
    this.gLabels = svgGroup('timelin-labels');
    this.gEras = svgGroup('timelin-eras');
    this.gEvents = svgGroup('timelin-events');
    this.gCursor = svgGroup('timelin-cursor');
    this.svg.append(this.gTicks, this.gLabels, this.gEras, this.gEvents, this.gCursor);

    this.readout = document.createElement('div');
    this.readout.className = 'timelin-readout';
    const anno = document.createElement('span');
    anno.className = 'anno';
    anno.textContent = 'anno';
    this.readoutPlain = document.createElement('span');
    this.readoutPlain.className = 'plain';
    this.readout.append(anno, this.readoutPlain);

    this.tooltip = document.createElement('div');
    this.tooltip.className = 'timelin-tooltip';
    this.tooltip.style.display = 'none';

    this.wrap.append(this.svg, this.readout);
    this.root.append(this.wrap, this.tooltip);

    /* pointer + wheel interaction */
    this.svg.addEventListener('pointerdown', this.onPointerDown);
    this.svg.addEventListener('pointermove', this.onPointerMove);
    this.svg.addEventListener('pointerup', this.onPointerUp);
    this.svg.addEventListener('pointercancel', this.onPointerUp);
    this.svg.addEventListener('wheel', this.onWheel, { passive: false });
  }

  /* ===================================================================== */
  /* Geometry                                                               */
  /* ===================================================================== */

  private measure() {
    this.width = this.root.clientWidth || 1000;
    this.height = Math.max(96, this.root.clientHeight || 120);
    this.svg.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);
    this.svg.setAttribute('width', String(this.width));
    this.svg.setAttribute('height', String(this.height));
  }

  private xFor(year: number): number {
    const span = this.viewEnd - this.viewStart;
    return ((year - this.viewStart) / span) * this.width;
  }

  private yearAt(px: number): number {
    const span = this.viewEnd - this.viewStart;
    return this.viewStart + (px / this.width) * span;
  }

  /** Vertical layout bands derived from the current height. */
  private get bands() {
    const labelY = 36;
    const eventsTop = 46;
    const eventsBottom = this.height - 22;
    const lanePitch = 17;
    const maxLanes = Math.max(1, Math.floor((eventsBottom - eventsTop) / lanePitch));
    return { labelY, eventsTop, eventsBottom, lanePitch, maxLanes };
  }

  /* ===================================================================== */
  /* Recompute + render                                                     */
  /* ===================================================================== */

  private recompute() {
    if (this.destroyed) return;
    this.renderTicks();
    this.renderEras();
    this.renderEvents();
    this.renderCursor();
    this.emit('rangeChange', { start: this.viewStart, end: this.viewEnd });
  }

  private renderTicks() {
    const span = this.viewEnd - this.viewStart;
    const pxPerYear = this.width / span;

    let minor: number;
    let major: number;
    if (pxPerYear >= 12) {
      minor = 1;
      major = 10;
    } else if (pxPerYear >= 1.2) {
      minor = 10;
      major = 100;
    } else if (pxPerYear >= 0.12) {
      minor = 100;
      major = 1000;
    } else {
      minor = 1000;
      major = 5000;
    }

    const ticks: Tick[] = [];
    const startTick = Math.ceil(this.viewStart / minor) * minor;
    for (let y = startTick; y <= this.viewEnd; y += minor) {
      // Guard against float drift accumulating across thousands of years.
      const yr = Math.round(y);
      ticks.push({
        year: yr,
        x: this.xFor(yr),
        major: yr % major === 0,
        label: yr % major === 0 ? formatYear(yr) : undefined,
      });
    }

    clear(this.gTicks);
    clear(this.gLabels);
    for (const t of ticks) {
      this.gTicks.append(
        svgEl('line', {
          x1: t.x,
          x2: t.x,
          y1: t.major ? 0 : 6,
          y2: t.major ? 22 : 14,
          class: t.major ? 'timelin-tick major' : 'timelin-tick minor',
          'shape-rendering': 'crispEdges',
        }),
      );
      if (t.label !== undefined) {
        this.gLabels.append(
          svgEl(
            'text',
            {
              x: t.x,
              y: this.bands.labelY,
              class: 'timelin-year-label' + (t.year === 0 ? ' epoch' : ''),
              'text-anchor': 'middle',
            },
            t.label,
          ),
        );
      }
    }
  }

  private renderEras() {
    clear(this.gEras);
    const { eventsTop } = this.bands;
    const lineBottom = this.height - 6;

    this.eras.forEach((e, i) => {
      if (e.year < this.viewStart || e.year > this.viewEnd) return;
      const x = this.xFor(e.year);
      const hovered = this.hoveredEra === i;
      this.gEras.append(
        svgEl('line', {
          x1: x,
          x2: x,
          y1: eventsTop,
          y2: lineBottom,
          class: 'timelin-era-line' + (hovered ? ' is-hovered' : ''),
        }),
        svgEl('circle', {
          cx: x,
          cy: eventsTop,
          r: 2,
          class: 'timelin-era-dot' + (hovered ? ' is-hovered' : ''),
        }),
      );
      const hit = svgEl('rect', {
        x: x - 9,
        y: eventsTop - 6,
        width: 18,
        height: lineBottom - eventsTop + 6,
        class: 'timelin-era-hit',
      });
      hit.addEventListener('mouseenter', () => this.showEraTooltip(i, x));
      hit.addEventListener('mouseleave', () => this.hideTooltip());
      hit.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.activateEra(i);
      });
      this.gEras.append(hit);
    });
  }

  private renderEvents() {
    clear(this.gEvents);
    if (!this.events.length) {
      this.placed = [];
      return;
    }
    const { eventsTop, eventsBottom, lanePitch, maxLanes } = this.bands;
    const MIN_W = 6;

    // Visible events only, sorted by start position.
    const visible = this.events
      .filter((e) => {
        const end = e.endYear !== undefined ? Math.max(e.endYear, e.year) : e.year;
        return end >= this.viewStart && e.year <= this.viewEnd;
      })
      .sort((a, b) => a.year - b.year);

    // Greedy lane packing.
    const laneLastX: number[] = [];
    const placed: PlacedEvent[] = [];
    for (const ev of visible) {
      const isSpan = ev.endYear !== undefined && ev.endYear > ev.year;
      let x0 = this.xFor(ev.year);
      let x1 = isSpan ? this.xFor(ev.endYear as number) : x0 + MIN_W;
      if (x1 - x0 < MIN_W) x1 = x0 + MIN_W;
      let lane = laneLastX.findIndex((last) => x0 - last > 2);
      if (lane === -1) {
        lane = laneLastX.length < maxLanes ? laneLastX.length : maxLanes - 1;
      }
      laneLastX[lane] = x1;
      placed.push({ ev, x0, x1, lane, isSpan });
    }
    this.placed = placed;

    for (const p of placed) {
      const y = eventsTop + p.lane * lanePitch;
      const laneH = Math.min(12, lanePitch - 3);
      const hovered = this.hoveredEvent === p.ev.id;
      const cx = Math.max(0, Math.min(this.width, p.x0));

      if (p.isSpan) {
        const xClamped = Math.max(0, p.x0);
        const wClamped = Math.min(this.width, p.x1) - xClamped;
        const rect = svgEl('rect', {
          x: xClamped,
          y,
          width: Math.max(1, wClamped),
          height: laneH,
          rx: 2,
          class: 'timelin-event-span' + (hovered ? ' is-hovered' : ''),
        });
        if (p.ev.color) {
          rect.style.fill = p.ev.color;
          rect.style.stroke = p.ev.color;
        }
        this.gEvents.append(rect);
      } else {
        const dot = svgEl('circle', {
          cx,
          cy: y + laneH / 2,
          r: hovered ? 4 : 3,
          class: 'timelin-event-dot' + (hovered ? ' is-hovered' : ''),
        });
        if (p.ev.color) dot.style.fill = p.ev.color;
        this.gEvents.append(dot);
      }

      // Transparent, generous hit target.
      const hitX = Math.max(0, p.x0 - 4);
      const hitW = Math.max(MIN_W + 8, Math.min(this.width, p.x1) - hitX + 4);
      const hit = svgEl('rect', {
        x: hitX,
        y: y - 2,
        width: hitW,
        height: laneH + 4,
        class: 'timelin-event-hit',
      });
      hit.addEventListener('mouseenter', () => this.showEventTooltip(p, y));
      hit.addEventListener('mouseleave', () => this.hideTooltip());
      hit.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.activateEvent(p.ev);
      });
      this.gEvents.append(hit);
    }
  }

  private renderCursor() {
    clear(this.gCursor);
    this.cursorX = this.xFor(this.cursorYear);
    this.readoutPlain.textContent = formatPlainYear(this.cursorYear);

    const offLeft = this.cursorX < 0;
    const offRight = this.cursorX > this.width;

    if (!offLeft && !offRight) {
      const x = this.cursorX;
      this.gCursor.append(
        svgEl('line', {
          x1: x,
          x2: x,
          y1: 0,
          y2: this.height,
          class: 'timelin-cursor-line',
          'shape-rendering': 'crispEdges',
        }),
        svgEl('polygon', {
          class: 'timelin-cursor-cap',
          points: `${x - 4},0 ${x + 4},0 ${x},8`,
        }),
        svgEl('polygon', {
          class: 'timelin-cursor-base',
          points: `${x - 4},${this.height} ${x + 4},${this.height} ${x},${this.height - 8}`,
        }),
      );
      this.readout.style.display = '';
      this.readout.style.transform = `translateX(${x}px)`;
    } else {
      this.readout.style.display = 'none';
      // Edge arrow indicating off-screen cursor.
      if (offLeft) {
        this.gCursor.append(svgEl('polygon', { class: 'timelin-cursor-cap', points: '2,28 12,22 12,34' }));
      } else {
        this.gCursor.append(
          svgEl('polygon', {
            class: 'timelin-cursor-cap',
            points: `${this.width - 2},28 ${this.width - 12},22 ${this.width - 12},34`,
          }),
        );
      }
    }
  }

  /* ===================================================================== */
  /* Tooltips                                                                */
  /* ===================================================================== */

  private showEraTooltip(i: number, x: number) {
    const e = this.eras[i];
    if (!e) return;
    this.hoveredEra = i;
    this.renderEras();
    this.fillTooltip(formatPlainYear(e.year), e.label, x);
  }

  private showEventTooltip(p: PlacedEvent, y: number) {
    this.hoveredEvent = p.ev.id;
    this.renderEvents();
    const x = (Math.max(0, p.x0) + Math.min(this.width, p.x1)) / 2;
    this.fillTooltip(
      formatYearRange(p.ev.year, p.ev.endYear),
      p.ev.description ? `${p.ev.title} — ${p.ev.description}` : p.ev.title,
      x,
      y,
    );
  }

  private fillTooltip(year: string, label: string, x: number, anchorY = this.bands.eventsTop) {
    this.tooltip.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'card';
    const yEl = document.createElement('span');
    yEl.className = 'year';
    yEl.textContent = year;
    const lEl = document.createElement('span');
    lEl.className = 'label';
    lEl.textContent = label;
    card.append(yEl, lEl);
    const tail = document.createElement('span');
    tail.className = 'tail';
    tail.setAttribute('aria-hidden', 'true');
    this.tooltip.append(card, tail);
    this.tooltip.style.left = `${x}px`;
    this.tooltip.style.top = `${anchorY}px`;
    this.tooltip.style.display = '';
  }

  private hideTooltip() {
    this.tooltip.style.display = 'none';
    if (this.hoveredEra !== null) {
      this.hoveredEra = null;
      this.renderEras();
    }
    if (this.hoveredEvent !== null) {
      this.hoveredEvent = null;
      this.renderEvents();
    }
  }

  /* ===================================================================== */
  /* Pointer interaction                                                    */
  /* ===================================================================== */

  private onPointerDown = (ev: PointerEvent) => {
    (ev.currentTarget as Element).setPointerCapture?.(ev.pointerId);
    this.dragging = true;
    this.dragMoved = false;
    this.dragStartX = ev.clientX;
    this.dragStartView = [this.viewStart, this.viewEnd];
  };

  private onPointerMove = (ev: PointerEvent) => {
    if (!this.dragging) return;
    const dx = ev.clientX - this.dragStartX;
    if (Math.abs(dx) > 3) this.dragMoved = true;
    const span = this.dragStartView[1] - this.dragStartView[0];
    const dy = (-dx / this.width) * span;
    this.viewStart = this.dragStartView[0] + dy;
    this.viewEnd = this.dragStartView[1] + dy;
    this.recompute();
  };

  private onPointerUp = (ev: PointerEvent) => {
    if (!this.dragging) return;
    this.dragging = false;
    if (!this.dragMoved) {
      const rect = this.svg.getBoundingClientRect();
      const y = this.yearAt(ev.clientX - rect.left);
      this.cursorYear = y;
      this.renderCursor();
      this.emit('yearChange', y);
    }
  };

  private onWheel = (ev: WheelEvent) => {
    ev.preventDefault();
    const rect = this.svg.getBoundingClientRect();
    const cx = ev.clientX - rect.left;
    const span = this.viewEnd - this.viewStart;
    const yAtCursor = this.yearAt(cx);
    const factor = ev.deltaY > 0 ? 1.2 : 1 / 1.2;
    const newSpan = Math.max(this.opts.minSpan, Math.min(this.opts.maxSpan, span * factor));
    const ratio = (yAtCursor - this.viewStart) / span;
    this.viewStart = yAtCursor - ratio * newSpan;
    this.viewEnd = this.viewStart + newSpan;
    this.recompute();
  };

  private activateEra(i: number) {
    const e = this.eras[i];
    if (!e) return;
    this.setYear(e.year, { animate: true });
    this.emit('eraSelect', e);
  }

  private activateEvent(ev: TimelineEvent) {
    if (this.opts.seekOnEventClick) this.setYear(ev.year, { animate: true });
    this.emit('eventSelect', ev);
  }

  /* ===================================================================== */
  /* Cursor animation                                                       */
  /* ===================================================================== */

  private animateCursorTo(target: number) {
    if (this.cursorRaf) cancelAnimationFrame(this.cursorRaf);
    const start = this.cursorYear;
    const dur = 320;
    const ease = (t: number) => 1 - Math.pow(1 - t, 4); // ease-out-quart
    let t0: number | null = null;

    const step = (now: number) => {
      if (t0 === null) t0 = now;
      const t = Math.min(1, (now - t0) / dur);
      this.cursorYear = start + (target - start) * ease(t);
      this.renderCursor();
      if (t < 1) {
        this.cursorRaf = requestAnimationFrame(step);
      } else {
        this.cursorRaf = undefined;
      }
    };
    this.cursorRaf = requestAnimationFrame(step);
  }

  /* ===================================================================== */
  /* Playback                                                               */
  /* ===================================================================== */

  /** Start advancing the cursor through time. */
  play(opts: PlayOptions = {}) {
    if (this.playRaf) cancelAnimationFrame(this.playRaf);
    this.playOpts = {
      yearsPerSecond: opts.yearsPerSecond ?? 5,
      to: opts.to ?? Number.POSITIVE_INFINITY,
      loop: opts.loop ?? false,
    };
    const startYear = this.cursorYear;
    this.playLast = 0;
    this.emit('play', undefined);

    const step = (now: number) => {
      if (!this.playOpts) return;
      if (!this.playLast) this.playLast = now;
      const dt = (now - this.playLast) / 1000;
      this.playLast = now;

      let next = this.cursorYear + this.playOpts.yearsPerSecond * dt;
      if (next >= this.playOpts.to) {
        if (this.playOpts.loop) {
          next = startYear;
        } else {
          this.cursorYear = this.playOpts.to;
          this.renderCursor();
          this.emit('yearChange', this.cursorYear);
          this.pause();
          return;
        }
      }
      this.cursorYear = next;
      this.keepCursorInView();
      this.renderCursor();
      this.emit('yearChange', this.cursorYear);
      this.playRaf = requestAnimationFrame(step);
    };
    this.playRaf = requestAnimationFrame(step);
  }

  /** Stop playback. */
  pause() {
    if (this.playRaf) cancelAnimationFrame(this.playRaf);
    this.playRaf = undefined;
    if (this.playOpts) {
      this.playOpts = null;
      this.emit('pause', undefined);
    }
  }

  /** Whether playback is currently running. */
  get isPlaying(): boolean {
    return this.playRaf !== undefined;
  }

  /** Pan the view to follow the cursor when it nears (or passes) an edge. */
  private keepCursorInView() {
    const span = this.viewEnd - this.viewStart;
    const margin = span * 0.15;
    if (this.cursorYear > this.viewEnd - margin) {
      const shift = this.cursorYear - (this.viewEnd - margin);
      this.viewStart += shift;
      this.viewEnd += shift;
      this.recompute();
    } else if (this.cursorYear < this.viewStart + margin) {
      const shift = this.viewStart + margin - this.cursorYear;
      this.viewStart -= shift;
      this.viewEnd -= shift;
      this.recompute();
    }
  }

  /* ===================================================================== */
  /* Public API                                                             */
  /* ===================================================================== */

  /** Move the cursor to a year. Emits `yearChange`. */
  setYear(year: DecimalYear | string, opts: { animate?: boolean; silent?: boolean } = {}) {
    const target = numericYear(year);
    const animate = opts.animate ?? this.opts.animate;
    if (animate && Math.abs(target - this.cursorYear) > 0.0001) {
      this.animateCursorTo(target);
    } else {
      this.cursorYear = target;
      this.renderCursor();
    }
    if (!opts.silent) this.emit('yearChange', target);
  }

  /** Current cursor year. */
  getYear(): DecimalYear {
    return this.cursorYear;
  }

  /** Set the visible range explicitly. */
  setView(start: DecimalYear, end: DecimalYear) {
    this.viewStart = start;
    this.viewEnd = end;
    this.recompute();
  }

  /** Current visible range. */
  getView(): ViewRange {
    return { start: this.viewStart, end: this.viewEnd };
  }

  /** Centre the view on a year with an optional span. */
  centerOn(year: DecimalYear, span = this.viewEnd - this.viewStart) {
    this.viewStart = year - span / 2;
    this.viewEnd = year + span / 2;
    this.recompute();
  }

  /** Replace the event set and re-render. */
  setEvents(events: TimelineEvent[]) {
    this.events = events.slice();
    this.renderEvents();
  }

  /** Current events. */
  getEvents(): TimelineEvent[] {
    return this.events.slice();
  }

  /** Replace the era markers and re-render. */
  setEras(eras: Era[]) {
    this.eras = eras.slice();
    this.renderEras();
  }

  /** Apply theme token overrides as CSS custom properties on the root. */
  setTheme(theme: Partial<Theme>) {
    for (const key of Object.keys(theme) as (keyof Theme)[]) {
      const value = theme[key];
      if (value !== undefined) this.root.style.setProperty(THEME_VARS[key], value);
    }
  }

  /** Re-measure and re-render (call after the host element is resized). */
  resize() {
    if (this.destroyed) return;
    this.measure();
    this.recompute();
  }

  /** Subscribe to an event. Returns an unsubscribe function. */
  on<K extends TimelineEventName>(name: K, listener: TimelineListener<K>): () => void {
    (this.listeners[name] ??= new Set() as never).add(listener as never);
    return () => this.off(name, listener);
  }

  /** Unsubscribe from an event. */
  off<K extends TimelineEventName>(name: K, listener: TimelineListener<K>) {
    this.listeners[name]?.delete(listener as never);
  }

  private emit<K extends TimelineEventName>(name: K, payload: Parameters<TimelineListener<K>>[0]) {
    this.listeners[name]?.forEach((l) => (l as TimelineListener<K>)(payload));
  }

  /** Tear down listeners, observers, animations, and DOM. */
  destroy() {
    this.destroyed = true;
    this.pause();
    if (this.cursorRaf) cancelAnimationFrame(this.cursorRaf);
    this.resizeObs?.disconnect();
    this.svg.removeEventListener('pointerdown', this.onPointerDown);
    this.svg.removeEventListener('pointermove', this.onPointerMove);
    this.svg.removeEventListener('pointerup', this.onPointerUp);
    this.svg.removeEventListener('pointercancel', this.onPointerUp);
    this.svg.removeEventListener('wheel', this.onWheel);
    this.listeners = {};
    this.root.classList.remove('timelin-root');
    this.root.innerHTML = '';
  }
}

/* ===================================================================== */
/* Small DOM helpers                                                      */
/* ===================================================================== */

function svgGroup(cls: string): SVGGElement {
  const g = document.createElementNS(SVG_NS, 'g') as SVGGElement;
  g.setAttribute('class', cls);
  return g;
}

function svgEl(
  tag: string,
  attrs: Record<string, string | number>,
  text?: string,
): SVGElement {
  const el = document.createElementNS(SVG_NS, tag) as SVGElement;
  for (const k in attrs) el.setAttribute(k, String(attrs[k]));
  if (text !== undefined) el.textContent = text;
  return el;
}

function clear(node: Element) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** Inject the bundled stylesheet once. */
export function injectStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ELEMENT_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}
