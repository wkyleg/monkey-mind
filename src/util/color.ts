/**
 * Color manipulation utilities
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface RGBA extends RGB {
  a: number;
}

export interface HSL {
  h: number;
  s: number;
  l: number;
}

/**
 * Parse a hex color string to RGB
 */
export function hexToRgb(hex: string): RGB {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Convert RGB to hex string
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Convert RGB to HSL
 */
export function rgbToHsl(r: number, g: number, b: number): HSL {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Convert HSL to RGB
 */
export function hslToRgb(h: number, s: number, l: number): RGB {
  h /= 360;
  s /= 100;
  l /= 100;

  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/**
 * Lerp between two colors
 */
export function lerpColor(color1: string, color2: string, t: number): string {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);

  return rgbToHex(c1.r + (c2.r - c1.r) * t, c1.g + (c2.g - c1.g) * t, c1.b + (c2.b - c1.b) * t);
}

/**
 * Adjust color brightness
 */
export function adjustBrightness(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  return rgbToHex(
    Math.min(255, Math.max(0, rgb.r + (255 * percent) / 100)),
    Math.min(255, Math.max(0, rgb.g + (255 * percent) / 100)),
    Math.min(255, Math.max(0, rgb.b + (255 * percent) / 100)),
  );
}

/**
 * Create an RGBA string
 */
export function rgba(r: number, g: number, b: number, a: number): string {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
}

/**
 * Create an RGBA string from hex
 */
export function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgba(r, g, b, alpha);
}

/**
 * Create a glow color (same color but more saturated/bright)
 */
export function glowColor(hex: string, intensity: number = 1): string {
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  // Increase saturation and lightness for glow
  hsl.s = Math.min(100, hsl.s + 20 * intensity);
  hsl.l = Math.min(100, hsl.l + 10 * intensity);

  const glowRgb = hslToRgb(hsl.h, hsl.s, hsl.l);
  return rgbToHex(glowRgb.r, glowRgb.g, glowRgb.b);
}

/**
 * Generate a color from a palette based on t (0-1)
 */
export function colorFromPalette(palette: string[], t: number, loop: boolean = true): string {
  if (palette.length === 0) return '#000000';
  if (palette.length === 1) return palette[0];

  if (loop) {
    t = t % 1;
  } else {
    t = Math.max(0, Math.min(1, t));
  }

  const index = t * (palette.length - 1);
  const lower = Math.floor(index);
  const upper = Math.min(lower + 1, palette.length - 1);
  const blend = index - lower;

  return lerpColor(palette[lower], palette[upper], blend);
}

// Predefined palettes
export const palettes = {
  neon: ['#00ffaa', '#00aaff', '#aa00ff', '#ff00aa', '#ffaa00'],
  calm: ['#0066ff', '#00aaff', '#00ffff', '#00ffaa'],
  passion: ['#ff0066', '#ff3300', '#ff6600', '#ffaa00'],
  neural: ['#1a1a2e', '#16213e', '#0f3460', '#e94560'],
  cosmic: ['#0a0a0f', '#1a1a2e', '#533483', '#e94560', '#f0a500'],
  dmt: ['#ff00ff', '#00ffff', '#ffff00', '#ff0066', '#00ff66'],
};
