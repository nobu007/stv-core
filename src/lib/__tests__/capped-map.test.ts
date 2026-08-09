import { describe, expect, it } from '@jest/globals';

import { CappedMap } from '../capped-map';

describe('CappedMap', () => {
  describe('construction', () => {
    it('starts empty and stores maxSize', () => {
      const map = new CappedMap<string, number>(3);
      expect(map.size).toBe(0);
      expect(map.maxSize).toBe(3);
    });

    it.each([NaN, -1, -0.5, Infinity, -Infinity])(
      'rejects invalid maxSize %p',
      (bad) => {
        expect(() => new CappedMap<string, number>(bad)).toThrow(RangeError);
      },
    );

    it('floors a fractional maxSize', () => {
      const map = new CappedMap<string, number>(2.9);
      expect(map.maxSize).toBe(2);
    });

    it('accepts initial entries and keeps the NEWEST within cap', () => {
      const map = new CappedMap<string, number>(3, [
        ['a', 1],
        ['b', 2],
        ['c', 3],
        ['d', 4],
        ['e', 5],
      ]);
      expect(map.size).toBe(3);
      expect([...map.entries()]).toEqual([
        ['c', 3],
        ['d', 4],
        ['e', 5],
      ]);
    });
  });

  describe('set (insert new keys)', () => {
    it('grows normally while under cap', () => {
      const map = new CappedMap<string, number>(3);
      map.set('a', 1);
      map.set('b', 2);
      expect(map.size).toBe(2);
      expect(map.get('a')).toBe(1);
    });

    it('evicts the OLDEST entry once over cap (FIFO)', () => {
      const map = new CappedMap<string, number>(3);
      map.set('a', 1);
      map.set('b', 2);
      map.set('c', 3);
      map.set('d', 4); // overflow → evict 'a'
      expect(map.size).toBe(3);
      expect([...map.keys()]).toEqual(['b', 'c', 'd']);
      expect(map.has('a')).toBe(false);
      expect(map.get('d')).toBe(4);
    });

    it('keeps evicting as more keys arrive', () => {
      const map = new CappedMap<number, number>(2);
      for (let i = 1; i <= 6; i++) map.set(i, i * 10);
      expect([...map.keys()]).toEqual([5, 6]);
      expect(map.get(6)).toBe(60);
    });
  });

  describe('set (update existing key)', () => {
    it('updates the value WITHOUT growing size or evicting', () => {
      const map = new CappedMap<string, number>(2);
      map.set('a', 1);
      map.set('b', 2);
      map.set('a', 999); // existing key → no overflow
      expect(map.size).toBe(2);
      expect(map.get('a')).toBe(999);
      expect([...map.keys()]).toEqual(['a', 'b']); // insertion order preserved
    });

    it('updating an existing key at-cap does not evict the oldest', () => {
      const map = new CappedMap<string, number>(2);
      map.set('a', 1);
      map.set('b', 2); // at cap
      map.set('a', 7); // existing → no eviction
      expect(map.has('b')).toBe(true);
      expect(map.size).toBe(2);
    });
  });

  describe('cap of 0', () => {
    it('retains nothing (every new key evicts itself)', () => {
      const map = new CappedMap<string, number>(0);
      map.set('a', 1);
      map.set('b', 2);
      expect(map.size).toBe(0);
      expect([...map]).toEqual([]);
    });
  });

  describe('replaceWith', () => {
    it('replaces contents, keeping newest within cap', () => {
      const map = new CappedMap<string, number>(3);
      map.set('a', 1);
      map.set('b', 2);
      map.replaceWith([
        ['x', 10],
        ['y', 20],
        ['z', 30],
        ['w', 40],
        ['v', 50],
      ]);
      expect([...map.entries()]).toEqual([
        ['z', 30],
        ['w', 40],
        ['v', 50],
      ]);
    });

    it('preserves the cap for subsequent sets (no silent downgrade)', () => {
      const map = new CappedMap<string, number>(3);
      map.replaceWith([
        ['a', 1],
        ['b', 2],
        ['c', 3],
        ['d', 4],
        ['e', 5],
        ['f', 6],
      ]);
      map.set('g', 7); // [d,e,f] → evict d → [e,f,g]
      expect([...map.keys()]).toEqual(['e', 'f', 'g']);
      expect(map).toBeInstanceOf(CappedMap);
    });
  });

  describe('clear', () => {
    it('empties the map but the cap still holds afterwards', () => {
      const map = new CappedMap<string, number>(2);
      map.set('a', 1);
      map.set('b', 2);
      map.clear();
      expect(map.size).toBe(0);
      map.set('c', 3);
      map.set('d', 4);
      map.set('e', 5); // keep last 2
      expect([...map.keys()]).toEqual(['d', 'e']);
    });
  });

  describe('delete', () => {
    it('removes an entry and frees a slot', () => {
      const map = new CappedMap<string, number>(2);
      map.set('a', 1);
      map.set('b', 2);
      expect(map.delete('a')).toBe(true);
      expect(map.delete('a')).toBe(false); // already gone
      map.set('c', 3); // size 2 again, no eviction needed
      expect([...map.keys()]).toEqual(['b', 'c']);
    });
  });

  describe('read-path compatibility (it IS a Map)', () => {
    it('is an instance of Map', () => {
      const map = new CappedMap<string, number>(3);
      expect(map).toBeInstanceOf(Map);
    });

    it('supports get/has/forEach/iteration/size', () => {
      const map = new CappedMap<string, number>(5);
      map.set('a', 1);
      map.set('b', 2);
      map.set('c', 3);
      expect(map.get('b')).toBe(2);
      expect(map.has('c')).toBe(true);
      expect(map.size).toBe(3);
      const collected: [string, number][] = [];
      map.forEach((v, k) => collected.push([k, v]));
      expect(collected).toEqual([
        ['a', 1],
        ['b', 2],
        ['c', 3],
      ]);
      expect([...map.entries()]).toEqual([
        ['a', 1],
        ['b', 2],
        ['c', 3],
      ]);
    });
  });

  describe('the structural guarantee (the whole point)', () => {
    it('multiple set sites all route through the same cap', () => {
      // Simulates the "no-cap sibling" scenario: a second set site added later
      // MUST still be capped, because the collection — not each call site —
      // enforces eviction.
      const map = new CappedMap<string, number>(3);
      // site A
      map.set('a', 1);
      map.set('b', 2);
      // site B (added later, "forgets" the cap in the hand-rolled world)
      map.set('c', 3);
      map.set('d', 4);
      map.set('e', 5);
      expect(map.size).toBe(3); // never exceeds maxSize, regardless of site count
      expect([...map.keys()]).toEqual(['c', 'd', 'e']);
    });
  });
});
