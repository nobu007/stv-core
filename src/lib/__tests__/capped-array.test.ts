import { describe, expect, it } from '@jest/globals';

import { CappedArray } from '../capped-array';

describe('CappedArray', () => {
  describe('construction', () => {
    it('starts empty and stores maxSize', () => {
      const arr = new CappedArray<number>(3);
      expect(arr.length).toBe(0);
      expect(arr.maxSize).toBe(3);
    });

    it.each([NaN, -1, -0.5, Infinity, -Infinity])(
      'rejects invalid maxSize %p',
      (bad) => {
        expect(() => new CappedArray<number>(bad)).toThrow(RangeError);
      },
    );

    it('floors a fractional maxSize', () => {
      const arr = new CappedArray<number>(2.9);
      expect(arr.maxSize).toBe(2);
    });
  });

  describe('push (single)', () => {
    it('grows normally while under cap', () => {
      const arr = new CappedArray<number>(3);
      arr.push(1);
      arr.push(2);
      expect([...arr]).toEqual([1, 2]);
    });

    it('evicts the OLDEST entry once over cap (FIFO)', () => {
      const arr = new CappedArray<number>(3);
      arr.push(1);
      arr.push(2);
      arr.push(3);
      arr.push(4); // overflow → evict 1
      expect([...arr]).toEqual([2, 3, 4]);
      expect(arr.length).toBe(3);
    });

    it('keeps evicting as more items arrive', () => {
      const arr = new CappedArray<number>(2);
      for (let i = 1; i <= 6; i++) arr.push(i);
      expect([...arr]).toEqual([5, 6]);
    });
  });

  describe('push (bulk)', () => {
    it('caps a single bulk push that exceeds maxSize, keeping the NEWEST', () => {
      const arr = new CappedArray<number>(3);
      arr.push(1, 2, 3, 4, 5); // overflow by 2 → keep [3,4,5]
      expect([...arr]).toEqual([3, 4, 5]);
    });

    it('caps a bulk push onto existing contents', () => {
      const arr = new CappedArray<number>(3);
      arr.push(1, 2);
      arr.push(3, 4, 5); // total 5 → keep last 3
      expect([...arr]).toEqual([3, 4, 5]);
    });
  });

  describe('cap of 0', () => {
    it('retains nothing', () => {
      const arr = new CappedArray<number>(0);
      arr.push(1);
      arr.push(2, 3);
      expect(arr.length).toBe(0);
      expect([...arr]).toEqual([]);
    });
  });

  describe('unshift', () => {
    it('prepends and evicts from the tail (keeps most-recently-added)', () => {
      const arr = new CappedArray<number>(3);
      arr.unshift(1);
      arr.unshift(2);
      arr.unshift(3); // [3,2,1]
      arr.unshift(4); // [4,3,2,1] → evict tail (1) → [4,3,2]
      expect([...arr]).toEqual([4, 3, 2]);
    });
  });

  describe('splice', () => {
    it('pure deletion shrinks without side effects', () => {
      const arr = new CappedArray<number>(5);
      arr.push(1, 2, 3, 4, 5);
      const removed = arr.splice(0, 2); // remove oldest two
      expect(removed).toEqual([1, 2]);
      expect([...arr]).toEqual([3, 4, 5]);
    });

    it('insert triggers oldest-first eviction back to cap', () => {
      const arr = new CappedArray<number>(3);
      arr.push(1, 2, 3);
      arr.splice(1, 0, 9); // [1,9,2,3] → evict oldest (1) → [9,2,3]
      expect([...arr]).toEqual([9, 2, 3]);
    });

    it('delete-to-end form (start only) works', () => {
      const arr = new CappedArray<number>(5);
      arr.push(1, 2, 3, 4, 5);
      arr.splice(3); // remove from index 3 onward
      expect([...arr]).toEqual([1, 2, 3]);
    });
  });

  describe('replaceWith', () => {
    it('replaces contents, keeping newest within cap', () => {
      const arr = new CappedArray<number>(3);
      arr.push(1, 2, 3);
      arr.replaceWith([10, 20, 30, 40, 50]); // keep last 3
      expect([...arr]).toEqual([30, 40, 50]);
    });

    it('preserves the cap for subsequent pushes (no silent downgrade)', () => {
      const arr = new CappedArray<number>(3);
      arr.replaceWith([1, 2, 3, 4, 5, 6]);
      arr.push(7); // [4,5,6,7] → evict 4 → [5,6,7]
      expect([...arr]).toEqual([5, 6, 7]);
      expect(arr).toBeInstanceOf(CappedArray);
    });
  });

  describe('clear', () => {
    it('empties the array but the cap still holds afterwards', () => {
      const arr = new CappedArray<number>(2);
      arr.push(1, 2);
      arr.clear();
      expect(arr.length).toBe(0);
      arr.push(3, 4, 5); // keep last 2
      expect([...arr]).toEqual([4, 5]);
    });
  });

  describe('read-path compatibility (it IS an Array)', () => {
    it('is an instance of Array', () => {
      const arr = new CappedArray<number>(3);
      expect(arr).toBeInstanceOf(Array);
      expect(Array.isArray(arr)).toBe(true);
    });

    it('supports indexing and length', () => {
      const arr = new CappedArray<string>(3);
      arr.push('a', 'b', 'c');
      expect(arr[0]).toBe('a');
      expect(arr[arr.length - 1]).toBe('c');
    });

    it('supports spread, map, filter, find, reduce, for...of', () => {
      const arr = new CappedArray<number>(5);
      arr.push(1, 2, 3, 4, 5);
      expect([...arr]).toEqual([1, 2, 3, 4, 5]);
      expect(arr.map((n) => n * 2)).toEqual([2, 4, 6, 8, 10]);
      expect(arr.filter((n) => n % 2 === 0)).toEqual([2, 4]);
      expect(arr.find((n) => n > 3)).toBe(4);
      expect(arr.reduce((a, b) => a + b, 0)).toBe(15);
      const collected: number[] = [];
      for (const n of arr) collected.push(n);
      expect(collected).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('the structural guarantee (the whole point)', () => {
    it('multiple push sites all route through the same cap', () => {
      // Simulates the "no-cap sibling" scenario: a second push site added later
      // MUST still be capped, because the collection — not each call site —
      // enforces eviction.
      const arr = new CappedArray<number>(3);
      // site A
      arr.push(1);
      arr.push(2);
      // site B (added later, "forgets" the cap in the hand-rolled world)
      arr.push(3);
      arr.push(4);
      arr.push(5);
      expect(arr.length).toBe(3); // never exceeds maxSize, regardless of site count
      expect([...arr]).toEqual([3, 4, 5]);
    });
  });
});
