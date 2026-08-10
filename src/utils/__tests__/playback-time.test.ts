import { describe, it, expect } from '@jest/globals';
import { formatPlaybackTime } from '../playback-time';

describe('formatPlaybackTime', () => {
  it('formats whole seconds as m:ss with zero-padded seconds', () => {
    expect(formatPlaybackTime(0)).toBe('0:00');
    expect(formatPlaybackTime(5)).toBe('0:05');
    expect(formatPlaybackTime(65)).toBe('1:05');
    expect(formatPlaybackTime(125)).toBe('2:05');
    expect(formatPlaybackTime(3600)).toBe('60:00');
  });

  it('floors fractional seconds — never rounds the seconds field up to 60', () => {
    // Round-then-decompose guard: Math.round(59.9 % 60) would yield 60.
    expect(formatPlaybackTime(59.9)).toBe('0:59');
    expect(formatPlaybackTime(60.9)).toBe('1:00');
    expect(formatPlaybackTime(119.999)).toBe('1:59');
  });

  it('returns 0:00 for non-finite values instead of "NaN:NaN" / "Infinity:NaN"', () => {
    // HTMLMediaElement.duration is NaN for unknown-duration media even after
    // loadedmetadata; this is the regression the guard exists to prevent.
    expect(formatPlaybackTime(NaN)).toBe('0:00');
    expect(formatPlaybackTime(Infinity)).toBe('0:00');
    expect(formatPlaybackTime(-Infinity)).toBe('0:00');
  });

  it('returns 0:00 for negative values', () => {
    expect(formatPlaybackTime(-1)).toBe('0:00');
    expect(formatPlaybackTime(-0.5)).toBe('0:00');
  });
});
