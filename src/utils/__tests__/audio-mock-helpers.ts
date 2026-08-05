/**
 * Audio mock helpers — test utilities for fake HTMLAudioElement instances.
 *
 * Extracts the setImmediate-based dispatch patterns duplicated across
 * streaming-transcriber.test.ts (39 copies of the loadedmetadata block)
 * and the global Teardown yield pattern. Centralizing these prevents drift
 * between test files and provides a single point to evolve the timing
 * strategy if the underlying race changes.
 *
 * See docs/analysis/setimmediate-teardown-pattern.md for the migration
 * evidence that led to this helper.
 */

/**
 * Minimal HTMLAudioElement-like surface needed by these helpers.
 *
 * The streaming-transcriber tests use a lightweight `MockAudioInstance`
 * (see src/transcription/__tests__/streaming-transcriber.test.ts) that
 * implements only `onloadedmetadata` and `onerror`. We type against
 * that contract so the helper works with both the real DOM type and
 * the local mock.
 */
export interface AudioMetadataHost {
  onloadedmetadata: ((this: unknown, ev?: Event) => unknown) | null;
  onerror?: ((this: unknown, ev?: Event) => unknown) | null;
}

/**
 * Fire the `loadedmetadata` event on a mocked audio instance on the
 * next event-loop turn.
 *
 * Why setImmediate:
 *   StreamingTranscriber's constructor awaits getAudioDuration(mockAudio),
 *   which only resolves once `onloadedmetadata` is invoked. The audio
 *   instance is a fake HTMLAudioElement; without manual dispatch the
 *   awaited promise hangs. setImmediate defers dispatch by exactly one
 *   tick, allowing the test's promise chain to register its `.then(...)`
 *   continuation before the callback fires.
 *
 * The helper is a no-op when `onloadedmetadata` is null — this matches
 * the prior duplicated behavior and avoids throwing on tests that
 * intentionally leave the handler unset.
 */
export function fireAudioMetadata(instance: AudioMetadataHost): void {
  setImmediate(() => {
    if (typeof instance.onloadedmetadata === 'function') {
      instance.onloadedmetadata.call(instance);
    }
  });
}

/**
 * Fire the `error` event on a mocked audio instance on the next
 * event-loop turn. Mirrors `fireAudioMetadata` for the error path so
 * both branches of the audio-load race can be exercised from tests.
 */
export function fireAudioError(instance: AudioMetadataHost): void {
  setImmediate(() => {
    if (typeof instance.onerror === 'function') {
      instance.onerror.call(instance);
    }
  });
}

/**
 * Flush pending timers and microtasks, returning a promise that
 * resolves after one `setImmediate` turn.
 *
 * Mirrors the teardown dance in tests/globalTeardown.ts. Use this
 * inside any `afterAll` block that schedules timers (`setTimeout`,
 * `setInterval`, `setImmediate`, or `queueMicrotask`) so that pending
 * callbacks do not leak across worker boundaries in `--maxWorkers`
 * parallel mode.
 */
export function flushPendingTimers(): Promise<void> {
  return new Promise<void>((resolve) => {
    setImmediate(() => resolve());
  });
}
