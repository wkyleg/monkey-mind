/**
 * Canvas 2D renderer with procedural graphics support
 */

import { CONFIG } from '../config';
import { hexToRgba } from '../util/color';

export interface DrawOptions {
  alpha?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  originX?: number;
  originY?: number;
}

export class Renderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  
  private cameraX: number = 0;
  private cameraY: number = 0;
  private cameraScale: number = 1;
  
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }
    this.ctx = ctx;
    
    // Default settings
    this.ctx.imageSmoothingEnabled = false;
  }
  
  get width(): number {
    return this.canvas.width;
  }
  
  get height(): number {
    return this.canvas.height;
  }
  
  get context(): CanvasRenderingContext2D {
    return this.ctx;
  }
  
  // Camera
  
  setCamera(x: number, y: number, scale: number = 1): void {
    this.cameraX = x;
    this.cameraY = y;
    this.cameraScale = scale;
  }
  
  resetCamera(): void {
    this.cameraX = 0;
    this.cameraY = 0;
    this.cameraScale = 1;
  }
  
  worldToScreen(x: number, y: number): { x: number; y: number } {
    return {
      x: (x - this.cameraX) * this.cameraScale,
      y: (y - this.cameraY) * this.cameraScale,
    };
  }
  
  screenToWorld(x: number, y: number): { x: number; y: number } {
    return {
      x: x / this.cameraScale + this.cameraX,
      y: y / this.cameraScale + this.cameraY,
    };
  }
  
  // Basic drawing
  
  clear(color?: string): void {
    if (color) {
      this.ctx.fillStyle = color;
      this.ctx.fillRect(0, 0, this.width, this.height);
    } else {
      this.ctx.clearRect(0, 0, this.width, this.height);
    }
  }
  
  fillRect(x: number, y: number, w: number, h: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
  }
  
  strokeRect(x: number, y: number, w: number, h: number, color: string, lineWidth: number = 1): void {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.strokeRect(x, y, w, h);
  }
  
  fillCircle(x: number, y: number, radius: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fill();
  }
  
  strokeCircle(x: number, y: number, radius: number, color: string, lineWidth: number = 1): void {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.stroke();
  }
  
  line(x1: number, y1: number, x2: number, y2: number, color: string, lineWidth: number = 1): void {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
  }
  
  // Procedural neon graphics
  
  glowCircle(x: number, y: number, radius: number, color: string, glowSize: number = 10): void {
    // Outer glow
    const gradient = this.ctx.createRadialGradient(x, y, radius * 0.5, x, y, radius + glowSize);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.5, hexToRgba(color, 0.5));
    gradient.addColorStop(1, hexToRgba(color, 0));
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius + glowSize, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Core
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fill();
  }
  
  glowRect(x: number, y: number, w: number, h: number, color: string, glowSize: number = 10): void {
    // Shadow glow
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = glowSize;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
    this.ctx.shadowBlur = 0;
  }
  
  neonLine(x1: number, y1: number, x2: number, y2: number, color: string, width: number = 2): void {
    // Outer glow
    this.ctx.strokeStyle = hexToRgba(color, 0.3);
    this.ctx.lineWidth = width + 6;
    this.ctx.lineCap = 'round';
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
    
    // Middle glow
    this.ctx.strokeStyle = hexToRgba(color, 0.6);
    this.ctx.lineWidth = width + 3;
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
    
    // Core
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
  }
  
  // Gradient background
  
  gradientBackground(colors: string[], angle: number = 0): void {
    const radians = angle * Math.PI / 180;
    const length = Math.sqrt(this.width * this.width + this.height * this.height);
    const dx = Math.cos(radians) * length / 2;
    const dy = Math.sin(radians) * length / 2;
    const cx = this.width / 2;
    const cy = this.height / 2;
    
    const gradient = this.ctx.createLinearGradient(
      cx - dx, cy - dy,
      cx + dx, cy + dy
    );
    
    colors.forEach((color, i) => {
      gradient.addColorStop(i / (colors.length - 1), color);
    });
    
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }
  
  radialGradientBackground(colors: string[], centerX?: number, centerY?: number): void {
    const cx = centerX ?? this.width / 2;
    const cy = centerY ?? this.height / 2;
    const radius = Math.max(this.width, this.height);
    
    const gradient = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    
    colors.forEach((color, i) => {
      gradient.addColorStop(i / (colors.length - 1), color);
    });
    
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }
  
  // Text
  
  text(
    text: string,
    x: number,
    y: number,
    color: string,
    size: number = 16,
    align: CanvasTextAlign = 'left',
    baseline: CanvasTextBaseline = 'top',
    font: string = "'SF Mono', Consolas, 'Liberation Mono', monospace"
  ): void {
    this.ctx.fillStyle = color;
    this.ctx.font = `${size}px ${font}`;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = baseline;
    this.ctx.fillText(text, x, y);
  }
  
  /**
   * Clean monospace HUD text - no glow, cyberpunk style
   */
  hudText(
    text: string,
    x: number,
    y: number,
    color: string,
    size: number = 16,
    align: CanvasTextAlign = 'left'
  ): void {
    this.ctx.font = `${size}px 'SF Mono', Consolas, 'Liberation Mono', monospace`;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = color;
    this.ctx.fillText(text, x, y);
  }
  
  glowText(
    text: string,
    x: number,
    y: number,
    color: string,
    size: number = 16,
    align: CanvasTextAlign = 'center',
    glowSize: number = 8  // Reduced from 10 for sharper look
  ): void {
    this.ctx.font = `${size}px 'SF Mono', Consolas, 'Liberation Mono', monospace`;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = 'middle';
    
    // Sharp glow (reduced blur)
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = Math.min(glowSize, 12);  // Cap glow for cleaner look
    this.ctx.fillStyle = color;
    this.ctx.fillText(text, x, y);
    
    this.ctx.shadowBlur = 0;
  }
  
  /**
   * Draw angular cyberpunk frame corners
   */
  drawAngularFrame(
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    cornerSize: number = 15
  ): void {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1.5;
    this.ctx.lineCap = 'square';
    
    // Top-left corner
    this.ctx.beginPath();
    this.ctx.moveTo(x, y + cornerSize);
    this.ctx.lineTo(x, y);
    this.ctx.lineTo(x + cornerSize, y);
    this.ctx.stroke();
    
    // Top-right corner
    this.ctx.beginPath();
    this.ctx.moveTo(x + w - cornerSize, y);
    this.ctx.lineTo(x + w, y);
    this.ctx.lineTo(x + w, y + cornerSize);
    this.ctx.stroke();
    
    // Bottom-left corner
    this.ctx.beginPath();
    this.ctx.moveTo(x, y + h - cornerSize);
    this.ctx.lineTo(x, y + h);
    this.ctx.lineTo(x + cornerSize, y + h);
    this.ctx.stroke();
    
    // Bottom-right corner
    this.ctx.beginPath();
    this.ctx.moveTo(x + w - cornerSize, y + h);
    this.ctx.lineTo(x + w, y + h);
    this.ctx.lineTo(x + w, y + h - cornerSize);
    this.ctx.stroke();
  }
  
  /**
   * Draw subtle scan line overlay
   */
  drawScanLines(alpha: number = 0.03, spacing: number = 3): void {
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = '#000000';
    
    for (let y = 0; y < this.height; y += spacing) {
      this.ctx.fillRect(0, y, this.width, 1);
    }
    
    this.ctx.restore();
  }
  
  /**
   * Draw SVG image to canvas
   */
  drawSvg(img: HTMLImageElement, x: number, y: number, w: number, h: number): void {
    this.ctx.drawImage(img, x, y, w, h);
  }
  
  /**
   * Draw tech readout decoration (small data line)
   */
  drawTechReadout(x: number, y: number, w: number, color: string): void {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1;
    this.ctx.globalAlpha = 0.5;
    
    // Main line
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(x + w, y);
    this.ctx.stroke();
    
    // Small tick marks
    const tickCount = Math.floor(w / 20);
    for (let i = 0; i <= tickCount; i++) {
      const tx = x + (i / tickCount) * w;
      const tickHeight = i % 2 === 0 ? 4 : 2;
      this.ctx.beginPath();
      this.ctx.moveTo(tx, y);
      this.ctx.lineTo(tx, y + tickHeight);
      this.ctx.stroke();
    }
    
    this.ctx.globalAlpha = 1;
  }
  
  // Debug
  
  drawFps(fps: number): void {
    this.ctx.fillStyle = CONFIG.COLORS.TEXT_DIM;
    this.ctx.font = "10px 'SF Mono', Consolas, monospace";
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'bottom';
    this.ctx.fillText(`FPS: ${fps}`, 10, this.height - 10);
  }
  
  drawHitbox(x: number, y: number, radius: number): void {
    this.ctx.strokeStyle = '#ff0000';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([2, 2]);
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }
  
  // State management
  
  save(): void {
    this.ctx.save();
  }
  
  restore(): void {
    this.ctx.restore();
  }
  
  translate(x: number, y: number): void {
    this.ctx.translate(x, y);
  }
  
  rotate(angle: number): void {
    this.ctx.rotate(angle);
  }
  
  scale(x: number, y: number): void {
    this.ctx.scale(x, y);
  }
  
  setAlpha(alpha: number): void {
    this.ctx.globalAlpha = alpha;
  }
  
  resetAlpha(): void {
    this.ctx.globalAlpha = 1;
  }
  
  setBlendMode(mode: GlobalCompositeOperation): void {
    this.ctx.globalCompositeOperation = mode;
  }
  
  resetBlendMode(): void {
    this.ctx.globalCompositeOperation = 'source-over';
  }
}
