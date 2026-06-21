import { formatDuration } from '../audio-duration';

describe('formatDuration', () => {
  it('returns "不明" for NaN', () => {
    expect(formatDuration(NaN)).toBe('不明');
  });

  it('returns "不明" for Infinity', () => {
    expect(formatDuration(Infinity)).toBe('不明');
  });

  it('returns "不明" for negative values', () => {
    expect(formatDuration(-1)).toBe('不明');
  });

  it('formats zero seconds', () => {
    expect(formatDuration(0)).toBe('0秒');
  });

  it('formats seconds only', () => {
    expect(formatDuration(45)).toBe('45秒');
  });

  it('formats minutes only (exact)', () => {
    expect(formatDuration(120)).toBe('2分');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(125)).toBe('2分5秒');
  });

  it('formats hours only (exact)', () => {
    expect(formatDuration(3600)).toBe('1時間');
  });

  it('formats hours and minutes', () => {
    expect(formatDuration(3660)).toBe('1時間1分');
  });

  it('formats hours, minutes, and seconds', () => {
    expect(formatDuration(3725)).toBe('1時間2分5秒');
  });

  it('formats fractional seconds by flooring', () => {
    expect(formatDuration(45.9)).toBe('45秒');
  });

  it('formats large duration', () => {
    expect(formatDuration(36000)).toBe('10時間');
  });
});
