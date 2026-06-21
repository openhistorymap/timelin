import { partsToDecimalYear } from './time.js';
export const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';
export function parseWikidataYear(iso) {
    if (!iso)
        return null;
    const m = /^([+-]?)(\d+)-(\d{2})-(\d{2})/.exec(iso.trim());
    if (!m)
        return null;
    const sign = m[1] === '-' ? -1 : 1;
    const year = parseInt(m[2], 10);
    const month = parseInt(m[3], 10);
    const day = parseInt(m[4], 10);
    return partsToDecimalYear(sign, year, month, day);
}
export function mapWikidataBindings(bindings, mapping = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    const idVar = (_a = mapping.id) !== null && _a !== void 0 ? _a : 'item';
    const titleVar = (_b = mapping.title) !== null && _b !== void 0 ? _b : 'itemLabel';
    const dateVar = (_c = mapping.date) !== null && _c !== void 0 ? _c : 'date';
    const endVar = (_d = mapping.endDate) !== null && _d !== void 0 ? _d : 'endDate';
    const descVar = (_e = mapping.description) !== null && _e !== void 0 ? _e : 'itemDescription';
    const out = [];
    for (const b of bindings) {
        const year = parseWikidataYear((_f = b[dateVar]) === null || _f === void 0 ? void 0 : _f.value);
        if (year === null)
            continue;
        const uri = (_h = (_g = b[idVar]) === null || _g === void 0 ? void 0 : _g.value) !== null && _h !== void 0 ? _h : '';
        const qid = uri.split('/').pop() || uri || `${out.length}`;
        const endYear = parseWikidataYear((_j = b[endVar]) === null || _j === void 0 ? void 0 : _j.value);
        out.push({
            id: qid,
            year,
            endYear: endYear !== null && endYear > year ? endYear : undefined,
            title: (_l = (_k = b[titleVar]) === null || _k === void 0 ? void 0 : _k.value) !== null && _l !== void 0 ? _l : qid,
            description: (_m = b[descVar]) === null || _m === void 0 ? void 0 : _m.value,
            url: uri || undefined,
            data: b,
        });
    }
    return out;
}
export function buildEventsQuery(opts = {}) {
    var _a, _b, _c;
    const cls = (_a = opts.classQid) !== null && _a !== void 0 ? _a : 'Q1190554';
    const lang = (_b = opts.language) !== null && _b !== void 0 ? _b : 'en';
    const limit = (_c = opts.limit) !== null && _c !== void 0 ? _c : 500;
    const from = opts.fromYear !== undefined ? isoYear(opts.fromYear) : undefined;
    const to = opts.toYear !== undefined ? isoYear(opts.toYear + 1) : undefined;
    const dateFilter = from && to ? `  FILTER(?date >= "${from}"^^xsd:dateTime && ?date < "${to}"^^xsd:dateTime)` : '';
    return `SELECT ?item ?itemLabel ?itemDescription ?date ?endDate WHERE {
  ?item wdt:P31/wdt:P279* wd:${cls} .
  ?item wdt:P585 ?date .
  OPTIONAL { ?item wdt:P582 ?endDate . }
${dateFilter}
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${lang}". }
}
ORDER BY ?date
LIMIT ${limit}`;
}
function isoYear(year) {
    const sign = year < 0 ? '-' : '+';
    const abs = Math.abs(year).toString().padStart(4, '0');
    return `${sign}${abs}-01-01T00:00:00Z`;
}
export async function fetchWikidataEvents(opts = {}) {
    var _a, _b, _c, _d;
    const endpoint = (_a = opts.endpoint) !== null && _a !== void 0 ? _a : WIKIDATA_ENDPOINT;
    const query = (_b = opts.sparql) !== null && _b !== void 0 ? _b : buildEventsQuery(opts);
    const url = `${endpoint}?query=${encodeURIComponent(query)}&format=json`;
    const res = await fetch(url, {
        headers: { Accept: 'application/sparql-results+json' },
        signal: opts.signal,
    });
    if (!res.ok) {
        throw new Error(`Wikidata query failed: ${res.status} ${res.statusText}`);
    }
    const json = (await res.json());
    return mapWikidataBindings((_d = (_c = json.results) === null || _c === void 0 ? void 0 : _c.bindings) !== null && _d !== void 0 ? _d : [], opts.mapping);
}
