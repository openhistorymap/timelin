import { Timeline, formatPlainYear, type TimelineEvent } from '@openhistorymap/timeline-core';
import { fetchWikidataEvents } from '@openhistorymap/timeline-core/wikidata';
import { fromVisItems, type VisDataItem } from '@openhistorymap/timeline-core/vis';

/* A few hand-picked events to start with (spans + points). */
const SAMPLE_EVENTS: TimelineEvent[] = [
  { id: 'punic2', year: -218, endYear: -201, title: 'Second Punic War' },
  { id: 'caesar', year: -49, endYear: -45, title: "Caesar's Civil War" },
  { id: 'augustus', year: -27, title: 'Augustus becomes princeps' },
  { id: 'vesuvius', year: 79, title: 'Eruption of Vesuvius', description: 'Pompeii buried' },
  { id: 'trajan', year: 98, endYear: 117, title: 'Reign of Trajan', description: 'Empire at its greatest extent' },
  { id: 'milan', year: 313, title: 'Edict of Milan' },
  { id: 'sack', year: 410, title: 'Sack of Rome' },
];

const host = document.getElementById('timeline')!;
const readout = document.getElementById('readout')!;
const hint = document.getElementById('hint')!;

const tl = new Timeline(host, {
  year: 117,
  viewSpan: 400,
  events: SAMPLE_EVENTS,
});

const showYear = (y: number) => (readout.textContent = formatPlainYear(y));
showYear(tl.getYear());

tl.on('yearChange', showYear);
tl.on('eventSelect', (e) => {
  hint.textContent = `${e.title} — ${formatPlainYear(e.year)}`;
});
tl.on('eraSelect', (e) => {
  hint.textContent = `Era: ${e.label} (${formatPlainYear(e.year)})`;
});

document.getElementById('play')!.addEventListener('click', () =>
  tl.play({ yearsPerSecond: 8 }),
);
document.getElementById('pause')!.addEventListener('click', () => tl.pause());
document.getElementById('goto-1492')!.addEventListener('click', () => {
  tl.centerOn(1492, 200);
  tl.setYear(1492, { animate: true });
});
document.getElementById('goto-rome')!.addEventListener('click', () => {
  tl.centerOn(117, 400);
  tl.setYear(117, { animate: true });
});

/* vis-timeline compatibility: a DataSet-shaped array drops straight in. */
const VIS_ITEMS: VisDataItem[] = [
  { id: 1, content: '<b>Republic</b>', start: -509, end: -27, type: 'range', title: 'Roman Republic' },
  { id: 2, content: 'Punic Wars', start: -264, end: -146, type: 'range' },
  { id: 3, content: 'Assassination of Caesar', start: '-0044-03-15', type: 'point' },
  { id: 4, content: 'Empire', start: -27, end: 476, type: 'range', style: 'background-color: #8a5a2b;' },
];
document.getElementById('load-vis')!.addEventListener('click', () => {
  tl.setEvents(fromVisItems(VIS_ITEMS));
  tl.centerOn(0, 700);
  hint.textContent = `Loaded ${VIS_ITEMS.length} vis-timeline items (Date/number/ISO, BCE included).`;
});

/* Live Wikidata demo: Roman emperors (Q842606) with their point-in-time dates. */
document.getElementById('load-wd')!.addEventListener('click', async () => {
  hint.textContent = 'Querying Wikidata…';
  try {
    const events = await fetchWikidataEvents({
      // "Roman emperor" position held; here we query notable people via a custom query.
      sparql: `SELECT ?item ?itemLabel ?date ?endDate WHERE {
        ?item p:P39 ?st .
        ?st ps:P39 wd:Q842606 .
        OPTIONAL { ?st pq:P580 ?date . }
        OPTIONAL { ?st pq:P582 ?endDate . }
        FILTER(BOUND(?date))
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      } ORDER BY ?date LIMIT 200`,
    });
    tl.setEvents(events);
    tl.centerOn(50, 600);
    hint.textContent = `Loaded ${events.length} Roman-emperor reigns from Wikidata.`;
  } catch (err) {
    hint.textContent = `Wikidata query failed: ${(err as Error).message}`;
  }
});
