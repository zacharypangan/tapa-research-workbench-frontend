import assert from 'node:assert/strict';
import test from 'node:test';
import { networkLinks, neighborhood, sourceClusterLayout } from './graphNetworkLayout.ts';

const entity = (id, sourceId = 'paper') => ({ entity_id: id, source_id: sourceId, entity_type: 'Concept', label_original: id, evidence_ids: [] });
const connection = (id, from, to, extra = {}) => ({ id, title: id, kind: 'relationship', excluded: false, statement: { assertion_id: id, subject_id: from, ...(to ? { object_id: to } : { value: 'A text description' }), predicate: 'uses', polarity: 'positive', scope: {}, evidence_ids: [], ...extra } });

test('visual triples preserve all claims, polarity and layer; literals do not create invented edges', () => {
  const rows = [connection('a', 'one', 'two'), connection('b', 'one', 'two'), connection('c', 'one', 'two', { polarity: 'negative' }), { ...connection('d', 'one', 'two'), kind: 'inference' }, connection('literal', 'one')];
  const before = JSON.stringify(rows);
  const links = networkLinks(rows, new Set(['one', 'two']), false);
  assert.equal(links.length, 3);
  const layers = [connection('first-layer', 'one', 'two', { layer: 'concept_alignment' }), connection('second-layer', 'one', 'two', { layer: 'context' })];
  assert.equal(networkLinks(layers, new Set(['one', 'two']), false).length, 2);
  assert.deepEqual(links.find(link => link.kind === 'relationship' && link.polarity === 'positive').connections.map(row => row.id), ['a', 'b']);
  assert.equal(JSON.stringify(rows), before);
  assert.equal(networkLinks([connection('literal', 'one')], new Set(['one', 'two']), false).length, 0);
});

test('context references require exact declared IDs and remain a distinct optional layer', () => {
  const rows = [connection('a', 'one', 'two', { scope: { place_id: 'place', note: 'place', unknown_id: 'missing' } })];
  assert.equal(networkLinks(rows, new Set(['one', 'two', 'place']), false).length, 1);
  const links = networkLinks(rows, new Set(['one', 'two', 'place']), true);
  assert.equal(links.length, 2);
  assert.equal(links.filter(link => link.kind === 'context')[0].to, 'place');
});

test('one- and two-hop views follow exact endpoints and keep isolated roots', () => {
  const links = networkLinks([connection('a', 'one', 'two'), connection('b', 'two', 'three')], new Set(['one', 'two', 'three']), false);
  assert.deepEqual([...neighborhood(['one'], links, 1)].sort(), ['one', 'two']);
  assert.deepEqual([...neighborhood(['one'], links, 2)].sort(), ['one', 'three', 'two']);
  assert.deepEqual([...neighborhood(['isolated'], links, 2)], ['isolated']);
});

test('source clusters are deterministic, do not merge labels, and leave no reserved web lane', () => {
  const entities = [entity('paper:1'), entity('paper:2'), { ...entity('web:1', 'website'), label_original: 'paper:1' }];
  const before = JSON.stringify(entities);
  const first = sourceClusterLayout(entities, []);
  const reversed = sourceClusterLayout([...entities].reverse(), []);
  assert.deepEqual([...first.positions], [...reversed.positions]);
  assert.equal(first.positions.size, 3);
  assert.equal(first.clusters.length, 2);
  const paperOnly = sourceClusterLayout(entities.slice(0, 2), []);
  assert.equal(paperOnly.clusters.length, 1);
  assert.equal(paperOnly.clusters[0].x, 0);
  assert.equal(JSON.stringify(entities), before);
  const [a, b] = first.clusters;
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= a.radius + b.radius + 32);
});

test('pilot-sized layout includes 3,105 source-local records across 136 sources', () => {
  const entities = Array.from({ length: 3105 }, (_, index) => entity(`record:${index}`, `source:${index % 136}`));
  const begin = performance.now();
  const layout = sourceClusterLayout(entities, []);
  assert.equal(layout.positions.size, 3105);
  assert.equal(layout.clusters.length, 136);
  for (const point of layout.positions.values()) assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
  for (const [index, a] of layout.clusters.entries()) for (const b of layout.clusters.slice(index + 1)) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= a.radius + b.radius + 31.99);
  console.info(`Pilot-sized source layout: ${(performance.now() - begin).toFixed(1)} ms`);
});
