import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config', () => ({
  CONFIG: { CANVAS_WIDTH: 1280, CANVAS_HEIGHT: 720 },
}));

vi.mock('../util/math', () => ({
  clamp: (val: number, min: number, max: number) => Math.min(Math.max(val, min), max),
  lerp: (a: number, b: number, t: number) => a + (b - a) * t,
}));

import { Camera } from './camera';

describe('Camera', () => {
  let randomSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    randomSpy.mockRestore();
  });

  it('constructs with reset defaults (canvas center, scale 1, no shake)', () => {
    const camera = new Camera();
    expect(camera.x).toBe(640);
    expect(camera.y).toBe(360);
    expect(camera.targetX).toBe(640);
    expect(camera.targetY).toBe(360);
    expect(camera.scale).toBe(1);
    expect(camera.targetScale).toBe(1);
    expect(camera.shakeIntensity).toBe(0);
    expect(camera.shakeOffsetX).toBe(0);
    expect(camera.shakeOffsetY).toBe(0);
  });

  it('reset() moves to canvas center and clears shake / scale targets', () => {
    const camera = new Camera();
    camera.setPosition(100, 200);
    camera.setScale(2, true);
    camera.shake(50);
    camera.shakeOffsetX = 12;
    camera.shakeOffsetY = -3;

    camera.reset();

    expect(camera.x).toBe(640);
    expect(camera.y).toBe(360);
    expect(camera.targetX).toBe(640);
    expect(camera.targetY).toBe(360);
    expect(camera.scale).toBe(1);
    expect(camera.targetScale).toBe(1);
    expect(camera.shakeIntensity).toBe(0);
    expect(camera.shakeOffsetX).toBe(0);
    expect(camera.shakeOffsetY).toBe(0);
  });

  it('setPosition clamps to bounds and syncs targets', () => {
    const camera = new Camera();
    camera.setBounds(0, 0, 100, 200);
    camera.setPosition(500, 500);
    expect(camera.x).toBe(100);
    expect(camera.y).toBe(200);
    expect(camera.targetX).toBe(100);
    expect(camera.targetY).toBe(200);
  });

  it('clearBounds() restores infinite bounds so position is not clamped', () => {
    const camera = new Camera();
    camera.setBounds(0, 0, 10, 20);
    camera.setPosition(5, 5);
    camera.clearBounds();
    camera.setPosition(500, 400);
    expect(camera.x).toBe(500);
    expect(camera.y).toBe(400);
  });

  it('setScale clamps target between 0.1 and 5; immediate applies scale', () => {
    const camera = new Camera();
    camera.setScale(0);
    expect(camera.targetScale).toBe(0.1);
    expect(camera.scale).toBe(1);

    camera.setScale(99, true);
    expect(camera.targetScale).toBe(5);
    expect(camera.scale).toBe(5);
  });

  it('shake stores max intensity; update decays intensity and clears offsets when below threshold', () => {
    const camera = new Camera();
    camera.shake(10);
    camera.shake(5);
    expect(camera.shakeIntensity).toBe(10);

    camera.update(0.016);
    expect(camera.shakeIntensity).toBeCloseTo(9, 5);
    expect(camera.shakeOffsetX).toBe(0);
    expect(camera.shakeOffsetY).toBe(0);

    camera.shakeIntensity = 0.05;
    camera.shakeOffsetX = 7;
    camera.shakeOffsetY = 8;
    camera.update(0.016);
    expect(camera.shakeIntensity).toBe(0);
    expect(camera.shakeOffsetX).toBe(0);
    expect(camera.shakeOffsetY).toBe(0);
  });

  it('getEffectivePosition adds shake offsets to position', () => {
    const camera = new Camera();
    camera.setPosition(100, 200);
    camera.shakeOffsetX = 3;
    camera.shakeOffsetY = -4;
    expect(camera.getEffectivePosition()).toEqual({ x: 103, y: 196 });
  });

  it('worldToScreen and screenToWorld round-trip when shake is zero', () => {
    const camera = new Camera();
    camera.setPosition(200, 300);
    camera.setScale(2, true);
    camera.shakeOffsetX = 0;
    camera.shakeOffsetY = 0;

    const world = { x: 450, y: 175 };
    const screen = camera.worldToScreen(world.x, world.y);
    const back = camera.screenToWorld(screen.x, screen.y);

    expect(back.x).toBeCloseTo(world.x, 10);
    expect(back.y).toBeCloseTo(world.y, 10);
  });

  it('isVisible respects visible bounds and margin', () => {
    const camera = new Camera();
    camera.setPosition(640, 360);
    camera.setScale(1, true);

    expect(camera.isVisible(640, 360)).toBe(true);
    expect(camera.isVisible(-1, 360)).toBe(false);
    expect(camera.isVisible(-1, 360, 2)).toBe(true);
  });

  it('isRectVisible detects overlap with visible rect', () => {
    const camera = new Camera();
    camera.setPosition(640, 360);
    camera.setScale(1, true);

    expect(camera.isRectVisible(0, 0, 50, 50)).toBe(true);
    expect(camera.isRectVisible(2000, 2000, 10, 10)).toBe(false);
    expect(camera.isRectVisible(1270, 0, 20, 20, 5)).toBe(true);
  });

  it('follow mirrors setTarget and update lerps toward target', () => {
    const camera = new Camera();
    camera.setPosition(0, 0);
    camera.follow(100, 0);
    expect(camera.targetX).toBe(100);
    expect(camera.targetY).toBe(0);

    camera.update(0.016);
    expect(camera.x).toBeCloseTo(10, 5);
    expect(camera.y).toBe(0);
  });
});
