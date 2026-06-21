export const PERIODO_DATASET_URL = 'https://data.perio.do/d.json';
const GROUP_PALETTE = [
    'oklch(0.74 0.115 78)',
    'oklch(0.70 0.11 210)',
    'oklch(0.72 0.12 150)',
    'oklch(0.70 0.12 30)',
    'oklch(0.72 0.10 320)',
    'oklch(0.74 0.10 110)',
    'oklch(0.70 0.11 260)',
    'oklch(0.72 0.12 60)',
];
export function parsePeriodoYear(value, shiftBce = true) {
    if (value == null)
        return null;
    const m = /^\s*(-?\d+)/.exec(String(value));
    if (!m)
        return null;
    const n = parseInt(m[1], 10);
    if (Number.isNaN(n))
        return null;
    return shiftBce && n <= 0 ? n - 1 : n;
}
function terminusYear(b, prefer, shift) {
    const t = b === null || b === void 0 ? void 0 : b.in;
    if (!t)
        return null;
    const order = prefer === 'early' ? [t.year, t.earliestYear, t.latestYear] : [t.year, t.latestYear, t.earliestYear];
    for (const v of order) {
        const y = parsePeriodoYear(v, shift);
        if (y !== null)
            return y;
    }
    return null;
}
function pickLabel(p, lang) {
    var _a, _b;
    const loc = p.localizedLabels;
    if (loc && loc[lang] && loc[lang].length)
        return loc[lang][0];
    if (p.label)
        return p.label;
    if (loc) {
        for (const k of Object.keys(loc))
            if ((_a = loc[k]) === null || _a === void 0 ? void 0 : _a.length)
                return loc[k][0];
    }
    return (_b = p.id) !== null && _b !== void 0 ? _b : 'period';
}
function sourceTitle(a) {
    var _a, _b, _c, _d, _e, _f;
    return (_f = (_e = (_b = (_a = a.source) === null || _a === void 0 ? void 0 : _a.title) !== null && _b !== void 0 ? _b : (_d = (_c = a.source) === null || _c === void 0 ? void 0 : _c.partOf) === null || _d === void 0 ? void 0 : _d.title) !== null && _e !== void 0 ? _e : a.id) !== null && _f !== void 0 ? _f : 'source';
}
function coverageLabel(p) {
    var _a, _b;
    if (p.spatialCoverageDescription)
        return p.spatialCoverageDescription;
    const first = (_b = (_a = p.spatialCoverage) === null || _a === void 0 ? void 0 : _a.find((s) => s.label)) === null || _b === void 0 ? void 0 : _b.label;
    return first !== null && first !== void 0 ? first : 'Unspecified';
}
export function periodToEvent(period, authority, opts = {}) {
    var _a, _b, _c, _d;
    const shift = opts.shiftBce !== false;
    const lang = (_a = opts.language) !== null && _a !== void 0 ? _a : 'en';
    const start = terminusYear(period.start, 'early', shift);
    const stop = terminusYear(period.stop, 'late', shift);
    if (start === null && stop === null)
        return null;
    const year = start !== null && start !== void 0 ? start : stop;
    const end = start !== null && stop !== null && stop > start ? stop : undefined;
    const group = opts.groupBy === 'authority'
        ? authority
            ? sourceTitle(authority)
            : undefined
        : opts.groupBy === 'none'
            ? undefined
            : coverageLabel(period);
    const cov = period.spatialCoverageDescription;
    const src = authority ? sourceTitle(authority) : undefined;
    const yr = (_b = authority === null || authority === void 0 ? void 0 : authority.source) === null || _b === void 0 ? void 0 : _b.yearPublished;
    const description = [cov, src && (yr ? `${src} (${yr})` : src)].filter(Boolean).join(' · ') || undefined;
    const base = (_c = opts.uriBase) !== null && _c !== void 0 ? _c : 'https://n2t.net/ark:/99152/';
    return {
        id: (_d = period.id) !== null && _d !== void 0 ? _d : pickLabel(period, lang),
        year,
        endYear: end,
        title: pickLabel(period, lang),
        description,
        group,
        url: period.id ? base + period.id : undefined,
        data: period,
    };
}
export function fromPeriodoDataset(dataset, opts = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const authorities = (_b = (_a = dataset.authorities) !== null && _a !== void 0 ? _a : dataset.periodCollections) !== null && _b !== void 0 ? _b : {};
    const filter = (_c = opts.spatialCoverage) === null || _c === void 0 ? void 0 : _c.toLowerCase();
    const events = [];
    outer: for (const aId of Object.keys(authorities)) {
        const authority = authorities[aId];
        const periods = (_e = (_d = authority.periods) !== null && _d !== void 0 ? _d : authority.definitions) !== null && _e !== void 0 ? _e : {};
        for (const pId of Object.keys(periods)) {
            const ev = periodToEvent(periods[pId], authority, opts);
            if (!ev)
                continue;
            if (filter) {
                const p = periods[pId];
                const hay = [
                    (_f = p.spatialCoverageDescription) !== null && _f !== void 0 ? _f : '',
                    ...((_g = p.spatialCoverage) !== null && _g !== void 0 ? _g : []).map((s) => { var _a; return (_a = s.label) !== null && _a !== void 0 ? _a : ''; }),
                ]
                    .join(' ')
                    .toLowerCase();
                if (!hay.includes(filter))
                    continue;
            }
            if (opts.fromYear !== undefined || opts.toYear !== undefined) {
                const lo = (_h = opts.fromYear) !== null && _h !== void 0 ? _h : -Infinity;
                const hi = (_j = opts.toYear) !== null && _j !== void 0 ? _j : Infinity;
                const evEnd = (_k = ev.endYear) !== null && _k !== void 0 ? _k : ev.year;
                if (evEnd < lo || ev.year > hi)
                    continue;
            }
            events.push(ev);
            if (opts.limit !== undefined && events.length >= opts.limit)
                break outer;
        }
    }
    const groups = opts.groupBy === 'none' ? [] : deriveGroups(events, opts.colorGroups !== false);
    return { events, groups };
}
function deriveGroups(events, colorize) {
    const labels = [...new Set(events.map((e) => e.group).filter((g) => !!g))].sort((a, b) => a.localeCompare(b));
    return labels.map((label, i) => ({
        id: label,
        label,
        order: i,
        color: colorize ? GROUP_PALETTE[i % GROUP_PALETTE.length] : undefined,
    }));
}
export async function fetchPeriodo(opts = {}) {
    var _a;
    const url = (_a = opts.url) !== null && _a !== void 0 ? _a : PERIODO_DATASET_URL;
    const res = await fetch(url, { signal: opts.signal });
    if (!res.ok)
        throw new Error(`PeriodO fetch failed: ${res.status} ${res.statusText}`);
    const dataset = (await res.json());
    return fromPeriodoDataset(dataset, opts);
}
