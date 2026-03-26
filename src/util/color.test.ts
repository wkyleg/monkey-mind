/**
 * Color utilities tests
 */

import { describe, expect, it } from 'vitest';
import {
  adjustBrightness,
  colorFromPalette,
  glowColor,
  hexToRgb,
  hexToRgba,
  hslToRgb,
  lerpColor,
  palettes,
  rgba,
  rgbToHex,
  rgbToHsl,
} from './color';

describe('hexToRgb', () => {
  it('parses 6-digit hex with hash', () => {
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('parses uppercase and mixed case', () => {
    expect(hexToRgb('#00FF00')).toEqual({ r: 0, g: 255, b: 0 });
    expect(hexToRgb('#0000Ff')).toEqual({ r: 0, g: 0, b: 255 });
  });

  it('accepts optional hash', () => {
    expect(hexToRgb('808080')).toEqual({ r: 128, g: 128, b: 128 });
  });

  it('returns black for invalid hex', () => {
    expect(hexToRgb('not-a-color')).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb('#fff')).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe('rgbToHex', () => {
  it('converts known RGB to lowercase hex', () => {
    expect(rgbToHex(255, 0, 0)).toBe('#ff0000');
    expect(rgbToHex(0, 255, 0)).toBe('#00ff00');
    expect(rgbToHex(10, 20, 30)).toBe('#0a141e');
  });

  it('rounds fractional components', () => {
    expect(rgbToHex(127.4, 127.6, 128)).toBe('#7f8080');
  });
});

describe('rgbToHsl / hslToRgb', () => {
  it('maps pure red', () => {
    expect(rgbToHsl(255, 0, 0)).toEqual({ h: 0, s: 100, l: 50 });
  });

  it('maps white and black (achromatic)', () => {
    expect(rgbToHsl(255, 255, 255)).toMatchObject({ h: 0, s: 0, l: 100 });
    expect(rgbToHsl(0, 0, 0)).toMatchObject({ h: 0, s: 0, l: 0 });
  });

  it('round-trips a color through HSL', () => {
    const rgb = { r: 100, g: 150, b: 200 };
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const back = hslToRgb(hsl.h, hsl.s, hsl.l);
    expect(back.r).toBe(rgb.r);
    expect(back.g).toBe(rgb.g);
    expect(back.b).toBe(rgb.b);
  });

  it('hslToRgb maps gray when s=0', () => {
    expect(hslToRgb(123, 0, 50)).toEqual({ r: 128, g: 128, b: 128 });
  });
});

describe('lerpColor', () => {
  it('interpolates between hex colors', () => {
    expect(lerpColor('#000000', '#ffffff', 0)).toBe('#000000');
    expect(lerpColor('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(lerpColor('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('lerps red to blue at quarter', () => {
    expect(lerpColor('#ff0000', '#0000ff', 0.25)).toBe('#bf0040');
  });
});

describe('adjustBrightness', () => {
  it('shifts channels by percent of 255', () => {
    expect(adjustBrightness('#000000', 100)).toBe('#ffffff');
    expect(adjustBrightness('#ffffff', -100)).toBe('#000000');
  });

  it('clamps to [0, 255]', () => {
    expect(adjustBrightness('#808080', 200)).toBe('#ffffff');
    expect(adjustBrightness('#808080', -200)).toBe('#000000');
  });
});

describe('rgba', () => {
  it('formats CSS rgba string with rounded channels', () => {
    expect(rgba(255, 128, 0, 0.5)).toBe('rgba(255, 128, 0, 0.5)');
    expect(rgba(10.2, 20.8, 30, 1)).toBe('rgba(10, 21, 30, 1)');
  });
});

describe('hexToRgba', () => {
  it('combines hex parse with alpha', () => {
    expect(hexToRgba('#00ff00', 0.25)).toBe('rgba(0, 255, 0, 0.25)');
  });
});

describe('glowColor', () => {
  it('returns a hex string', () => {
    const out = glowColor('#336699', 1);
    expect(out).toMatch(/^#[0-9a-f]{6}$/);
    expect(out).not.toBe('#336699');
  });

  it('uses default intensity', () => {
    expect(() => glowColor('#000000')).not.toThrow();
  });
});

describe('colorFromPalette', () => {
  it('returns black for empty palette', () => {
    expect(colorFromPalette([], 0.5)).toBe('#000000');
  });

  it('returns sole color when length is 1', () => {
    expect(colorFromPalette(['#abcdef'], 0)).toBe('#abcdef');
    expect(colorFromPalette(['#abcdef'], 0.99)).toBe('#abcdef');
  });

  it('lerps between endpoints when loop is true', () => {
    const p = ['#000000', '#ffffff'];
    expect(colorFromPalette(p, 0, true)).toBe('#000000');
    // t=1 is wrapped with % 1 to 0, same as first swatch
    expect(colorFromPalette(p, 1, true)).toBe('#000000');
    expect(colorFromPalette(p, 0.5, true)).toBe('#808080');
    expect(colorFromPalette(p, 0.996, true)).toBe('#fefefe');
  });

  it('wraps t when loop is true', () => {
    const p = ['#000000', '#ffffff'];
    expect(colorFromPalette(p, 1.25, true)).toBe(colorFromPalette(p, 0.25, true));
  });

  it('clamps t when loop is false', () => {
    const p = ['#000000', '#ffffff'];
    expect(colorFromPalette(p, -1, false)).toBe('#000000');
    expect(colorFromPalette(p, 2, false)).toBe('#ffffff');
  });
});

describe('palettes', () => {
  it('exports non-empty hex arrays', () => {
    for (const [, colors] of Object.entries(palettes)) {
      expect(colors.length).toBeGreaterThan(0);
      for (const c of colors) {
        expect(c).toMatch(/^#[0-9a-f]{6}$/i);
      }
      expect(colorFromPalette(colors, 0)).toBe(colors[0]);
    }
  });
});
