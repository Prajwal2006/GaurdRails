import { describe, expect, it } from 'vitest';
import { hasExtension, matchGlob } from './glob.js';

describe('matchGlob', () => {
  it('* matches within a single segment', () => {
    expect(matchGlob('*.ts', 'index.ts')).toBe(true);
    expect(matchGlob('*.ts', 'index.js')).toBe(false);
    expect(matchGlob('src/*.ts', 'src/index.ts')).toBe(true);
    expect(matchGlob('src/*.ts', 'src/deep/index.ts')).toBe(false);
  });

  it('** matches across segments', () => {
    expect(matchGlob('src/**/*.ts', 'src/index.ts')).toBe(true);
    expect(matchGlob('src/**/*.ts', 'src/a/b/c.ts')).toBe(true);
    expect(matchGlob('config/**', 'config/a/b.json')).toBe(true);
  });

  it('? matches a single character', () => {
    expect(matchGlob('file?.txt', 'file1.txt')).toBe(true);
    expect(matchGlob('file?.txt', 'file12.txt')).toBe(false);
  });

  it('a slash-less glob also matches the basename', () => {
    expect(matchGlob('*.env', 'config/.env')).toBe(true);
    expect(matchGlob('.env', 'project/.env')).toBe(true);
  });

  it('escapes regex metacharacters literally', () => {
    expect(matchGlob('a.b', 'a.b')).toBe(true);
    expect(matchGlob('a.b', 'axb')).toBe(false);
  });
});

describe('hasExtension', () => {
  it('matches normal extensions', () => {
    expect(hasExtension('server.pem', 'pem')).toBe(true);
    expect(hasExtension('server.pem', '.pem')).toBe(true);
    expect(hasExtension('a.tfvars', 'tfvars')).toBe(true);
    expect(hasExtension('a.tfvars', 'json')).toBe(false);
  });

  it('treats dotfiles as having an extension', () => {
    expect(hasExtension('.env', 'env')).toBe(true);
    expect(hasExtension('path/.env', 'env')).toBe(true);
  });

  it('returns false when there is no extension', () => {
    expect(hasExtension('Makefile', 'mk')).toBe(false);
  });
});
