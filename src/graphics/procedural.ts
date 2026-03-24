/**
 * Procedural graphics utilities
 */

import type { Renderer } from '../engine/renderer';
import { hexToRgba } from '../util/color';

/**
 * Draw a pulsing glow effect
 */
export function drawPulsingGlow(
  renderer: Renderer,
  x: number,
  y: number,
  baseRadius: number,
  color: string,
  time: number,
  pulseSpeed: number = 2,
  pulseAmount: number = 0.2,
): void {
  const pulse = Math.sin(time * pulseSpeed * Math.PI) * pulseAmount;
  const radius = baseRadius * (1 + pulse);
  renderer.glowCircle(x, y, radius, color, radius * 0.5);
}

/**
 * Draw a rotating ring
 */
export function drawRotatingRing(
  renderer: Renderer,
  x: number,
  y: number,
  radius: number,
  color: string,
  time: number,
  segments: number = 4,
  rotationSpeed: number = 1,
): void {
  const ctx = renderer.context;
  const angle = time * rotationSpeed;
  const segmentAngle = (Math.PI * 2) / segments;
  const gapAngle = segmentAngle * 0.2;

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';

  for (let i = 0; i < segments; i++) {
    const startAngle = angle + i * segmentAngle + gapAngle / 2;
    const endAngle = startAngle + segmentAngle - gapAngle;

    ctx.beginPath();
    ctx.arc(x, y, radius, startAngle, endAngle);
    ctx.stroke();
  }
}

/**
 * Draw a starburst pattern
 */
export function drawStarburst(
  renderer: Renderer,
  x: number,
  y: number,
  innerRadius: number,
  outerRadius: number,
  color: string,
  points: number = 8,
  time: number = 0,
  rotationSpeed: number = 0.5,
): void {
  const ctx = renderer.context;
  const angle = time * rotationSpeed;
  const pointAngle = (Math.PI * 2) / points;

  ctx.fillStyle = color;
  ctx.beginPath();

  for (let i = 0; i < points * 2; i++) {
    const currentAngle = angle + i * (pointAngle / 2);
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const px = x + Math.cos(currentAngle) * radius;
    const py = y + Math.sin(currentAngle) * radius;

    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }

  ctx.closePath();
  ctx.fill();
}

/**
 * Draw electric arc between two points
 */
export function drawElectricArc(
  renderer: Renderer,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  segments: number = 8,
  amplitude: number = 20,
  time: number = 0,
): void {
  const ctx = renderer.context;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const angle = Math.atan2(dy, dx);
  const perpAngle = angle + Math.PI / 2;

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Glow
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;

  ctx.beginPath();
  ctx.moveTo(x1, y1);

  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const baseX = x1 + dx * t;
    const baseY = y1 + dy * t;

    // Random offset perpendicular to line
    const offset = (Math.sin(time * 20 + i * 5) + Math.random() - 0.5) * amplitude;
    const px = baseX + Math.cos(perpAngle) * offset;
    const py = baseY + Math.sin(perpAngle) * offset;

    ctx.lineTo(px, py);
  }

  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.shadowBlur = 0;
}

/**
 * Draw hexagon
 */
export function drawHexagon(
  renderer: Renderer,
  x: number,
  y: number,
  radius: number,
  color: string,
  fill: boolean = true,
  rotation: number = 0,
): void {
  const ctx = renderer.context;
  const sides = 6;
  const angleStep = (Math.PI * 2) / sides;

  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = rotation + i * angleStep - Math.PI / 2;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;

    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();

  if (fill) {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

/**
 * Draw a gradient beam
 */
export function drawBeam(
  renderer: Renderer,
  x: number,
  yStart: number,
  yEnd: number,
  width: number,
  color: string,
  alpha: number = 1,
): void {
  const ctx = renderer.context;

  const gradient = ctx.createLinearGradient(x, yStart, x, yEnd);
  gradient.addColorStop(0, hexToRgba(color, alpha));
  gradient.addColorStop(0.5, hexToRgba(color, alpha * 0.5));
  gradient.addColorStop(1, hexToRgba(color, 0));

  ctx.fillStyle = gradient;
  ctx.fillRect(x - width / 2, yEnd, width, yStart - yEnd);

  // Core
  const coreGradient = ctx.createLinearGradient(x, yStart, x, yEnd);
  coreGradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
  coreGradient.addColorStop(1, `rgba(255, 255, 255, 0)`);

  ctx.fillStyle = coreGradient;
  ctx.fillRect(x - width / 4, yEnd, width / 2, yStart - yEnd);
}

/**
 * Draw scan lines effect
 */
export function drawScanLines(
  renderer: Renderer,
  width: number,
  height: number,
  lineSpacing: number = 4,
  alpha: number = 0.1,
): void {
  const ctx = renderer.context;

  ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;

  for (let y = 0; y < height; y += lineSpacing) {
    ctx.fillRect(0, y, width, 1);
  }
}

/**
 * Draw vignette effect
 */
export function drawVignette(renderer: Renderer, width: number, height: number, intensity: number = 0.5): void {
  const ctx = renderer.context;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.max(width, height) * 0.7;

  const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.5, centerX, centerY, radius);

  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, `rgba(0, 0, 0, ${intensity})`);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}
