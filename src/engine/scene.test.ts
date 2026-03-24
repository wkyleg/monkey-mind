import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerIntent } from './input';
import type { Renderer } from './renderer';
import { Scene, SceneManager } from './scene';

vi.mock('./game', () => ({}));

const mockGame = {} as any;

class MockScene extends Scene {
  entered = false;
  exited = false;
  paused = false;
  resumed = false;

  constructor(
    game: typeof mockGame,
    readonly label: string = '',
  ) {
    super(game);
  }

  enter(): void {
    this.entered = true;
  }

  exit(): void {
    this.exited = true;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.resumed = true;
  }

  update(_dt: number, _intent: PlayerIntent): void {}

  render(_renderer: Renderer, _alpha: number): void {}
}

describe('SceneManager', () => {
  let manager: SceneManager;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    manager = new SceneManager();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('register and push enters first scene; second push pauses previous and enters new', () => {
    const a = new MockScene(mockGame, 'a');
    const b = new MockScene(mockGame, 'b');
    manager.register('a', a);
    manager.register('b', b);

    manager.push('a');
    expect(a.entered).toBe(true);
    expect(a.paused).toBe(false);
    expect(manager.depth()).toBe(1);
    expect(manager.current()).toBe(a);

    manager.push('b');
    expect(a.paused).toBe(true);
    expect(b.entered).toBe(true);
    expect(manager.depth()).toBe(2);
    expect(manager.current()).toBe(b);
  });

  it('pop exits top scene and resumes previous; cannot pop last scene', () => {
    const a = new MockScene(mockGame, 'a');
    const b = new MockScene(mockGame, 'b');
    manager.register('a', a);
    manager.register('b', b);
    manager.push('a');
    manager.push('b');

    const popped = manager.pop();
    expect(popped).toBe(b);
    expect(b.exited).toBe(true);
    expect(a.resumed).toBe(true);
    expect(manager.depth()).toBe(1);
    expect(manager.current()).toBe(a);

    const lastPop = manager.pop();
    expect(lastPop).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith('Cannot pop the last scene');
    expect(manager.depth()).toBe(1);
  });

  it('replace exits current and enters replacement with depth 1', () => {
    const a = new MockScene(mockGame, 'a');
    const b = new MockScene(mockGame, 'b');
    manager.register('a', a);
    manager.register('b', b);
    manager.push('a');

    manager.replace('b');

    expect(a.exited).toBe(true);
    expect(b.entered).toBe(true);
    expect(manager.depth()).toBe(1);
    expect(manager.current()).toBe(b);
  });

  it('goto exits all stacked scenes and leaves a single new current scene', () => {
    const a = new MockScene(mockGame, 'a');
    const b = new MockScene(mockGame, 'b');
    const c = new MockScene(mockGame, 'c');
    manager.register('a', a);
    manager.register('b', b);
    manager.register('c', c);
    manager.push('a');
    manager.push('b');

    manager.goto('c');

    expect(b.exited).toBe(true);
    expect(a.exited).toBe(true);
    expect(c.entered).toBe(true);
    expect(manager.depth()).toBe(1);
    expect(manager.current()).toBe(c);
  });

  it('setContext, getContext, and clearContext store generic data', () => {
    manager.setContext('score', 1200);
    expect(manager.getContext<number>('score')).toBe(1200);
    manager.clearContext('score');
    expect(manager.getContext('score')).toBeUndefined();
  });

  it('pushBoss sets boss context and pushes boss scene; getBossContext returns it', () => {
    const gameplay = new MockScene(mockGame, 'game');
    const boss = new MockScene(mockGame, 'boss');
    manager.register('game', gameplay);
    manager.register('boss', boss);
    manager.push('game');

    manager.pushBoss('dragon-1', gameplay);

    expect(manager.getBossContext()).toEqual({ bossId: 'dragon-1', returnScene: gameplay });
    expect(manager.current()).toBe(boss);
    expect(gameplay.paused).toBe(true);
  });

  it('depth reflects stack length', () => {
    const a = new MockScene(mockGame, 'a');
    const b = new MockScene(mockGame, 'b');
    manager.register('a', a);
    manager.register('b', b);
    expect(manager.depth()).toBe(0);
    manager.push('a');
    expect(manager.depth()).toBe(1);
    manager.push('b');
    expect(manager.depth()).toBe(2);
  });
});
