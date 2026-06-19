import {
  validateAudioFile,
  validateAudioDuration,
  validateAudioFileMetadata,
  MIN_AUDIO_DURATION_SECONDS,
  type AudioValidationResult,
} from '../audio-validation';
import { AUDIO_LIMITS } from '@/config/limits';

// Minimal File-like constructor for jsdom
function makeFile(name: string, size: number, type: string): File {
  const blob = new Blob([new Uint8Array(Math.max(0, size))], { type });
  return new File([blob], name, { type });
}

describe('validateAudioFile', () => {
  describe('empty file detection', () => {
    it('rejects a 0-byte file', () => {
      const file = makeFile('audio.mp3', 0, 'audio/mpeg');
      const result = validateAudioFile(file);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Audio file is empty (0 bytes)');
    });
  });

  describe('file size validation (EDGE-101)', () => {
    it('accepts file under the size limit', () => {
      const file = makeFile('audio.mp3', 1024, 'audio/mpeg');
      const result = validateAudioFile(file);
      expect(result.errors).not.toContainEqual(
        expect.stringMatching(/exceeds maximum/),
      );
    });

    it('rejects file exceeding the size limit', () => {
      const oversized = AUDIO_LIMITS.MAX_FILE_SIZE_BYTES + 1;
      const file = makeFile('big.mp3', oversized, 'audio/mpeg');
      const result = validateAudioFile(file);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('exceeds maximum'))).toBe(true);
    });

    it('accepts file exactly at the size limit', () => {
      const exact = AUDIO_LIMITS.MAX_FILE_SIZE_BYTES;
      const file = makeFile('exact.mp3', exact, 'audio/mpeg');
      const result = validateAudioFile(file);
      expect(result.errors.some((e) => e.includes('exceeds maximum'))).toBe(false);
    });
  });

  describe('file type validation', () => {
    it.each([
      ['audio/mpeg', 'audio.mp3'],
      ['audio/mp3', 'audio.mp3'],
      ['audio/wav', 'audio.wav'],
      ['audio/wave', 'audio.wav'],
      ['audio/ogg', 'audio.ogg'],
      ['audio/x-ogg', 'audio.ogg'],
      ['audio/mp4', 'audio.m4a'],
      ['audio/x-m4a', 'audio.m4a'],
      ['audio/webm', 'audio.webm'],
    ])('accepts MIME type %s with filename %s', (mime, name) => {
      const file = makeFile(name, 1024, mime);
      const result = validateAudioFile(file);
      expect(result.errors.some((e) => e.includes('Unsupported'))).toBe(false);
    });

    it('accepts file with any audio/* MIME type', () => {
      const file = makeFile('custom.xyz', 1024, 'audio/custom');
      const result = validateAudioFile(file);
      expect(result.errors.some((e) => e.includes('Unsupported'))).toBe(false);
    });

    it('accepts file with valid extension but unknown MIME', () => {
      const file = makeFile('audio.mp3', 1024, 'application/octet-stream');
      const result = validateAudioFile(file);
      expect(result.errors.some((e) => e.includes('Unsupported'))).toBe(false);
    });

    it('rejects non-audio file with unsupported extension', () => {
      const file = makeFile('document.exe', 1024, 'application/x-msdownload');
      const result = validateAudioFile(file);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Unsupported'))).toBe(true);
    });

    it('rejects file with no extension and non-audio MIME', () => {
      const file = makeFile('noext', 1024, 'text/plain');
      const result = validateAudioFile(file);
      expect(result.valid).toBe(false);
    });
  });

  describe('valid results', () => {
    it('returns valid=true for a well-formed mp3', () => {
      const file = makeFile('speech.mp3', 5 * 1024 * 1024, 'audio/mpeg');
      const result = validateAudioFile(file);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

describe('validateAudioDuration', () => {
  describe('invalid duration values', () => {
    it('rejects NaN', () => {
      const result = validateAudioDuration(NaN);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid audio duration'))).toBe(true);
    });

    it('rejects Infinity', () => {
      const result = validateAudioDuration(Infinity);
      expect(result.valid).toBe(false);
    });

    it('rejects negative duration', () => {
      const result = validateAudioDuration(-5);
      expect(result.valid).toBe(false);
    });

    it('rejects -Infinity', () => {
      const result = validateAudioDuration(-Infinity);
      expect(result.valid).toBe(false);
    });
  });

  describe('minimum duration check (EDGE-102)', () => {
    it('rejects duration below minimum', () => {
      const result = validateAudioDuration(0.5);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('below minimum'))).toBe(true);
    });

    it('rejects zero duration', () => {
      const result = validateAudioDuration(0);
      expect(result.valid).toBe(false);
    });

    it('accepts duration at minimum boundary', () => {
      const result = validateAudioDuration(MIN_AUDIO_DURATION_SECONDS);
      expect(result.valid).toBe(true);
    });

    it('accepts duration above minimum', () => {
      const result = validateAudioDuration(10);
      expect(result.valid).toBe(true);
    });
  });

  describe('long duration warning (EDGE-103)', () => {
    it('warns for audio exceeding recommended maximum', () => {
      const longDuration = AUDIO_LIMITS.DURATION_WARNING_SECONDS + 1;
      const result = validateAudioDuration(longDuration);
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes('exceeds recommended'))).toBe(true);
    });

    it('does not warn for audio at the recommended maximum', () => {
      const maxDuration = AUDIO_LIMITS.DURATION_WARNING_SECONDS;
      const result = validateAudioDuration(maxDuration);
      expect(result.warnings.some((w) => w.includes('exceeds recommended'))).toBe(false);
    });

    it('does not warn for short audio', () => {
      const result = validateAudioDuration(30);
      expect(result.warnings).toHaveLength(0);
    });
  });
});

describe('validateAudioFileMetadata', () => {
  describe('extension validation (REQ-148)', () => {
    it.each(['mp3', 'wav', 'ogg', 'm4a'] as const)('accepts .%s extension', (ext) => {
      const result = validateAudioFileMetadata({ name: `file.${ext}`, size: 1024 });
      expect(result.valid).toBe(true);
    });

    it('rejects unsupported extension', () => {
      const result = validateAudioFileMetadata({ name: 'file.flac', size: 1024 });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Unsupported audio format'))).toBe(true);
    });

    it('rejects file with no extension', () => {
      const result = validateAudioFileMetadata({ name: 'noext', size: 1024 });
      expect(result.valid).toBe(false);
    });

    it('rejects file with dot but no extension', () => {
      const result = validateAudioFileMetadata({ name: 'trailing.', size: 1024 });
      expect(result.valid).toBe(false);
    });

    it('handles case-insensitive extensions', () => {
      const result = validateAudioFileMetadata({ name: 'FILE.MP3', size: 1024 });
      expect(result.valid).toBe(true);
    });

    it('handles extension after multiple dots', () => {
      const result = validateAudioFileMetadata({ name: 'my.audio.file.wav', size: 1024 });
      expect(result.valid).toBe(true);
    });
  });

  describe('file size validation', () => {
    it('accepts valid file size', () => {
      const result = validateAudioFileMetadata({ name: 'file.mp3', size: 1024 });
      expect(result.valid).toBe(true);
    });

    it('rejects 0-byte file', () => {
      const result = validateAudioFileMetadata({ name: 'file.mp3', size: 0 });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('empty'))).toBe(true);
    });

    it('rejects file exceeding size limit', () => {
      const oversized = AUDIO_LIMITS.MAX_FILE_SIZE_BYTES + 1;
      const result = validateAudioFileMetadata({ name: 'file.mp3', size: oversized });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('exceeds maximum'))).toBe(true);
    });

    it('skips size check when size is undefined', () => {
      const result = validateAudioFileMetadata({ name: 'file.mp3' });
      expect(result.valid).toBe(true);
      expect(result.errors.some((e) => e.includes('size'))).toBe(false);
    });
  });

  describe('error message quality', () => {
    it('includes filename in error message', () => {
      const result = validateAudioFileMetadata({ name: 'myfile.flac', size: 1024 });
      expect(result.errors.some((e) => e.includes('myfile.flac'))).toBe(true);
    });

    it('lists supported formats in error message', () => {
      const result = validateAudioFileMetadata({ name: 'file.xyz', size: 1024 });
      expect(result.errors.some((e) => e.includes('mp3'))).toBe(true);
      expect(result.errors.some((e) => e.includes('wav'))).toBe(true);
    });
  });
});
