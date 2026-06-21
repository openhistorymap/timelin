# @openhistorymap/timeline-core

Framework-agnostic, deep-time interactive timeline — the engine behind
[timel.in](https://timel.in). Zero runtime dependencies. Renders an SVG ruler
whose axis is a continuous **decimal-year** scale (BCE → CE on one line), with
an event band, curated era markers, a weighted brass cursor, and playback.

```bash
npm i @openhistorymap/timeline-core
```

```ts
import { Timeline } from '@openhistorymap/timeline-core';

const tl = new Timeline(host, { year: 1492, events });
tl.on('yearChange', (y) => /* ... */);
```

See the [monorepo README](https://github.com/openhistorymap/timel.in) for the
full guide and the React/Angular bindings. Two dependency-free adapters ship on
subpaths:

- `@openhistorymap/timeline-core/wikidata` — SPARQL → `TimelineEvent[]`.
- `@openhistorymap/timeline-core/vis` — convert to/from the
  [vis-timeline](https://github.com/visjs/vis-timeline) item format
  (`fromVisItems` / `toVisItems`), so existing vis data drops in.

## API surface

| | |
| --- | --- |
| `new Timeline(host, options)` | Construct into any element (it sizes to the host). |
| `.setYear(year, { animate, silent })` / `.getYear()` | Move / read the cursor. |
| `.setView(start, end)` / `.getView()` / `.centerOn(year, span?)` | Control the visible range. |
| `.setEvents(events)` / `.setEras(eras)` | Replace data. |
| `.play({ yearsPerSecond, to, loop })` / `.pause()` / `.isPlaying` | Playback. |
| `.setTheme(theme)` | Override design tokens at runtime. |
| `.resize()` | Re-measure after a host resize (also automatic via `ResizeObserver`). |
| `.on(name, fn)` / `.off(name, fn)` | Events: `yearChange`, `rangeChange`, `eraSelect`, `eventSelect`, `play`, `pause`. |
| `.destroy()` | Tear down listeners, observers, animations, DOM. |

Also exported: `DEFAULT_ERAS`, `TIMELINE_CSS`, and the time helpers
`formatYear`, `formatPlainYear`, `formatYearRange`, `numericYear`,
`decimalToDate`, `dateToDecimal`, `niceDate`.

## License

MIT © OpenHistoryMap / Marco Montanari
