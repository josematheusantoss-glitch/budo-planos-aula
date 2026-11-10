import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../live.js', import.meta.url), 'utf8');
const start = new Date('2026-11-10T17:00:00-03:00').getTime();
function harness(at = start) {
  let now = at;
  const plan = {
    id: '11111111-1111-4111-8111-111111111111', date: '2026-11-10', instructor: 'Caio',
    steps: [{ title: 'Aquecimento', minutes: 10 }, { title: 'Lutas', minutes: 50 }],
  };
  const store = { view: 'scheduled', past: [plan] };
  const saved = new Map();
  let cloudWrites = 0;
  class ClockDate extends Date { static now() { return now; } }
  const context = vm.createContext({
    Date: ClockDate, store, archiveNav: { scheduled: {}, past: {} },
    archivePlan: () => plan, budoCloud: { identity: () => 'instructor-id', saveLesson: async () => { cloudWrites++; } },
    cloudReady: true, KEY: 'test', localStorage: { getItem: key => saved.get(key) || null, setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) },
    navigator: { userAgent: 'test' }, window: { innerWidth: 400, innerHeight: 800, matchMedia: () => ({ matches: false }), addEventListener() {} },
    document: { querySelector: selector => selector === '#liveTimerDock' ? { hidden: true } : null, addEventListener() {}, visibilityState: 'hidden' },
    setInterval() {}, console, toast() {}, render() {}, renderList() {}, queueCloudSave() {},
    sum: value => value.steps.reduce((total, stage) => total + stage.minutes, 0),
    saoNow: () => '2026-11-10T17:00', isDue: () => now >= new Date('2026-11-10T19:00:00-03:00').getTime(),
    monthKey: () => '2026-11', instructorKey: () => 'caio', escapeHtml: value => value,
  });
  vm.runInContext(source, context);
  return { plan, store, saved, context, setTime: value => { now = value; }, writes: () => cloudWrites, action: name => vm.runInContext(`liveAction(${JSON.stringify(name)})`, context), elapsed: () => vm.runInContext('liveElapsed(livePlan().liveRun)', context) };
}

test('troca manual, pausa e finalização salvam tempos reais; antes das 19h permanece registrada', async () => {
  const h = harness();
  await h.action('start');
  h.setTime(start + 8 * 60000);
  assert.equal(h.elapsed(), 8 * 60000);
  await h.action('next');
  assert.equal(h.plan.liveRun.stageActualMs[0], 8 * 60000);
  h.setTime(start + 17 * 60000);
  await h.action('pause');
  h.setTime(start + 27 * 60000);
  assert.equal(h.elapsed(), 17 * 60000);
  await h.action('resume');
  h.setTime(start + 30 * 60000);
  await h.action('pause');
  await h.action('finish');
  assert.equal(h.plan.liveRun.status, 'finished');
  assert.equal(h.plan.liveRun.totalElapsedMs, 20 * 60000);
  assert.equal(h.plan.liveRun.stageActualMs[1], 12 * 60000);
  assert.equal(h.store.view, 'scheduled');
  assert.equal(h.plan.completedAt, undefined);
  assert.equal(JSON.parse(h.saved.get('test')).past[0].liveRun.status, 'finished');
  assert.equal(h.writes(), 6);
});

test('finalização depois das 19h move a aula para concluídas', async () => {
  const h = harness(new Date('2026-11-10T18:59:00-03:00').getTime());
  await h.action('start');
  h.setTime(new Date('2026-11-10T19:01:00-03:00').getTime());
  await h.action('pause');
  await h.action('finish');
  assert.equal(h.store.view, 'past');
  assert.equal(h.plan.liveRun.totalElapsedMs, 2 * 60000);
  assert.ok(h.plan.completedAt);
});

test('avisos mudam aos 80%, 90% e no fim da etapa', () => {
  const h = harness();
  const level = value => vm.runInContext(`liveLevel(${value},600000)`, h.context);
  assert.equal(level(479999), 'normal');
  assert.equal(level(480000), 'yellow');
  assert.equal(level(540000), 'red');
  assert.equal(level(600000), 'done');
});
