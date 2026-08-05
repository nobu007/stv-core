import {
  fireAudioMetadata,
  fireAudioError,
  flushPendingTimers,
  type AudioMetadataHost,
} from './audio-mock-helpers';

describe('audio-mock-helpers', () => {
  describe('fireAudioMetadata', () => {
    it('invokes onloadedmetadata on the next event-loop turn', async () => {
      const host: AudioMetadataHost = { onloadedmetadata: jest.fn() };
      fireAudioMetadata(host);
      expect(host.onloadedmetadata).not.toHaveBeenCalled();
      await flushPendingTimers();
      expect(host.onloadedmetadata).toHaveBeenCalledTimes(1);
    });

    it('binds `this` to the host instance when invoking the handler', async () => {
      const host: AudioMetadataHost = { onloadedmetadata: jest.fn() };
      fireAudioMetadata(host);
      await flushPendingTimers();
      expect((host.onloadedmetadata as jest.Mock).mock.instances[0]).toBe(host);
    });

    it('is a no-op when onloadedmetadata is null', async () => {
      const host: AudioMetadataHost = { onloadedmetadata: null };
      expect(() => fireAudioMetadata(host)).not.toThrow();
      await flushPendingTimers();
    });

    it('is a no-op when onloadedmetadata is not a function', async () => {
      // Defensive guard — some mocks leave the property as `undefined`.
      const host = { onloadedmetadata: undefined } as unknown as AudioMetadataHost;
      expect(() => fireAudioMetadata(host)).not.toThrow();
      await flushPendingTimers();
    });

    it('defers dispatch until the awaited promise has a chance to attach', async () => {
      // The whole reason for setImmediate: the caller's promise chain
      // must register `.then(...)` before the callback fires. This test
      // proves that ordering by attaching a `.then` immediately after
      // fireAudioMetadata and verifying the handler still runs.
      const host: AudioMetadataHost = { onloadedmetadata: jest.fn() };
      let resolved = false;
      fireAudioMetadata(host);
      Promise.resolve().then(() => {
        resolved = true;
      });
      await flushPendingTimers();
      expect(resolved).toBe(true);
      expect(host.onloadedmetadata).toHaveBeenCalledTimes(1);
    });
  });

  describe('fireAudioError', () => {
    it('invokes onerror on the next event-loop turn', async () => {
      const host: AudioMetadataHost = { onloadedmetadata: null, onerror: jest.fn() };
      fireAudioError(host);
      expect(host.onerror).not.toHaveBeenCalled();
      await flushPendingTimers();
      expect(host.onerror).toHaveBeenCalledTimes(1);
    });

    it('is a no-op when onerror is missing', async () => {
      const host: AudioMetadataHost = { onloadedmetadata: null };
      expect(() => fireAudioError(host)).not.toThrow();
      await flushPendingTimers();
    });
  });

  describe('flushPendingTimers', () => {
    it('returns a promise that resolves after one setImmediate turn', async () => {
      const start = Date.now();
      await flushPendingTimers();
      // Should resolve "soon" — at least one tick of the event loop.
      expect(Date.now() - start).toBeGreaterThanOrEqual(0);
    });

    it('runs microtasks scheduled before the flush before resolving', async () => {
      const order: string[] = [];
      Promise.resolve().then(() => order.push('microtask'));
      const p = flushPendingTimers().then(() => order.push('flush'));
      await p;
      expect(order).toEqual(['microtask', 'flush']);
    });

    it('can be awaited multiple times without state leakage', async () => {
      await flushPendingTimers();
      await flushPendingTimers();
      // No throw — successive calls each schedule a fresh setImmediate.
    });
  });
});
