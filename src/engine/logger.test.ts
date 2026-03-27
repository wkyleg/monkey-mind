import { beforeEach, describe, expect, it } from 'vitest';
import logger from './logger';

describe('logger', () => {
  beforeEach(() => {
    logger.clear();
    logger.setLevel('DEBUG');
  });

  describe('level control', () => {
    it('respects setLevel(INFO) by filtering DEBUG entries', () => {
      logger.setLevel('INFO');
      logger.debug('test', 'debug-msg');
      logger.info('test', 'info-msg');
      const logs = logger.getLogs();
      expect(logs.some((l) => l.level === 'DEBUG')).toBe(false);
      expect(logs.some((l) => l.level === 'INFO')).toBe(true);
    });

    it('setDebugEnabled(false) switches to INFO', () => {
      logger.setDebugEnabled(false);
      logger.debug('test', 'd');
      logger.info('test', 'i');
      const logs = logger.getLogs();
      expect(logger.getLevel()).toBe('INFO');
      expect(logs.some((l) => l.level === 'DEBUG')).toBe(false);
      expect(logs.some((l) => l.level === 'INFO')).toBe(true);
    });

    it('setDebugEnabled(true) switches to DEBUG', () => {
      logger.setLevel('WARN');
      logger.setDebugEnabled(true);
      expect(logger.getLevel()).toBe('DEBUG');
    });

    it('logs all levels when set to DEBUG', () => {
      logger.debug('src', 'debug');
      logger.info('src', 'info');
      logger.warn('src', 'warn');
      logger.error('src', 'error');
      const logs = logger.getLogs();
      expect(logs).toHaveLength(4);
      expect(logs.map((l) => l.level)).toEqual(['DEBUG', 'INFO', 'WARN', 'ERROR']);
    });

    it('only logs WARN and ERROR when set to WARN', () => {
      logger.setLevel('WARN');
      logger.debug('src', 'd');
      logger.info('src', 'i');
      logger.warn('src', 'w');
      logger.error('src', 'e');
      const logs = logger.getLogs();
      expect(logs).toHaveLength(2);
      expect(logs.map((l) => l.level)).toEqual(['WARN', 'ERROR']);
    });

    it('rejects invalid level values', () => {
      logger.setLevel('INFO');
      logger.setLevel('BOGUS' as any);
      expect(logger.getLevel()).toBe('INFO');
    });
  });

  describe('buffer management', () => {
    it('clear() empties the log buffer', () => {
      logger.info('src', 'msg');
      expect(logger.getLogs()).toHaveLength(1);
      logger.clear();
      expect(logger.getLogs()).toHaveLength(0);
    });

    it('getLogs() returns a copy of the buffer', () => {
      logger.info('src', 'msg');
      const logs1 = logger.getLogs();
      const logs2 = logger.getLogs();
      expect(logs1).toEqual(logs2);
      expect(logs1).not.toBe(logs2);
    });

    it('caps buffer at MAX_ENTRIES (5000)', () => {
      for (let i = 0; i < 5050; i++) {
        logger.debug('test', `msg-${i}`);
      }
      const logs = logger.getLogs();
      expect(logs.length).toBeLessThanOrEqual(5000);
      expect(logs[logs.length - 1].msg).toBe('msg-5049');
    });
  });

  describe('log entry structure', () => {
    it('includes timestamp, level, source, and message', () => {
      logger.info('MySource', 'hello');
      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      const entry = logs[0];
      expect(entry.level).toBe('INFO');
      expect(entry.source).toBe('MySource');
      expect(entry.msg).toBe('hello');
      expect(typeof entry.ts).toBe('number');
      expect(entry.ts).toBeGreaterThan(0);
    });

    it('stores metadata when provided', () => {
      const meta = { count: 42, items: ['a'] };
      logger.warn('src', 'with meta', meta);
      const logs = logger.getLogs();
      expect(logs[0].meta).toEqual(meta);
    });

    it('omits metadata when not provided', () => {
      logger.info('src', 'no meta');
      const logs = logger.getLogs();
      expect(logs[0].meta).toBeUndefined();
    });

    it('allows undefined source', () => {
      logger.info(undefined, 'no source');
      const logs = logger.getLogs();
      expect(logs[0].source).toBeUndefined();
    });
  });
});
