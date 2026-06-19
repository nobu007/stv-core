import { sanitizeFilename } from '../sanitize';

describe('sanitizeFilename', () => {
  describe('path traversal prevention', () => {
    it('replaces forward slashes with underscore', () => {
      expect(sanitizeFilename('foo/bar')).toBe('foo_bar');
      expect(sanitizeFilename('a/b/c')).toBe('a_b_c');
    });

    it('replaces backslashes with underscore', () => {
      expect(sanitizeFilename('foo\\bar')).toBe('foo_bar');
      expect(sanitizeFilename('a\\b\\c')).toBe('a_b_c');
    });

    it('removes parent directory traversal sequences', () => {
      expect(sanitizeFilename('..')).toBe('unnamed');
      expect(sanitizeFilename('../../etc/passwd')).toBe('__etc_passwd');
      expect(sanitizeFilename('foo/../bar')).toBe('foo__bar');
    });

    it('removes nested traversal sequences', () => {
      expect(sanitizeFilename('....')).toBe('unnamed');
      expect(sanitizeFilename('.../.../etc')).toBe('_._etc');
    });
  });

  describe('null byte injection prevention', () => {
    it('removes null bytes', () => {
      expect(sanitizeFilename('file\0.txt')).toBe('file.txt');
      expect(sanitizeFilename('file\0\0\0.txt')).toBe('file.txt');
    });

    it('removes null bytes at various positions', () => {
      expect(sanitizeFilename('\0file')).toBe('file');
      expect(sanitizeFilename('file\0')).toBe('file');
    });
  });

  describe('control character filtering', () => {
    it('removes ASCII control characters (0x00-0x1F)', () => {
      expect(sanitizeFilename('file\x01\x02\x03.txt')).toBe('file.txt');
      expect(sanitizeFilename('file\x1f.txt')).toBe('file.txt');
    });

    it('removes DEL character (0x7F)', () => {
      expect(sanitizeFilename('file\x7f.txt')).toBe('file.txt');
    });

    it('preserves printable characters', () => {
      expect(sanitizeFilename('file-name_test.txt')).toBe('file-name_test.txt');
      expect(sanitizeFilename('report (final).pdf')).toBe('report (final).pdf');
    });
  });

  describe('hidden file prevention', () => {
    it('strips leading dots', () => {
      expect(sanitizeFilename('.bashrc')).toBe('bashrc');
      expect(sanitizeFilename('.env')).toBe('env');
      expect(sanitizeFilename('...secret')).toBe('secret');
    });

    it('preserves dots in the middle and end', () => {
      expect(sanitizeFilename('file.txt')).toBe('file.txt');
      expect(sanitizeFilename('my.report.pdf')).toBe('my.report.pdf');
    });
  });

  describe('whitespace handling', () => {
    it('trims leading and trailing whitespace', () => {
      expect(sanitizeFilename('  file.txt  ')).toBe('file.txt');
      expect(sanitizeFilename('\tfile.txt\n')).toBe('file.txt');
    });

    it('preserves internal spaces', () => {
      expect(sanitizeFilename('my file.txt')).toBe('my file.txt');
    });
  });

  describe('edge cases', () => {
    it('returns "unnamed" for empty string', () => {
      expect(sanitizeFilename('')).toBe('unnamed');
    });

    it('returns "unnamed" for whitespace-only string', () => {
      expect(sanitizeFilename('   ')).toBe('unnamed');
      expect(sanitizeFilename('\t\n')).toBe('unnamed');
    });

    it('returns "unnamed" when all characters are stripped', () => {
      expect(sanitizeFilename('..')).toBe('unnamed');
      expect(sanitizeFilename('\x01\x02')).toBe('unnamed');
      expect(sanitizeFilename('.')).toBe('unnamed');
    });

    it('handles unicode filenames', () => {
      expect(sanitizeFilename('音声ファイル.mp3')).toBe('音声ファイル.mp3');
      expect(sanitizeFilename('レポート.pdf')).toBe('レポート.pdf');
    });

    it('handles filenames with special characters', () => {
      expect(sanitizeFilename('file (1).txt')).toBe('file (1).txt');
      expect(sanitizeFilename('file@name.txt')).toBe('file@name.txt');
    });

    it('handles very long filenames', () => {
      const longName = 'a'.repeat(300) + '.txt';
      const result = sanitizeFilename(longName);
      expect(result).toBe(longName);
      expect(result.length).toBe(304);
    });
  });

  describe('combined attack vectors', () => {
    it('handles path traversal with null bytes', () => {
      expect(sanitizeFilename('..\0/../etc\0/passwd')).toBe('__etc_passwd');
    });

    it('handles control characters with path separators', () => {
      expect(sanitizeFilename('\x01/etc/\x02passwd')).toBe('_etc_passwd');
    });

    it('handles mixed separators', () => {
      expect(sanitizeFilename('foo/bar\\..\\baz')).toBe('foo_bar__baz');
    });

    it('handles null byte + hidden file combination', () => {
      // .\0./file -> remove null -> ../file -> / to _ -> .._file -> remove .. -> _file
      expect(sanitizeFilename('.\0./file')).toBe('_file');
    });
  });
});
