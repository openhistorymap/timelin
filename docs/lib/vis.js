import { calendarDecimal, decimalToCalendarDate, partsToDecimalYear, } from './time.js';
function isDataSet(x) {
    return (!!x &&
        !Array.isArray(x) &&
        typeof x.get === 'function');
}
export function decodeVisTime(value) {
    if (value === undefined || value === null)
        return null;
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : calendarDecimal(value);
    }
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    if (typeof value === 'string') {
        const s = value.trim();
        if (/^[+-]?\d+(\.\d+)?$/.test(s))
            return parseFloat(s);
        const iso = /^([+-]?)(\d{1,7})-(\d{2})-(\d{2})/.exec(s);
        if (iso) {
            const sign = iso[1] === '-' ? -1 : 1;
            return partsToDecimalYear(sign, parseInt(iso[2], 10), parseInt(iso[3], 10), parseInt(iso[4], 10));
        }
        const t = Date.parse(s);
        return Number.isNaN(t) ? null : calendarDecimal(new Date(t));
    }
    const maybe = value;
    if (typeof maybe.toDate === 'function')
        return calendarDecimal(maybe.toDate());
    if (typeof maybe.valueOf === 'function') {
        const v = maybe.valueOf();
        if (typeof v === 'number' && Number.isFinite(v))
            return calendarDecimal(new Date(v));
    }
    return null;
}
export function encodeDecimalToVis(year) {
    return decimalToCalendarDate(year);
}
export function fromVisItem(item, opts = {}) {
    var _a;
    const decode = (_a = opts.decodeTime) !== null && _a !== void 0 ? _a : decodeVisTime;
    const year = decode(item.start);
    if (year === null)
        return null;
    const isPointType = item.type === 'point' || item.type === 'box';
    let endYear = !isPointType && item.end != null ? decode(item.end) : null;
    if (endYear !== null && endYear <= year)
        endYear = null;
    const strip = opts.stripHtml !== false;
    const title = cleanText(item.content, strip) || (item.id != null ? String(item.id) : '');
    const description = item.title ? cleanText(item.title, strip) : undefined;
    const color = opts.colorFromStyle !== false && item.style ? parseColor(item.style) : undefined;
    return {
        id: item.id != null ? String(item.id) : title,
        year,
        endYear: endYear !== null && endYear !== void 0 ? endYear : undefined,
        title,
        description,
        color,
        url: typeof item['url'] === 'string' ? item['url'] : undefined,
        data: item,
    };
}
export function fromVisItems(items, opts = {}) {
    const arr = isDataSet(items) ? items.get() : items;
    const out = [];
    arr.forEach((it, i) => {
        const ev = fromVisItem(it, opts);
        if (!ev)
            return;
        if (!ev.id)
            ev.id = `vis-${i}`;
        out.push(ev);
    });
    return out;
}
export function toVisItem(event, opts = {}) {
    var _a, _b;
    const encode = (_a = opts.encodeTime) !== null && _a !== void 0 ? _a : encodeDecimalToVis;
    const isSpan = event.endYear !== undefined && event.endYear > event.year;
    const type = typeof opts.type === 'function' ? opts.type(event) : (_b = opts.type) !== null && _b !== void 0 ? _b : (isSpan ? 'range' : 'point');
    const item = {
        id: event.id,
        content: event.title,
        start: encode(event.year),
        type,
    };
    if (isSpan)
        item.end = encode(event.endYear);
    if (event.description)
        item.title = event.description;
    if (event.color)
        item.style = `background-color: ${event.color};`;
    if (event.url)
        item['url'] = event.url;
    return item;
}
export function toVisItems(events, opts = {}) {
    return events.map((e) => toVisItem(e, opts));
}
export function applyVisItems(timeline, items, opts = {}) {
    timeline.setEvents(fromVisItems(items, opts));
}
function cleanText(html, strip) {
    if (!html)
        return '';
    let s = html;
    if (strip)
        s = s.replace(/<[^>]*>/g, '');
    return s
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;|&apos;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function parseColor(style) {
    const bg = /background-color\s*:\s*([^;]+)/i.exec(style) || /background\s*:\s*([^;]+)/i.exec(style);
    if (bg)
        return bg[1].trim();
    const fg = /(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(style);
    return fg ? fg[1].trim() : undefined;
}
