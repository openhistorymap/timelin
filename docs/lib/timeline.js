import { formatPlainYear, formatYear, formatYearRange, numericYear } from './time.js';
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
export class Timeline {
    constructor(host, options = {}) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        this.width = 1000;
        this.height = 120;
        this.viewStart = 766;
        this.viewEnd = 966;
        this.cursorYear = 866;
        this.cursorX = 0;
        this.placed = [];
        this.hoveredEra = null;
        this.hoveredEvent = null;
        this.dragging = false;
        this.dragStartX = 0;
        this.dragStartView = [0, 0];
        this.dragMoved = false;
        this.playLast = 0;
        this.playOpts = null;
        this.listeners = {};
        this.destroyed = false;
        this.onPointerDown = (ev) => {
            var _a, _b;
            (_b = (_a = ev.currentTarget).setPointerCapture) === null || _b === void 0 ? void 0 : _b.call(_a, ev.pointerId);
            this.dragging = true;
            this.dragMoved = false;
            this.dragStartX = ev.clientX;
            this.dragStartView = [this.viewStart, this.viewEnd];
        };
        this.onPointerMove = (ev) => {
            if (!this.dragging)
                return;
            const dx = ev.clientX - this.dragStartX;
            if (Math.abs(dx) > 3)
                this.dragMoved = true;
            const span = this.dragStartView[1] - this.dragStartView[0];
            const dy = (-dx / this.width) * span;
            this.viewStart = this.dragStartView[0] + dy;
            this.viewEnd = this.dragStartView[1] + dy;
            this.recompute();
        };
        this.onPointerUp = (ev) => {
            if (!this.dragging)
                return;
            this.dragging = false;
            if (!this.dragMoved) {
                const rect = this.svg.getBoundingClientRect();
                const y = this.yearAt(ev.clientX - rect.left);
                this.cursorYear = y;
                this.renderCursor();
                this.emit('yearChange', y);
            }
        };
        this.onWheel = (ev) => {
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
        this.root = host;
        this.opts = {
            year: (_a = options.year) !== null && _a !== void 0 ? _a : 866,
            viewSpan: (_b = options.viewSpan) !== null && _b !== void 0 ? _b : 240,
            eras: (_c = options.eras) !== null && _c !== void 0 ? _c : DEFAULT_ERAS,
            events: (_d = options.events) !== null && _d !== void 0 ? _d : [],
            minSpan: (_e = options.minSpan) !== null && _e !== void 0 ? _e : 20,
            maxSpan: (_f = options.maxSpan) !== null && _f !== void 0 ? _f : 20000,
            injectStyles: (_g = options.injectStyles) !== null && _g !== void 0 ? _g : true,
            animate: (_h = options.animate) !== null && _h !== void 0 ? _h : true,
            seekOnEventClick: (_j = options.seekOnEventClick) !== null && _j !== void 0 ? _j : true,
            theme: options.theme,
        };
        this.eras = this.opts.eras.slice();
        this.events = this.opts.events.slice();
        this.cursorYear = numericYear(this.opts.year);
        if (this.opts.injectStyles)
            injectStyles();
        this.buildDom();
        if (this.opts.theme)
            this.setTheme(this.opts.theme);
        const initialView = options.view;
        this.measure();
        if (initialView) {
            this.viewStart = initialView.start;
            this.viewEnd = initialView.end;
        }
        else {
            this.centerOn(this.cursorYear, this.opts.viewSpan);
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
        this.svg.addEventListener('pointerdown', this.onPointerDown);
        this.svg.addEventListener('pointermove', this.onPointerMove);
        this.svg.addEventListener('pointerup', this.onPointerUp);
        this.svg.addEventListener('pointercancel', this.onPointerUp);
        this.svg.addEventListener('wheel', this.onWheel, { passive: false });
    }
    measure() {
        this.width = this.root.clientWidth || 1000;
        this.height = Math.max(96, this.root.clientHeight || 120);
        this.svg.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);
        this.svg.setAttribute('width', String(this.width));
        this.svg.setAttribute('height', String(this.height));
    }
    xFor(year) {
        const span = this.viewEnd - this.viewStart;
        return ((year - this.viewStart) / span) * this.width;
    }
    yearAt(px) {
        const span = this.viewEnd - this.viewStart;
        return this.viewStart + (px / this.width) * span;
    }
    get bands() {
        const labelY = 36;
        const eventsTop = 46;
        const eventsBottom = this.height - 22;
        const lanePitch = 17;
        const maxLanes = Math.max(1, Math.floor((eventsBottom - eventsTop) / lanePitch));
        return { labelY, eventsTop, eventsBottom, lanePitch, maxLanes };
    }
    recompute() {
        if (this.destroyed)
            return;
        this.renderTicks();
        this.renderEras();
        this.renderEvents();
        this.renderCursor();
        this.emit('rangeChange', { start: this.viewStart, end: this.viewEnd });
    }
    renderTicks() {
        const span = this.viewEnd - this.viewStart;
        const pxPerYear = this.width / span;
        let minor;
        let major;
        if (pxPerYear >= 12) {
            minor = 1;
            major = 10;
        }
        else if (pxPerYear >= 1.2) {
            minor = 10;
            major = 100;
        }
        else if (pxPerYear >= 0.12) {
            minor = 100;
            major = 1000;
        }
        else {
            minor = 1000;
            major = 5000;
        }
        const ticks = [];
        const startTick = Math.ceil(this.viewStart / minor) * minor;
        for (let y = startTick; y <= this.viewEnd; y += minor) {
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
            this.gTicks.append(svgEl('line', {
                x1: t.x,
                x2: t.x,
                y1: t.major ? 0 : 6,
                y2: t.major ? 22 : 14,
                class: t.major ? 'timelin-tick major' : 'timelin-tick minor',
                'shape-rendering': 'crispEdges',
            }));
            if (t.label !== undefined) {
                this.gLabels.append(svgEl('text', {
                    x: t.x,
                    y: this.bands.labelY,
                    class: 'timelin-year-label' + (t.year === 0 ? ' epoch' : ''),
                    'text-anchor': 'middle',
                }, t.label));
            }
        }
    }
    renderEras() {
        clear(this.gEras);
        const { eventsTop } = this.bands;
        const lineBottom = this.height - 6;
        this.eras.forEach((e, i) => {
            if (e.year < this.viewStart || e.year > this.viewEnd)
                return;
            const x = this.xFor(e.year);
            const hovered = this.hoveredEra === i;
            this.gEras.append(svgEl('line', {
                x1: x,
                x2: x,
                y1: eventsTop,
                y2: lineBottom,
                class: 'timelin-era-line' + (hovered ? ' is-hovered' : ''),
            }), svgEl('circle', {
                cx: x,
                cy: eventsTop,
                r: 2,
                class: 'timelin-era-dot' + (hovered ? ' is-hovered' : ''),
            }));
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
    renderEvents() {
        clear(this.gEvents);
        if (!this.events.length) {
            this.placed = [];
            return;
        }
        const { eventsTop, eventsBottom, lanePitch, maxLanes } = this.bands;
        const MIN_W = 6;
        const visible = this.events
            .filter((e) => {
            const end = e.endYear !== undefined ? Math.max(e.endYear, e.year) : e.year;
            return end >= this.viewStart && e.year <= this.viewEnd;
        })
            .sort((a, b) => a.year - b.year);
        const laneLastX = [];
        const placed = [];
        for (const ev of visible) {
            const isSpan = ev.endYear !== undefined && ev.endYear > ev.year;
            let x0 = this.xFor(ev.year);
            let x1 = isSpan ? this.xFor(ev.endYear) : x0 + MIN_W;
            if (x1 - x0 < MIN_W)
                x1 = x0 + MIN_W;
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
            }
            else {
                const dot = svgEl('circle', {
                    cx,
                    cy: y + laneH / 2,
                    r: hovered ? 4 : 3,
                    class: 'timelin-event-dot' + (hovered ? ' is-hovered' : ''),
                });
                if (p.ev.color)
                    dot.style.fill = p.ev.color;
                this.gEvents.append(dot);
            }
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
    renderCursor() {
        clear(this.gCursor);
        this.cursorX = this.xFor(this.cursorYear);
        this.readoutPlain.textContent = formatPlainYear(this.cursorYear);
        const offLeft = this.cursorX < 0;
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
            }), svgEl('polygon', {
                class: 'timelin-cursor-cap',
                points: `${x - 4},0 ${x + 4},0 ${x},8`,
            }), svgEl('polygon', {
                class: 'timelin-cursor-base',
                points: `${x - 4},${this.height} ${x + 4},${this.height} ${x},${this.height - 8}`,
            }));
            this.readout.style.display = '';
            this.readout.style.transform = `translateX(${x}px)`;
        }
        else {
            this.readout.style.display = 'none';
            if (offLeft) {
                this.gCursor.append(svgEl('polygon', { class: 'timelin-cursor-cap', points: '2,28 12,22 12,34' }));
            }
            else {
                this.gCursor.append(svgEl('polygon', {
                    class: 'timelin-cursor-cap',
                    points: `${this.width - 2},28 ${this.width - 12},22 ${this.width - 12},34`,
                }));
            }
        }
    }
    showEraTooltip(i, x) {
        const e = this.eras[i];
        if (!e)
            return;
        this.hoveredEra = i;
        this.renderEras();
        this.fillTooltip(formatPlainYear(e.year), e.label, x);
    }
    showEventTooltip(p, y) {
        this.hoveredEvent = p.ev.id;
        this.renderEvents();
        const x = (Math.max(0, p.x0) + Math.min(this.width, p.x1)) / 2;
        this.fillTooltip(formatYearRange(p.ev.year, p.ev.endYear), p.ev.description ? `${p.ev.title} — ${p.ev.description}` : p.ev.title, x, y);
    }
    fillTooltip(year, label, x, anchorY = this.bands.eventsTop) {
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
    hideTooltip() {
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
            if (t < 1) {
                this.cursorRaf = requestAnimationFrame(step);
            }
            else {
                this.cursorRaf = undefined;
            }
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
            this.viewStart += shift;
            this.viewEnd += shift;
            this.recompute();
        }
        else if (this.cursorYear < this.viewStart + margin) {
            const shift = this.viewStart + margin - this.cursorYear;
            this.viewStart -= shift;
            this.viewEnd -= shift;
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
        this.viewStart = start;
        this.viewEnd = end;
        this.recompute();
    }
    getView() {
        return { start: this.viewStart, end: this.viewEnd };
    }
    centerOn(year, span = this.viewEnd - this.viewStart) {
        this.viewStart = year - span / 2;
        this.viewEnd = year + span / 2;
        this.recompute();
    }
    setEvents(events) {
        this.events = events.slice();
        this.renderEvents();
    }
    getEvents() {
        return this.events.slice();
    }
    setEras(eras) {
        this.eras = eras.slice();
        this.renderEras();
    }
    setTheme(theme) {
        for (const key of Object.keys(theme)) {
            const value = theme[key];
            if (value !== undefined)
                this.root.style.setProperty(THEME_VARS[key], value);
        }
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
        this.root.innerHTML = '';
    }
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
