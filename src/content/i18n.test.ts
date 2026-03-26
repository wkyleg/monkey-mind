/**
 * Internationalization: locale JSON files and contentLoader string fallback
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { contentLoader } from './loader';

const STRINGS_DIR = resolve(process.cwd(), 'public/content/strings');

const LOCALES = ['en', 'es', 'pt', 'fr', 'de', 'ru', 'zh', 'ja', 'ko', 'vi', 'hi', 'bn', 'ta', 'ar'] as const;

const REQUIRED_UI_KEYS = [
  'title',
  'subtitle',
  'menu_new_game',
  'menu_continue',
  'menu_level_select',
  'pause_resume',
  'settings_title',
  'settings_language',
  'report_title',
  'campaign_level_complete',
  'victory_title',
  'codex_title',
  'hud_score',
  'hud_health',
] as const;

function readLocaleFile(locale: string): string {
  return readFileSync(resolve(STRINGS_DIR, `${locale}.json`), 'utf-8');
}

function parseLocale(locale: string): unknown {
  return JSON.parse(readLocaleFile(locale));
}

function getUiRecord(data: unknown): Record<string, string> {
  expect(data).toEqual(expect.any(Object));
  expect(data).not.toBeNull();
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('expected locale root object');
  }
  const rec = data as Record<string, unknown>;
  expect(rec.ui).toEqual(expect.any(Object));
  expect(rec.ui).not.toBeNull();
  const ui = rec.ui;
  if (typeof ui !== 'object' || ui === null || Array.isArray(ui)) {
    throw new Error('expected ui object');
  }
  const uiRec = ui as Record<string, unknown>;
  for (const v of Object.values(uiRec)) {
    expect(typeof v).toBe('string');
  }
  return uiRec as Record<string, string>;
}

function sortedKeyList(ui: Record<string, string>): string[] {
  return Object.keys(ui).sort();
}

describe('i18n locale files', () => {
  describe('en.json has all required UI keys', () => {
    it('includes the ui section and critical keys used by the app', () => {
      const ui = getUiRecord(parseLocale('en'));
      for (const key of REQUIRED_UI_KEYS) {
        expect(ui).toHaveProperty(key);
        expect(ui[key].length).toBeGreaterThan(0);
      }
    });
  });

  describe('all locale files have same keys as en.json', () => {
    it('each locale has a ui section matching en ui keys', () => {
      const enUi = getUiRecord(parseLocale('en'));
      const enKeys = sortedKeyList(enUi);

      for (const locale of LOCALES) {
        const ui = getUiRecord(parseLocale(locale));
        expect(sortedKeyList(ui), `${locale}.json ui keys should match en.json`).toEqual(enKeys);
      }
    });
  });

  describe('all locale files are valid JSON', () => {
    it.each([...LOCALES])('parses %s.json without error', (locale) => {
      expect(() => JSON.parse(readLocaleFile(locale))).not.toThrow();
    });
  });

  describe('getString fallback', () => {
    it('returns the key when no translation exists', () => {
      const missing = '__vitest_i18n_missing_string_key__';
      expect(contentLoader.getString(missing)).toBe(missing);
    });
  });
});
