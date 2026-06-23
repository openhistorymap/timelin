import { DAY, HOUR, MONTH, MONTHS_SHORT, formatCursor, formatPlainYear, formatYear, formatYearRange, numericYear, } from './time.js';
import { DEFAULT_ERAS } from './eras.js';
import { CSS, STYLE_ELEMENT_ID } from './styles.js';
const SVG_NS = 'http://www.w3.org/2000/svg';
const THEME_VARS = {
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
const LANE_AREA_TOP = 44;
const SUBLANE_PITCH = 17;
const EVENT_H = 12;
const ROW_PAD_V = 6;
const BOTTOM_PAD = 18;
const MIN_W = 6;
const LABEL_Y = 36;
let CLIP_SEQ = 0;
export class Timeline {
    constructor(host, options = {}) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
        this.scrollY = 0;
        this.clipId = `timelin-clip-${++CLIP_SEQ}`;
        this.width = 1000;
        this.height = 120;
        this.hostHeight = 120;
        this.appliedHeight = null;
        this.viewStart = 766;
        this.viewEnd = 966;
        this.cursorYear = 866;
        this.cursorX = 0;
        this.layout = {
            mode: 'flat',
            gutter: 0,
            plotLeft: 0,
            plotWidth: 1000,
            contentHeight: 120,
            effectiveHeight: 120,
            maxScrollY: 0,
            laneAreaTop: LANE_AREA_TOP,
            rows: [],
            flatTop: 46,
            flatBottom: 98,
            flatMaxLanes: 3,
        };
        this.hoveredEra = null;
        this.hoveredEvent = null;
        this.eventMarkers = new Map();
        this.eraMarkers = new Map();
        this.dragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragStartScrollY = 0;
        this.dragStartView = [0, 0];
        this.dragMoved = false;
        this.gutterDown = false;
        this.gutterDownY = 0;
        this.scrollbarDrag = false;
        this.scrollStartPointer = 0;
        this.scrollStartY = 0;
        this.playLast = 0;
        this.playOpts = null;
        this.listeners = {};
        this.destroyed = false;
        this.onPointerDown = (ev) => {
            var _a, _b;
            (_b = (_a = ev.currentTarget).setPointerCapture) === null || _b === void 0 ? void 0 : _b.call(_a, ev.pointerId);
            const rect = this.svg.getBoundingClientRect();
            const lx = ev.clientX - rect.left;
            const ly = ev.clientY - rect.top;
            if (this.layout.maxScrollY > 0 && lx >= this.width - 12) {
                this.scrollbarDrag = true;
                this.scrollStartPointer = ev.clientY;
                this.scrollStartY = this.scrollY;
                return;
            }
            if (this.layout.mode === 'swimlane' && lx < this.layout.plotLeft) {
                this.gutterDown = true;
                this.gutterDownY = ly;
                return;
            }
            this.dragging = true;
            this.dragMoved = false;
            this.dragStartX = ev.clientX;
            this.dragStartY = ev.clientY;
            this.dragStartScrollY = this.scrollY;
            this.dragStartView = [this.viewStart, this.viewEnd];
        };
        this.onPointerMove = (ev) => {
            if (this.scrollbarDrag) {
                const top = this.layout.laneAreaTop;
                const viewH = this.height - top;
                const contentH = this.layout.contentHeight - top;
                const thumbH = Math.max(24, (viewH * viewH) / contentH);
                const ratio = (ev.clientY - this.scrollStartPointer) / Math.max(1, viewH - thumbH);
                this.setScroll(this.scrollStartY + ratio * this.layout.maxScrollY);
                return;
            }
            if (!this.dragging)
                return;
            const dx = ev.clientX - this.dragStartX;
            const dyPx = ev.clientY - this.dragStartY;
            if (Math.abs(dx) > 3 || Math.abs(dyPx) > 3)
                this.dragMoved = true;
            const span = this.dragStartView[1] - this.dragStartView[0];
            const shift = (-dx / this.layout.plotWidth) * span;
            this.setView_(this.dragStartView[0] + shift, this.dragStartView[1] + shift);
            if (this.layout.maxScrollY > 0) {
                this.scrollY = Math.max(0, Math.min(this.dragStartScrollY - dyPx, this.layout.maxScrollY));
            }
            this.recompute();
        };
        this.onPointerUp = (ev) => {
            if (this.scrollbarDrag) {
                this.scrollbarDrag = false;
                return;
            }
            if (this.gutterDown) {
                this.gutterDown = false;
                const y = this.gutterDownY + this.scrollY;
                const row = this.layout.rows.find((r) => r.group && y >= r.top && y <= r.top + r.height);
                if (row === null || row === void 0 ? void 0 : row.group)
                    this.emit('groupSelect', row.group);
                return;
            }
            if (!this.dragging)
                return;
            this.dragging = false;
            if (this.dragMoved)
                return;
            const el = document.elementFromPoint(ev.clientX, ev.clientY);
            const evId = el === null || el === void 0 ? void 0 : el.getAttribute('data-ev');
            if (evId) {
                const event = this.events.find((e) => e.id === evId);
                if (event) {
                    this.activateEvent(event);
                    return;
                }
            }
            const eraI = el === null || el === void 0 ? void 0 : el.getAttribute('data-era');
            if (eraI != null) {
                this.activateEra(parseInt(eraI, 10));
                return;
            }
            const y = this.yearAt(this.localX(ev));
            this.cursorYear = y;
            this.renderCursor();
            this.emit('yearChange', y);
        };
        this.onWheel = (ev) => {
            if (this.layout.maxScrollY > 0 && (ev.shiftKey || Math.abs(ev.deltaX) > Math.abs(ev.deltaY))) {
                ev.preventDefault();
                const d = Math.abs(ev.deltaY) > Math.abs(ev.deltaX) ? ev.deltaY : ev.deltaX;
                this.setScroll(this.scrollY + d);
                return;
            }
            ev.preventDefault();
            const cx = Math.max(this.layout.plotLeft, this.localX(ev));
            const span = this.viewEnd - this.viewStart;
            const yAtCursor = this.yearAt(cx);
            const factor = ev.deltaY > 0 ? 1.2 : 1 / 1.2;
            const newSpan = Math.max(this.opts.minSpan, Math.min(this.opts.maxSpan, span * factor));
            const ratio = (yAtCursor - this.viewStart) / span;
            const start = yAtCursor - ratio * newSpan;
            this.setView_(start, start + newSpan);
            this.recompute();
        };
        this.root = host;
        this.opts = {
            year: (_a = options.year) !== null && _a !== void 0 ? _a : 866,
            viewSpan: (_b = options.viewSpan) !== null && _b !== void 0 ? _b : 240,
            eras: (_c = options.eras) !== null && _c !== void 0 ? _c : DEFAULT_ERAS,
            events: (_d = options.events) !== null && _d !== void 0 ? _d : [],
            groups: (_e = options.groups) !== null && _e !== void 0 ? _e : [],
            groupMode: (_f = options.groupMode) !== null && _f !== void 0 ? _f : 'auto',
            autoHeight: (_g = options.autoHeight) !== null && _g !== void 0 ? _g : true,
            groupGutter: (_h = options.groupGutter) !== null && _h !== void 0 ? _h : 132,
            ungroupedLabel: (_j = options.ungroupedLabel) !== null && _j !== void 0 ? _j : '',
            maxSubLanes: (_k = options.maxSubLanes) !== null && _k !== void 0 ? _k : 6,
            minSpan: (_l = options.minSpan) !== null && _l !== void 0 ? _l : HOUR,
            maxSpan: (_m = options.maxSpan) !== null && _m !== void 0 ? _m : 20000,
            injectStyles: (_o = options.injectStyles) !== null && _o !== void 0 ? _o : true,
            animate: (_p = options.animate) !== null && _p !== void 0 ? _p : true,
            seekOnEventClick: (_q = options.seekOnEventClick) !== null && _q !== void 0 ? _q : true,
            maxHeight: options.maxHeight,
            extent: options.extent,
            theme: options.theme,
        };
        this.eras = this.opts.eras.slice();
        this.events = this.opts.events.slice();
        this.groups = this.opts.groups.slice();
        this.cursorYear = numericYear(this.opts.year);
        if (this.opts.injectStyles)
            injectStyles();
        this.buildDom();
        if (this.opts.theme)
            this.setTheme(this.opts.theme);
        this.measure();
        if (options.view) {
            this.setView_(options.view.start, options.view.end);
        }
        else {
            this.setView_(this.cursorYear - this.opts.viewSpan / 2, this.cursorYear + this.opts.viewSpan / 2);
        }
        this.recompute();
        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObs = new ResizeObserver(() => this.resize());
            this.resizeObs.observe(this.root);
        }
    }
    buildDom() {
        this.root.classList.add('timelin-root');
        this.root.innerHTML = '';
        this.wrap = document.createElement('div');
        this.wrap.className = 'timelin-wrap';
        this.svg = document.createElementNS(SVG_NS, 'svg');
        this.svg.setAttribute('class', 'timelin-ruler');
        this.svg.setAttribute('preserveAspectRatio', 'none');
        this.gLanes = svgGroup('timelin-lanes');
        this.gTicks = svgGroup('timelin-ticks');
        this.gLabels = svgGroup('timelin-labels');
        this.gEras = svgGroup('timelin-eras');
        this.gEvents = svgGroup('timelin-events');
        this.gGutter = svgGroup('timelin-gutter-g');
        this.gGutterBg = svgGroup('timelin-gutter-bg-g');
        this.gCursor = svgGroup('timelin-cursor');
        this.gScrollbar = svgGroup('timelin-scrollbar-g');
        const defs = document.createElementNS(SVG_NS, 'defs');
        const clip = document.createElementNS(SVG_NS, 'clipPath');
        clip.setAttribute('id', this.clipId);
        this.clipRect = svgEl('rect', { x: 0, y: 0, width: 1, height: 1 });
        clip.append(this.clipRect);
        defs.append(clip);
        this.gScrollClip = svgGroup('timelin-scrollclip');
        this.gScrollClip.setAttribute('clip-path', `url(#${this.clipId})`);
        this.gScrollInner = svgGroup('timelin-scrollinner');
        this.gScrollInner.append(this.gLanes, this.gEras, this.gEvents, this.gGutter);
        this.gScrollClip.append(this.gScrollInner);
        this.svg.append(defs, this.gGutterBg, this.gScrollClip, this.gTicks, this.gLabels, this.gCursor, this.gScrollbar);
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
        this.svg.addEventListener('pointerdown', this.onPointerDown);
        this.svg.addEventListener('pointermove', this.onPointerMove);
        this.svg.addEventListener('pointerup', this.onPointerUp);
        this.svg.addEventListener('pointercancel', this.onPointerUp);
        this.svg.addEventListener('wheel', this.onWheel, { passive: false });
    }
    measure() {
        this.width = this.root.clientWidth || 1000;
        this.hostHeight = Math.max(96, this.root.clientHeight || 120);
    }
    applySvgSize() {
        this.svg.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);
        this.svg.setAttribute('width', String(this.width));
        this.svg.setAttribute('height', String(this.height));
    }
    applyHostHeight(h) {
        if (h === null) {
            if (this.appliedHeight !== null) {
                this.root.style.height = '';
                this.appliedHeight = null;
            }
            return;
        }
        if (this.appliedHeight !== h) {
            this.root.style.height = `${h}px`;
            this.appliedHeight = h;
        }
    }
    xFor(year) {
        const span = this.viewEnd - this.viewStart;
        return this.layout.plotLeft + ((year - this.viewStart) / span) * this.layout.plotWidth;
    }
    yearAt(px) {
        const span = this.viewEnd - this.viewStart;
        return this.viewStart + ((px - this.layout.plotLeft) / this.layout.plotWidth) * span;
    }
    clampView(start, end) {
        const ext = this.opts.extent;
        if (!ext)
            return [start, end];
        const [lo, hi] = ext;
        const span = end - start;
        const maxW = hi - lo;
        if (span >= maxW)
            return [lo, hi];
        if (start < lo)
            return [lo, lo + span];
        if (end > hi)
            return [hi - span, hi];
        return [start, end];
    }
    setView_(start, end) {
        [this.viewStart, this.viewEnd] = this.clampView(start, end);
    }
    resolveMode() {
        if (this.opts.groupMode === 'flat')
            return 'flat';
        if (this.opts.groupMode === 'swimlane')
            return 'swimlane';
        const hasGroups = this.groups.some((g) => g.visible !== false) || this.events.some((e) => e.group != null);
        return hasGroups ? 'swimlane' : 'flat';
    }
    resolveGroups() {
        const map = new Map();
        this.groups.forEach((g, i) => map.set(g.id, { order: i, ...g }));
        let order = this.groups.length;
        for (const e of this.events) {
            if (e.group != null && !map.has(e.group))
                map.set(e.group, { id: e.group, order: order++ });
        }
        return [...map.values()]
            .filter((g) => g.visible !== false)
            .sort((a, b) => { var _a, _b; return ((_a = a.order) !== null && _a !== void 0 ? _a : 0) - ((_b = b.order) !== null && _b !== void 0 ? _b : 0); });
    }
    computeLayout() {
        var _a, _b;
        const mode = this.resolveMode();
        if (mode === 'flat') {
            const top = 46;
            const h = Math.max(96, this.hostHeight);
            const bottom = h - 22;
            const maxLanes = Math.max(1, Math.floor((bottom - top) / SUBLANE_PITCH));
            return {
                mode,
                gutter: 0,
                plotLeft: 0,
                plotWidth: this.width,
                contentHeight: h,
                effectiveHeight: h,
                maxScrollY: 0,
                laneAreaTop: top,
                rows: [],
                flatTop: top,
                flatBottom: bottom,
                flatMaxLanes: maxLanes,
            };
        }
        const gutter = this.opts.groupGutter;
        const groups = this.resolveGroups();
        const visibleIds = new Set(groups.map((g) => g.id));
        const byGroup = new Map();
        const ungrouped = [];
        for (const e of this.events) {
            if (e.group != null) {
                if (!visibleIds.has(e.group))
                    continue;
                const list = byGroup.get(e.group);
                if (list)
                    list.push(e);
                else
                    byGroup.set(e.group, [e]);
            }
            else {
                ungrouped.push(e);
            }
        }
        const rows = [];
        let y = LANE_AREA_TOP;
        const addRow = (group, evs, label) => {
            const { assign, lanes } = packYearSpace(evs, this.opts.maxSubLanes, group === null || group === void 0 ? void 0 : group.lanes);
            const height = ROW_PAD_V * 2 + lanes * SUBLANE_PITCH;
            rows.push({ group, top: y, height, subLanes: lanes, events: evs, assign, color: group === null || group === void 0 ? void 0 : group.color, label });
            y += height;
        };
        for (const g of groups)
            addRow(g, (_a = byGroup.get(g.id)) !== null && _a !== void 0 ? _a : [], (_b = g.label) !== null && _b !== void 0 ? _b : g.id);
        if (ungrouped.length)
            addRow(null, ungrouped, this.opts.ungroupedLabel);
        const contentHeight = Math.max(96, y + BOTTOM_PAD);
        const cap = this.opts.maxHeight;
        const effectiveHeight = this.opts.autoHeight
            ? cap != null
                ? Math.max(96, Math.min(contentHeight, cap))
                : contentHeight
            : Math.max(96, this.hostHeight);
        const maxScrollY = Math.max(0, contentHeight - effectiveHeight);
        return {
            mode,
            gutter,
            plotLeft: gutter,
            plotWidth: Math.max(1, this.width - gutter),
            contentHeight,
            effectiveHeight,
            maxScrollY,
            laneAreaTop: LANE_AREA_TOP,
            rows,
            flatTop: 0,
            flatBottom: 0,
            flatMaxLanes: 1,
        };
    }
    recompute() {
        if (this.destroyed)
            return;
        this.layout = this.computeLayout();
        const useAuto = this.layout.mode === 'swimlane' && this.opts.autoHeight;
        this.height = this.layout.effectiveHeight;
        this.applyHostHeight(useAuto ? this.height : null);
        this.applySvgSize();
        this.scrollY = Math.max(0, Math.min(this.scrollY, this.layout.maxScrollY));
        this.updateScrollTransform();
        this.renderLanes();
        this.renderTicks();
        this.renderEras();
        this.renderEvents();
        this.renderGutter();
        this.renderCursor();
        this.renderScrollbar();
        this.emit('rangeChange', { start: this.viewStart, end: this.viewEnd });
    }
    updateScrollTransform() {
        const top = this.layout.laneAreaTop;
        this.clipRect.setAttribute('x', '0');
        this.clipRect.setAttribute('y', String(top));
        this.clipRect.setAttribute('width', String(this.width));
        this.clipRect.setAttribute('height', String(Math.max(0, this.height - top)));
        this.gScrollInner.setAttribute('transform', `translate(0, ${-this.scrollY})`);
    }
    renderScrollbar() {
        clear(this.gScrollbar);
        if (this.layout.maxScrollY <= 0)
            return;
        const top = this.layout.laneAreaTop;
        const viewH = this.height - top;
        const contentH = this.layout.contentHeight - top;
        const x = this.width - 5;
        this.gScrollbar.append(svgEl('rect', { x, y: top, width: 3, height: viewH, rx: 1.5, class: 'timelin-scrolltrack' }));
        const thumbH = Math.max(24, (viewH * viewH) / contentH);
        const thumbY = top + (this.scrollY / this.layout.maxScrollY) * (viewH - thumbH);
        this.gScrollbar.append(svgEl('rect', { x: x - 1, y: thumbY, width: 5, height: thumbH, rx: 2.5, class: 'timelin-scrollthumb' }));
    }
    setScroll(y) {
        const clamped = Math.max(0, Math.min(y, this.layout.maxScrollY));
        if (clamped === this.scrollY)
            return;
        this.scrollY = clamped;
        this.recompute();
    }
    renderLanes() {
        clear(this.gLanes);
        if (this.layout.mode !== 'swimlane')
            return;
        const { plotLeft, plotWidth, rows } = this.layout;
        this.gLanes.append(svgEl('line', {
            x1: 0,
            x2: this.width,
            y1: this.layout.laneAreaTop,
            y2: this.layout.laneAreaTop,
            class: 'timelin-lane-sep',
        }));
        for (const row of rows) {
            if (row.color) {
                const bg = svgEl('rect', {
                    x: plotLeft,
                    y: row.top,
                    width: plotWidth,
                    height: row.height,
                    class: 'timelin-lane-bg',
                });
                bg.style.fill = row.color;
                bg.style.fillOpacity = '0.06';
                this.gLanes.append(bg);
            }
            this.gLanes.append(svgEl('line', {
                x1: 0,
                x2: this.width,
                y1: row.top + row.height,
                y2: row.top + row.height,
                class: 'timelin-lane-sep',
            }));
        }
    }
    computeTicks() {
        const start = this.viewStart;
        const end = this.viewEnd;
        const pxPerYear = this.layout.plotWidth / (end - start);
        const out = [];
        const fmod = (n, m) => ((n % m) + m) % m;
        const push = (pos, major, label) => {
            if (pos >= start && pos <= end)
                out.push({ year: pos, x: 0, major, label });
        };
        if (pxPerYear * HOUR >= 6) {
            const lab = pxPerYear * HOUR >= 26;
            for (let i = Math.floor(start / HOUR); i <= Math.ceil(end / HOUR); i++) {
                const H = fmod(i, 24);
                const td = Math.floor(i / 24);
                const D = fmod(td, 31);
                const M = fmod(Math.floor(td / 31), 12);
                push(i * HOUR, H === 0, H === 0 ? `${D + 1} ${MONTHS_SHORT[M]}` : lab ? `${String(H).padStart(2, '0')}h` : undefined);
            }
        }
        else if (pxPerYear * DAY >= 6) {
            const lab = pxPerYear * DAY >= 18;
            for (let j = Math.floor(start / DAY); j <= Math.ceil(end / DAY); j++) {
                const D = fmod(j, 31);
                const tm = Math.floor(j / 31);
                const M = fmod(tm, 12);
                const Y = Math.floor(tm / 12);
                push(j * DAY, D === 0, D === 0 ? `${MONTHS_SHORT[M]} ${formatYear(Y)}` : lab ? String(D + 1) : undefined);
            }
        }
        else if (pxPerYear * MONTH >= 6) {
            const lab = pxPerYear * MONTH >= 26;
            for (let k = Math.floor(start / MONTH); k <= Math.ceil(end / MONTH); k++) {
                const M = fmod(k, 12);
                const Y = Math.floor(k / 12);
                push(k * MONTH, M === 0, M === 0 ? formatYear(Y) : lab ? MONTHS_SHORT[M] : undefined);
            }
        }
        else {
            let minor;
            let major;
            if (pxPerYear >= 12)
                [minor, major] = [1, 10];
            else if (pxPerYear >= 1.2)
                [minor, major] = [10, 100];
            else if (pxPerYear >= 0.12)
                [minor, major] = [100, 1000];
            else
                [minor, major] = [1000, 5000];
            for (let yv = Math.ceil(start / minor) * minor; yv <= end; yv += minor) {
                const yr = Math.round(yv);
                push(yr, yr % major === 0, yr % major === 0 ? formatYear(yr) : undefined);
            }
        }
        return out;
    }
    renderTicks() {
        const ticks = this.computeTicks();
        for (const t of ticks)
            t.x = this.xFor(t.year);
        clear(this.gTicks);
        clear(this.gLabels);
        for (const t of ticks) {
            if (t.x < this.layout.plotLeft - 0.5)
                continue;
            this.gTicks.append(svgEl('line', {
                x1: t.x,
                x2: t.x,
                y1: t.major ? 0 : 6,
                y2: t.major ? 22 : 14,
                class: t.major ? 'timelin-tick major' : 'timelin-tick minor',
                'shape-rendering': 'crispEdges',
            }));
            if (t.label !== undefined && t.x >= this.layout.plotLeft + 14) {
                this.gLabels.append(svgEl('text', {
                    x: t.x,
                    y: LABEL_Y,
                    class: 'timelin-year-label' + (t.year === 0 ? ' epoch' : ''),
                    'text-anchor': 'middle',
                }, t.label));
            }
        }
    }
    renderEras() {
        clear(this.gEras);
        this.eraMarkers.clear();
        const top = this.layout.laneAreaTop;
        const lineBottom = this.layout.contentHeight - 6;
        this.eras.forEach((e, i) => {
            if (e.year < this.viewStart || e.year > this.viewEnd)
                return;
            const x = this.xFor(e.year);
            if (x < this.layout.plotLeft - 0.5)
                return;
            const hovered = this.hoveredEra === i;
            const line = svgEl('line', {
                x1: x,
                x2: x,
                y1: top,
                y2: lineBottom,
                class: 'timelin-era-line' + (hovered ? ' is-hovered' : ''),
            });
            const dot = svgEl('circle', {
                cx: x,
                cy: top,
                r: 2,
                class: 'timelin-era-dot' + (hovered ? ' is-hovered' : ''),
            });
            this.eraMarkers.set(i, [line, dot]);
            this.gEras.append(line, dot);
            const hit = svgEl('rect', {
                x: x - 9,
                y: top - 6,
                width: 18,
                height: lineBottom - top + 6,
                class: 'timelin-era-hit',
                'data-era': String(i),
            });
            hit.addEventListener('mouseenter', () => this.showEraTooltip(i, x));
            hit.addEventListener('mouseleave', () => this.hideTooltip());
            this.gEras.append(hit);
        });
    }
    renderEvents() {
        clear(this.gEvents);
        this.eventMarkers.clear();
        if (!this.events.length)
            return;
        if (this.layout.mode === 'swimlane')
            this.renderSwimEvents();
        else
            this.renderFlatEvents();
    }
    renderFlatEvents() {
        const { flatTop, flatBottom, flatMaxLanes } = this.layout;
        const lanePitch = SUBLANE_PITCH;
        const visible = this.events
            .filter((e) => {
            const end = e.endYear !== undefined ? Math.max(e.endYear, e.year) : e.year;
            return end >= this.viewStart && e.year <= this.viewEnd;
        })
            .sort((a, b) => a.year - b.year);
        const laneLastX = [];
        for (const ev of visible) {
            const isSpan = ev.endYear !== undefined && ev.endYear > ev.year;
            const x0 = this.xFor(ev.year);
            let x1 = isSpan ? this.xFor(ev.endYear) : x0 + MIN_W;
            if (x1 - x0 < MIN_W)
                x1 = x0 + MIN_W;
            let lane = laneLastX.findIndex((last) => x0 - last > 2);
            if (lane === -1)
                lane = laneLastX.length < flatMaxLanes ? laneLastX.length : flatMaxLanes - 1;
            laneLastX[lane] = x1;
            const y = Math.min(flatBottom - EVENT_H, flatTop + lane * lanePitch);
            this.placeEvent(ev, y, ev.color, flatTop);
        }
    }
    renderSwimEvents() {
        var _a, _b;
        for (const row of this.layout.rows) {
            for (const ev of row.events) {
                const end = ev.endYear !== undefined ? Math.max(ev.endYear, ev.year) : ev.year;
                if (end < this.viewStart || ev.year > this.viewEnd)
                    continue;
                const sub = (_a = row.assign.get(ev.id)) !== null && _a !== void 0 ? _a : 0;
                const y = row.top + ROW_PAD_V + sub * SUBLANE_PITCH;
                this.placeEvent(ev, y, (_b = ev.color) !== null && _b !== void 0 ? _b : row.color, row.top);
            }
        }
    }
    placeEvent(ev, yTop, color, anchorY) {
        const isSpan = ev.endYear !== undefined && ev.endYear > ev.year;
        const x0 = this.xFor(ev.year);
        let x1 = isSpan ? this.xFor(ev.endYear) : x0 + MIN_W;
        if (x1 - x0 < MIN_W)
            x1 = x0 + MIN_W;
        const hovered = this.hoveredEvent === ev.id;
        const plotLeft = this.layout.plotLeft;
        const emph = ev.emphasis === true;
        if (isSpan) {
            const xC = Math.max(plotLeft, x0);
            const w = Math.min(this.width, x1) - xC;
            const rect = svgEl('rect', {
                x: xC,
                y: yTop,
                width: Math.max(1, w),
                height: EVENT_H,
                rx: 2,
                class: 'timelin-event-span' + (hovered ? ' is-hovered' : '') + (emph ? ' is-emphasis' : ''),
            });
            if (color) {
                rect.style.fill = color;
                rect.style.fillOpacity = hovered || emph ? '0.6' : '0.34';
                rect.style.stroke = color;
            }
            this.eventMarkers.set(ev.id, { el: rect, span: true, colored: !!color, r: 3, emph });
            this.gEvents.append(rect);
        }
        else {
            const cx = Math.max(plotLeft, Math.min(this.width, x0));
            const baseR = emph ? 5 : 3;
            const dot = svgEl('circle', {
                cx,
                cy: yTop + EVENT_H / 2,
                r: hovered ? baseR + 1 : baseR,
                class: 'timelin-event-dot' + (hovered ? ' is-hovered' : '') + (emph ? ' is-emphasis' : ''),
            });
            if (color)
                dot.style.fill = color;
            this.eventMarkers.set(ev.id, { el: dot, span: false, colored: !!color, r: baseR, emph });
            this.gEvents.append(dot);
        }
        const hitX = Math.max(plotLeft, x0 - 4);
        const hitW = Math.max(MIN_W + 8, Math.min(this.width, x1) - hitX + 4);
        const hit = svgEl('rect', {
            x: hitX,
            y: yTop - 2,
            width: hitW,
            height: EVENT_H + 4,
            class: 'timelin-event-hit',
            'data-ev': ev.id,
        });
        const cx = (Math.max(plotLeft, x0) + Math.min(this.width, x1)) / 2;
        hit.addEventListener('mouseenter', () => this.showEventTooltip(ev, cx, anchorY));
        hit.addEventListener('mouseleave', () => this.hideTooltip());
        this.gEvents.append(hit);
    }
    renderGutter() {
        clear(this.gGutter);
        clear(this.gGutterBg);
        if (this.layout.mode !== 'swimlane' || this.layout.gutter <= 0)
            return;
        const gutter = this.layout.gutter;
        this.gGutterBg.append(svgEl('rect', { x: 0, y: 0, width: gutter, height: this.height, class: 'timelin-gutter-bg' }), svgEl('line', { x1: gutter, x2: gutter, y1: 0, y2: this.height, class: 'timelin-gutter-divider' }));
        const maxChars = Math.max(3, Math.floor((gutter - 22) / 6.2));
        for (const row of this.layout.rows) {
            const cy = row.top + row.height / 2;
            if (row.color) {
                const accent = svgEl('rect', { x: 0, y: row.top, width: 3, height: row.height, class: 'timelin-lane-accent' });
                accent.style.fill = row.color;
                this.gGutter.append(accent);
            }
            if (row.label) {
                const label = svgEl('text', {
                    x: 12,
                    y: cy,
                    class: 'timelin-group-label' + (row.group ? ' clickable' : ''),
                    'dominant-baseline': 'middle',
                }, truncate(row.label, maxChars));
                if (row.color)
                    label.style.fill = row.color;
                this.gGutter.append(label);
            }
            if (row.group) {
                const hit = svgEl('rect', { x: 0, y: row.top, width: gutter, height: row.height, class: 'timelin-group-hit' });
                const g = row.group;
                hit.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.emit('groupSelect', g);
                });
                this.gGutter.append(hit);
            }
        }
    }
    renderCursor() {
        clear(this.gCursor);
        this.cursorX = this.xFor(this.cursorYear);
        this.readoutPlain.textContent = formatCursor(this.cursorYear, this.viewEnd - this.viewStart);
        const offLeft = this.cursorX < this.layout.plotLeft;
        const offRight = this.cursorX > this.width;
        if (!offLeft && !offRight) {
            const x = this.cursorX;
            this.gCursor.append(svgEl('line', {
                x1: x,
                x2: x,
                y1: 0,
                y2: this.height,
                class: 'timelin-cursor-line',
                'shape-rendering': 'crispEdges',
            }), svgEl('polygon', { class: 'timelin-cursor-cap', points: `${x - 4},0 ${x + 4},0 ${x},8` }), svgEl('polygon', {
                class: 'timelin-cursor-base',
                points: `${x - 4},${this.height} ${x + 4},${this.height} ${x},${this.height - 8}`,
            }));
            this.readout.style.display = '';
            this.readout.style.transform = `translateX(${x}px)`;
        }
        else {
            this.readout.style.display = 'none';
            const edge = this.layout.plotLeft;
            if (offLeft) {
                this.gCursor.append(svgEl('polygon', {
                    class: 'timelin-cursor-cap',
                    points: `${edge + 2},28 ${edge + 12},22 ${edge + 12},34`,
                }));
            }
            else {
                this.gCursor.append(svgEl('polygon', {
                    class: 'timelin-cursor-cap',
                    points: `${this.width - 2},28 ${this.width - 12},22 ${this.width - 12},34`,
                }));
            }
        }
    }
    setEraHover(i, on) {
        var _a;
        (_a = this.eraMarkers.get(i)) === null || _a === void 0 ? void 0 : _a.forEach((el) => el.classList.toggle('is-hovered', on));
    }
    setEventHover(id, on) {
        const m = this.eventMarkers.get(id);
        if (!m)
            return;
        m.el.classList.toggle('is-hovered', on);
        if (m.span) {
            if (m.colored)
                m.el.style.fillOpacity = on || m.emph ? '0.6' : '0.34';
        }
        else {
            m.el.setAttribute('r', String(on ? m.r + 1 : m.r));
        }
    }
    showEraTooltip(i, x) {
        const e = this.eras[i];
        if (!e)
            return;
        if (this.hoveredEra !== null && this.hoveredEra !== i)
            this.setEraHover(this.hoveredEra, false);
        this.hoveredEra = i;
        this.setEraHover(i, true);
        this.fillTooltip(formatPlainYear(e.year), e.label, x, this.layout.laneAreaTop);
    }
    showEventTooltip(ev, x, anchorY) {
        if (this.hoveredEvent !== null && this.hoveredEvent !== ev.id)
            this.setEventHover(this.hoveredEvent, false);
        this.hoveredEvent = ev.id;
        this.setEventHover(ev.id, true);
        const viewportY = Math.max(this.layout.laneAreaTop, anchorY - this.scrollY);
        this.fillTooltip(formatYearRange(ev.year, ev.endYear), ev.description ? `${ev.title} — ${ev.description}` : ev.title, x, viewportY);
    }
    fillTooltip(year, label, x, anchorY) {
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
        this.tooltip.classList.remove('down');
        this.tooltip.style.left = `${x}px`;
        this.tooltip.style.top = `${anchorY}px`;
        this.tooltip.style.display = '';
        const h = this.tooltip.offsetHeight;
        if (h > 0 && anchorY - h - 10 < 0)
            this.tooltip.classList.add('down');
    }
    hideTooltip() {
        this.tooltip.style.display = 'none';
        if (this.hoveredEra !== null) {
            this.setEraHover(this.hoveredEra, false);
            this.hoveredEra = null;
        }
        if (this.hoveredEvent !== null) {
            this.setEventHover(this.hoveredEvent, false);
            this.hoveredEvent = null;
        }
    }
    localX(ev) {
        return ev.clientX - this.svg.getBoundingClientRect().left;
    }
    activateEra(i) {
        const e = this.eras[i];
        if (!e)
            return;
        this.setYear(e.year, { animate: true });
        this.emit('eraSelect', e);
    }
    activateEvent(ev) {
        if (this.opts.seekOnEventClick)
            this.setYear(ev.year, { animate: true });
        this.emit('eventSelect', ev);
    }
    animateCursorTo(target) {
        if (this.cursorRaf)
            cancelAnimationFrame(this.cursorRaf);
        const start = this.cursorYear;
        const dur = 320;
        const ease = (t) => 1 - Math.pow(1 - t, 4);
        let t0 = null;
        const step = (now) => {
            if (t0 === null)
                t0 = now;
            const t = Math.min(1, (now - t0) / dur);
            this.cursorYear = start + (target - start) * ease(t);
            this.renderCursor();
            if (t < 1)
                this.cursorRaf = requestAnimationFrame(step);
            else
                this.cursorRaf = undefined;
        };
        this.cursorRaf = requestAnimationFrame(step);
    }
    play(opts = {}) {
        var _a, _b, _c;
        if (this.playRaf)
            cancelAnimationFrame(this.playRaf);
        this.playOpts = {
            yearsPerSecond: (_a = opts.yearsPerSecond) !== null && _a !== void 0 ? _a : 5,
            to: (_b = opts.to) !== null && _b !== void 0 ? _b : Number.POSITIVE_INFINITY,
            loop: (_c = opts.loop) !== null && _c !== void 0 ? _c : false,
        };
        const startYear = this.cursorYear;
        this.playLast = 0;
        this.emit('play', undefined);
        const step = (now) => {
            if (!this.playOpts)
                return;
            if (!this.playLast)
                this.playLast = now;
            const dt = (now - this.playLast) / 1000;
            this.playLast = now;
            let next = this.cursorYear + this.playOpts.yearsPerSecond * dt;
            if (next >= this.playOpts.to) {
                if (this.playOpts.loop) {
                    next = startYear;
                }
                else {
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
    pause() {
        if (this.playRaf)
            cancelAnimationFrame(this.playRaf);
        this.playRaf = undefined;
        if (this.playOpts) {
            this.playOpts = null;
            this.emit('pause', undefined);
        }
    }
    get isPlaying() {
        return this.playRaf !== undefined;
    }
    keepCursorInView() {
        const span = this.viewEnd - this.viewStart;
        const margin = span * 0.15;
        if (this.cursorYear > this.viewEnd - margin) {
            const shift = this.cursorYear - (this.viewEnd - margin);
            this.setView_(this.viewStart + shift, this.viewEnd + shift);
            this.recompute();
        }
        else if (this.cursorYear < this.viewStart + margin) {
            const shift = this.viewStart + margin - this.cursorYear;
            this.setView_(this.viewStart - shift, this.viewEnd - shift);
            this.recompute();
        }
    }
    setYear(year, opts = {}) {
        var _a;
        const target = numericYear(year);
        const animate = (_a = opts.animate) !== null && _a !== void 0 ? _a : this.opts.animate;
        if (animate && Math.abs(target - this.cursorYear) > 0.0001) {
            this.animateCursorTo(target);
        }
        else {
            this.cursorYear = target;
            this.renderCursor();
        }
        if (!opts.silent)
            this.emit('yearChange', target);
    }
    getYear() {
        return this.cursorYear;
    }
    setView(start, end) {
        this.setView_(start, end);
        this.recompute();
    }
    getView() {
        return { start: this.viewStart, end: this.viewEnd };
    }
    centerOn(year, span = this.viewEnd - this.viewStart) {
        this.setView_(year - span / 2, year + span / 2);
        this.recompute();
    }
    setEvents(events) {
        this.events = events.slice();
        this.recompute();
    }
    getEvents() {
        return this.events.slice();
    }
    setEras(eras) {
        this.eras = eras.slice();
        this.renderEras();
    }
    setGroups(groups) {
        this.groups = groups.slice();
        this.recompute();
    }
    getGroups() {
        return this.groups.slice();
    }
    setTheme(theme) {
        for (const key of Object.keys(theme)) {
            const value = theme[key];
            if (value !== undefined)
                this.root.style.setProperty(THEME_VARS[key], value);
        }
    }
    setMaxHeight(h) {
        this.opts.maxHeight = h;
        this.recompute();
    }
    scrollTo(y) {
        this.setScroll(y);
    }
    resize() {
        if (this.destroyed)
            return;
        this.measure();
        this.recompute();
    }
    on(name, listener) {
        var _a;
        var _b;
        ((_a = (_b = this.listeners)[name]) !== null && _a !== void 0 ? _a : (_b[name] = new Set())).add(listener);
        return () => this.off(name, listener);
    }
    off(name, listener) {
        var _a;
        (_a = this.listeners[name]) === null || _a === void 0 ? void 0 : _a.delete(listener);
    }
    emit(name, payload) {
        var _a;
        (_a = this.listeners[name]) === null || _a === void 0 ? void 0 : _a.forEach((l) => l(payload));
    }
    destroy() {
        var _a;
        this.destroyed = true;
        this.pause();
        if (this.cursorRaf)
            cancelAnimationFrame(this.cursorRaf);
        (_a = this.resizeObs) === null || _a === void 0 ? void 0 : _a.disconnect();
        this.svg.removeEventListener('pointerdown', this.onPointerDown);
        this.svg.removeEventListener('pointermove', this.onPointerMove);
        this.svg.removeEventListener('pointerup', this.onPointerUp);
        this.svg.removeEventListener('pointercancel', this.onPointerUp);
        this.svg.removeEventListener('wheel', this.onWheel);
        this.listeners = {};
        this.root.classList.remove('timelin-root');
        this.root.style.height = '';
        this.root.innerHTML = '';
    }
}
function packYearSpace(events, maxSub, fixed) {
    const cap = fixed !== null && fixed !== void 0 ? fixed : maxSub;
    const sorted = [...events].sort((a, b) => a.year - b.year);
    const laneEnd = [];
    const assign = new Map();
    for (const e of sorted) {
        const start = e.year;
        const end = e.endYear !== undefined && e.endYear > e.year ? e.endYear : e.year;
        let lane = laneEnd.findIndex((le) => start >= le);
        if (lane === -1)
            lane = laneEnd.length < cap ? laneEnd.length : cap - 1;
        laneEnd[lane] = end;
        assign.set(e.id, lane);
    }
    const used = laneEnd.length === 0 ? 1 : laneEnd.length;
    const lanes = fixed !== null && fixed !== void 0 ? fixed : Math.min(used, maxSub);
    return { assign, lanes: Math.max(1, lanes) };
}
function truncate(s, maxChars) {
    return s.length > maxChars ? s.slice(0, Math.max(1, maxChars - 1)) + '…' : s;
}
function svgGroup(cls) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', cls);
    return g;
}
function svgEl(tag, attrs, text) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const k in attrs)
        el.setAttribute(k, String(attrs[k]));
    if (text !== undefined)
        el.textContent = text;
    return el;
}
function clear(node) {
    while (node.firstChild)
        node.removeChild(node.firstChild);
}
export function injectStyles() {
    if (typeof document === 'undefined')
        return;
    if (document.getElementById(STYLE_ELEMENT_ID))
        return;
    const style = document.createElement('style');
    style.id = STYLE_ELEMENT_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}
