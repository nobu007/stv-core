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

    it('truncates very long filenames to 255 characters (filesystem limit)', () => {
      const longName = 'a'.repeat(300) + '.txt';
      const result = sanitizeFilename(longName);
      expect(result.length).toBe(255);
      expect(result).toBe('a'.repeat(255));
    });

    it('preserves filenames under 255 characters', () => {
      const name = 'b'.repeat(250) + '.txt';
      const result = sanitizeFilename(name);
      expect(result.length).toBe(254);
      expect(result).toBe(name);
    });

    it('truncates exactly at 255 characters', () => {
      const name = 'x'.repeat(300);
      const result = sanitizeFilename(name);
      expect(result.length).toBe(255);
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

  describe('Unicode directional override removal', () => {
    it('removes RTL override character (U+202E)', () => {
      const malicious = 'file\u202etxt';
      expect(sanitizeFilename(malicious)).toBe('filetxt');
    });

    it('removes LTR override character (U+202D)', () => {
      const malicious = 'file\u202dtxt';
      expect(sanitizeFilename(malicious)).toBe('filetxt');
    });

    it('removes directional isolate characters', () => {
      expect(sanitizeFilename('a\u202cb')).toBe('ab');
      expect(sanitizeFilename('a\u202db')).toBe('ab');
    });

    it('removes RLM and LRM marks (U+200E, U+200F)', () => {
      expect(sanitizeFilename('safe\u200e.exe')).toBe('safe.exe');
      expect(sanitizeFilename('safe\u200f.exe')).toBe('safe.exe');
    });

    it('removes BOM / zero-width no-break space (U+FEFF)', () => {
      expect(sanitizeFilename('\ufefffile.txt')).toBe('file.txt');
    });

    it('removes multiple override characters', () => {
      const malicious = '\u202e\u202d\u200f\u200e\ufefffile';
      expect(sanitizeFilename(malicious)).toBe('file');
    });

    it('prevents filename spoofing attack (evil.exe disguised as file.txt)', () => {
      // U+202E reverses display: "txt\u202Efile.exe" displays as "txt‮file.exe"
      // but actually opens as an executable
      const spoofed = 'txt\u202efile.exe';
      const result = sanitizeFilename(spoofed);
      expect(result).not.toContain('\u202e');
      expect(result).toBe('txtfile.exe');
    });
  });
});
