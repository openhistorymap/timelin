const DAYS_PER_MONTH = 31;
export function numericYear(v) {
    if (v === null || v === undefined)
        return 0;
    const n = typeof v === 'string' ? parseFloat(v) : v;
    return Number.isNaN(n) ? 0 : n;
}
export function formatYear(y) {
    const yr = Math.trunc(y);
    if (yr === 0)
        return '0';
    return yr > 0 ? `${yr}` : `${Math.abs(yr)} BCE`;
}
export function formatPlainYear(y) {
    const yr = Math.trunc(y);
    if (yr === 0)
        return '0';
    return yr >= 0 ? `${yr} CE` : `${Math.abs(yr)} BCE`;
}
export function formatYearRange(start, end) {
    if (end === undefined || Math.trunc(end) === Math.trunc(start)) {
        return formatPlainYear(start);
    }
    const a = Math.trunc(start);
    const b = Math.trunc(end);
    if ((a >= 0 && b >= 0) || (a < 0 && b < 0)) {
        return `${Math.abs(a)}–${formatPlainYear(b)}`;
    }
    return `${formatPlainYear(start)} – ${formatPlainYear(end)}`;
}
export function decimalToDate(value) {
    const y = Math.trunc(value);
    let rest = Math.abs(value - y);
    const m = Math.trunc(rest * 12);
    rest = rest * 12 - m;
    const d = Math.trunc(rest * DAYS_PER_MONTH);
    rest = rest * DAYS_PER_MONTH - d;
    const H = Math.trunc(rest * 24);
    rest = rest * 24 - H;
    const M = Math.trunc(rest * 60);
    rest = rest * 60 - M;
    const S = Math.trunc(rest * 60);
    rest = rest * 60 - S;
    const ret = new Date();
    ret.setFullYear(y);
    ret.setMonth(m);
    ret.setDate(d);
    ret.setHours(H);
    ret.setMinutes(M);
    ret.setSeconds(S);
    ret.setMilliseconds(rest);
    return ret;
}
export function dateToDecimal(date) {
    let ret = date.getFullYear();
    ret += (date.getMonth() + 1) / 12;
    ret += date.getDate() * (1 / 12 / DAYS_PER_MONTH);
    ret += date.getHours() * (1 / 12 / DAYS_PER_MONTH / 24);
    ret += date.getMinutes() * (1 / 12 / DAYS_PER_MONTH / 24 / 60);
    ret += date.getSeconds() * (1 / 12 / DAYS_PER_MONTH / 24 / 60 / 60);
    return ret;
}
export function niceDate(value) {
    if (!value)
        return '';
    return value.replace('AD', 'CE').replace('BC', 'BCE');
}
export function partsToDecimalYear(sign, year, month, day) {
    let frac = 0;
    if (month > 0)
        frac += (month - 1) / 12;
    if (day > 0)
        frac += (day - 1) / (12 * 31);
    return sign * year + frac;
}
export function calendarDecimal(date) {
    const y = date.getUTCFullYear();
    const startOfYear = new Date(0);
    startOfYear.setUTCFullYear(y, 0, 1);
    startOfYear.setUTCHours(0, 0, 0, 0);
    const startOfNext = new Date(0);
    startOfNext.setUTCFullYear(y + 1, 0, 1);
    startOfNext.setUTCHours(0, 0, 0, 0);
    const span = startOfNext.getTime() - startOfYear.getTime();
    return y + (date.getTime() - startOfYear.getTime()) / span;
}
export function decimalToCalendarDate(year) {
    const y = Math.floor(year);
    const frac = year - y;
    const startOfYear = new Date(0);
    startOfYear.setUTCFullYear(y, 0, 1);
    startOfYear.setUTCHours(0, 0, 0, 0);
    const startOfNext = new Date(0);
    startOfNext.setUTCFullYear(y + 1, 0, 1);
    startOfNext.setUTCHours(0, 0, 0, 0);
    const span = startOfNext.getTime() - startOfYear.getTime();
    return new Date(startOfYear.getTime() + frac * span);
}
