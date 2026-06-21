# timel.in

**The [OpenHistoryMap](https://www.openhistorymap.org) timeline, extracted into a framework-agnostic library.**

An interactive, **deep-time** timeline: a single continuous axis from antiquity
(BCE) through the present, with an event band, curated era markers, a weighted
"now" cursor, and playback. Drag to pan, scroll to zoom, click to set the year.
Zero runtime dependencies in the core; thin official bindings for **React** and
**Angular**; works anywhere ES modules do (Vite, Webpack, plain `<script type=module>`).

It is the same timeline that anchors the OHM map viewer — lifted out of Angular
and Mapbox so it can be reused, most immediately for
[`ohm.openhistoryline.org`](https://openhistoryline.org), which draws an
interactive timeline of events sourced from Wikidata.

## Packages

| Package | Install | What it is |
| --- | --- | --- |
| [`@openhistorymap/timeline-core`](packages/core) | `npm i @openhistorymap/timeline-core` | Framework-agnostic engine (SVG renderer, deep-time model, playback). No deps. |
| [`@openhistorymap/timeline-react`](packages/react) | `npm i @openhistorymap/timeline-react` | `<Timeline/>` React component. |
| [`@openhistorymap/timeline-angular`](packages/angular) | `npm i @openhistorymap/timeline-angular` | `<timelin-timeline>` standalone Angular component. |

All three speak the same model: a point in time is a **decimal year** — a plain
number. `1492`, `-753` (754 BCE), `866.5` (mid-866 CE). This is what lets one
axis address all of history without bumping into the edges of the JS `Date` range.

## The model in 30 seconds

- **Year** — the cursor position, a decimal year.
- **Events** — `{ id, year, endYear?, title, ... }`. With `endYear` they render as
  spans (bars), without it as point markers. Lane-packed automatically.
- **Eras** — curated pivot points (the dashed verticals). Ships with OHM's set;
  override with your own.
- **View** — the visible `[start, end]` range. Pan/zoom changes it.

## Quick start — vanilla / Vite

```ts
import { Timeline } from '@openhistorymap/timeline-core';

const tl = new Timeline(document.getElementById('timeline')!, {
  year: 117,
  viewSpan: 400,
  events: [
    { id: 'trajan', year: 98, endYear: 117, title: 'Reign of Trajan' },
    { id: 'vesuvius', year: 79, title: 'Eruption of Vesuvius' },
  ],
});

tl.on('yearChange', (y) => console.log('now at', y));
tl.on('eventSelect', (e) => console.log('clicked', e.title));
tl.play({ yearsPerSecond: 8 }); // ...tl.pause()
```

The host element just needs a height (e.g. `height: 132px`). The component
injects its own stylesheet and looks right with no other CSS — the OHM
"library at night" palette — and is fully themeable (see below).

A runnable demo lives in [`examples/vite`](examples/vite): `npm run dev:demo`.

## React

```tsx
import { Timeline } from '@openhistorymap/timeline-react';

function App() {
  const [year, setYear] = useState(117);
  return (
    <Timeline
      style={{ width: '100%', height: 132 }}
      year={year}
      onYearChange={setYear}
      events={events}
      onEventSelect={(e) => open(e)}
    />
  );
}
```

Grab the imperative handle for playback:

```tsx
const ref = useRef<TimelineHandle>(null);
<Timeline ref={ref} ... />;
ref.current?.play({ yearsPerSecond: 8 });
```

## Angular

```ts
import { TimelinTimelineComponent } from '@openhistorymap/timeline-angular';

@Component({
  standalone: true,
  imports: [TimelinTimelineComponent],
  template: `
    <timelin-timeline
      [(year)]="year"
      [events]="events"
      (eventSelect)="open($event)">
    </timelin-timeline>
  `,
})
export class TimelinePanel {
  year = 117;
  events = [...];
}
```

`[(year)]` is a real two-way binding. The component runs the renderer outside
Angular's zone and only re-enters to emit outputs, so it won't thrash change
detection.

## Wikidata → events (for openhistoryline.org)

The core ships an optional, dependency-free adapter on a subpath. It builds a
SPARQL query, fetches from the Wikidata Query Service, and maps the results —
BCE dates and date precision included — straight to `TimelineEvent[]`:

```ts
import { fetchWikidataEvents } from '@openhistorymap/timeline-core/wikidata';

const events = await fetchWikidataEvents({
  classQid: 'Q178561', // e.g. "battle"
  fromYear: -100,
  toYear: 500,
  limit: 400,
});
tl.setEvents(events);
```

Or pass your own `sparql` string and a `mapping` describing which result columns
hold the id / title / date / end date. See [`examples/vite/src/main.ts`](examples/vite/src/main.ts)
for a live "Roman emperors" query.

## vis-timeline compatibility

The OHM map originally drove a [vis-timeline](https://github.com/visjs/vis-timeline)
`DataSet`, and lots of timeline data in the wild is in that shape. The core ships
an adapter on a subpath so vis items (or a live `DataSet`) drop straight in:

```ts
import { fromVisItems, toVisItems } from '@openhistorymap/timeline-core/vis';

// vis → timel.in
timeline.setEvents(fromVisItems(myVisDataSet)); // array or a vis DataSet both work

// timel.in → vis (e.g. to hand data to a real vis-timeline)
const visItems = toVisItems(timeline.getEvents());
```

Field mapping: vis `content`→`title` (HTML stripped), `title`(tooltip)→`description`,
`start`→`year`, `end`→`endYear`, `type` (`point`/`box` vs `range`/`background`)→
point/span, `style`→`color`. The original item is preserved on `event.data`.

Time decoding handles vis's `Date | number | string`, **including BCE** (which
vis and JS `Date` handle poorly): a `Date` becomes a leap-aware day-of-year
fraction, a bare `number`/`"1492"`/`"-753"` is read as a decimal year, and
ISO-ish strings (`"+1492-10-12T..."`, `"-0753-04-21"`) parse sign-aware. To
round-trip the OHM map's own vis items (whose `start` Dates came from
`DecimaldatePipe`), pass `fromVisItems(items, { decodeTime: dateToDecimal })`.

## Theming

Every visual is driven by CSS custom properties, defaulted on the component
root so it works standalone. Override per-instance:

```ts
new Timeline(host, {
  theme: { brass: 'oklch(0.78 0.13 40)', groundDeep: '#0c0b0a' },
});
```

…or globally by setting `--ground-deep`, `--brass`, `--ink`, `--hairline`,
`--font-display`, `--font-body`, etc. on any ancestor.

## Develop

This is an npm-workspaces monorepo. The host toolchain only needs to be modern
enough for the build (Node ≥ 18); like the rest of OHM you can run it in Docker.

```bash
npm install
npm run build:core          # build core first (the others depend on its types)
npm run build               # core → react → angular
npm run dev:demo            # live Vite demo against core source
npm run typecheck           # core + react
```

The Angular package builds with **ng-packagr** into the Angular Package Format;
the core and React packages build with **tsup** to dual ESM/CJS + `.d.ts`.

## Provenance

Ported from the OHM map viewer's custom SVG timeline (`ohm-map`,
`src/app/timeline/`), including the decimal-year model (`DecimaldatePipe`), the
four-scale tick density, the era markers (`assets/eras.json`, bundled as
`DEFAULT_ERAS`), and the animated brass cursor. The event band and playback are
new here.

## License

MIT © OpenHistoryMap / Marco Montanari
