/** The save's own arithmetic: races counted, the run last played, and a best time for each run that only ever gets better. */
import { describe, expect, it } from 'vitest';
import { Progress, memoryStore } from '../src/progress';

describe('the save', () => {
  it('counts every race run, and keeps only the best time on each run', () => {
    const p = new Progress(memoryStore());
    p.ran('first-drop', 6);
    expect(p.save).toEqual({ races: 1, run: '', bests: { 'first-drop': 6 } });
    p.ran('first-drop', 7);
    expect(p.best('first-drop'), 'a slower race is counted, and leaves the best alone').toBe(6);
    expect(p.races).toBe(2);
    p.ran('first-drop', 5);
    expect(p.best('first-drop')).toBe(5);
    p.ran('first-drop', 0);
    expect(p.best('first-drop'), 'a race nobody finished still counts, and sets no time').toBe(5);
    expect(p.races).toBe(4);
  });

  it('never lets a best on one run stand as the best on another', () => {
    const p = new Progress(memoryStore());
    p.ran('the-chute', 2.7);
    p.ran('first-drop', 5.2);
    expect(p.best('first-drop')).toBe(5.2);
    expect(p.best('the-chute')).toBe(2.7);
    expect(p.best('the-tower'), 'nothing on a run not yet raced').toBe(0);
  });

  it('remembers the run last put on', () => {
    const store = memoryStore();
    const p = new Progress(store);
    p.chose('the-tower');
    p.persist();
    expect(new Progress(memoryStore(store.json)).save.run).toBe('the-tower');
  });

  it('takes only what it can use from a save it did not write', () => {
    // written out by hand, since an object in code cannot carry a key called __proto__ into JSON
    const json =
      '{"races":3,"run":42,"bests":{"first-drop":5,"the-chute":-1,"Not An Id":4,"__proto__":{"polluted":1},"switchback":"fast"}}';
    const p = new Progress(memoryStore(json));
    expect(p.save).toEqual({ races: 3, run: '', bests: { 'first-drop': 5 } });
    expect(Object.getPrototypeOf(p.save.bests), 'no key in a save reaches the prototype').toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBe(undefined);
  });

  it('forgets everything when started over, in memory and in the store', () => {
    const store = memoryStore();
    const p = new Progress(store);
    p.ran('first-drop', 4);
    p.persist();
    p.reset();
    expect(p.save).toEqual({ races: 0, run: '', bests: {} });
    expect(store.json).toBe(null);
  });
});
