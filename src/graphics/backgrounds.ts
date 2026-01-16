/**
 * Background rendering for different sectors
 * Enhanced with rich procedural effects
 */

import type { Renderer } from '../engine/renderer';

export type BackgroundType = 'neural_grid' | 'synaptic_reef' | 'pantheon' | 'black_ops' | 'fractal_bloom';

// Sector color palettes
export const SECTOR_PALETTES = {
  neural_grid: {
    bg1: '#0a0a1a',
    bg2: '#101830',
    bg3: '#0a1020',
    primary: '#00ffaa',
    secondary: '#00aaff',
    accent: '#66ffcc',
  },
  synaptic_reef: {
    bg1: '#001a33',
    bg2: '#003355',
    bg3: '#001122',
    primary: '#00ffcc',
    secondary: '#ff66aa',
    accent: '#66ffff',
  },
  pantheon: {
    bg1: '#1a0a2e',
    bg2: '#2a1050',
    bg3: '#150828',
    primary: '#ffcc00',
    secondary: '#ff00aa',
    accent: '#aa66ff',
  },
  black_ops: {
    bg1: '#000000',
    bg2: '#0a0a0a',
    bg3: '#050505',
    primary: '#00ff00',
    secondary: '#ff3300',
    accent: '#ffff00',
  },
  fractal_bloom: {
    bg1: '#0a0520',
    bg2: '#150a30',
    bg3: '#0a0015',
    primary: '#ff00ff',
    secondary: '#00ffff',
    accent: '#ffff00',
  },
};

/**
 * Neural grid background (Sector 1 - Clinical/Lab)
 * Features: Grid lines, circuit patterns, sterile blue, scrolling data
 */
export function drawNeuralGrid(
  renderer: Renderer,
  width: number,
  height: number,
  time: number
): void {
  const ctx = renderer.context;
  const palette = SECTOR_PALETTES.neural_grid;
  const gridSize = 50;
  const waveAmplitude = 4;
  
  // Base gradient with subtle pulse
  const pulseIntensity = 0.02 * Math.sin(time * 0.5);
  renderer.radialGradientBackground(
    [palette.bg1, palette.bg2, palette.bg3],
    width / 2,
    height / 2
  );
  
  ctx.save();
  
  // Scrolling binary data columns
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = palette.primary;
  ctx.font = "10px 'SF Mono', Consolas, monospace";
  
  for (let col = 0; col < 8; col++) {
    const x = (width / 8) * col + 30;
    const scrollOffset = (time * 80 + col * 200) % (height + 400);
    
    for (let row = 0; row < 30; row++) {
      const y = (scrollOffset + row * 16) % (height + 100) - 50;
      const char = Math.random() > 0.5 ? '1' : '0';
      ctx.fillText(char, x, y);
    }
  }
  
  // Main grid with wave distortion
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = palette.primary;
  ctx.lineWidth = 1;
  
  // Vertical lines with sine wave
  for (let x = 0; x < width + gridSize; x += gridSize) {
    ctx.beginPath();
    for (let y = 0; y <= height; y += 8) {
      const offset = Math.sin((y + time * 40) * 0.015) * waveAmplitude;
      const px = x + offset;
      if (y === 0) {
        ctx.moveTo(px, y);
      } else {
        ctx.lineTo(px, y);
      }
    }
    ctx.stroke();
  }
  
  // Horizontal lines with sine wave
  ctx.globalAlpha = 0.12;
  for (let y = 0; y < height + gridSize; y += gridSize) {
    ctx.beginPath();
    for (let x = 0; x <= width; x += 8) {
      const offset = Math.sin((x + time * 40) * 0.015) * waveAmplitude;
      const py = y + offset;
      if (x === 0) {
        ctx.moveTo(x, py);
      } else {
        ctx.lineTo(x, py);
      }
    }
    ctx.stroke();
  }
  
  // Circuit nodes at intersections
  ctx.fillStyle = palette.primary;
  for (let x = 0; x < width + gridSize; x += gridSize) {
    for (let y = 0; y < height + gridSize; y += gridSize) {
      const pulse = Math.sin(time * 2.5 + x * 0.008 + y * 0.008);
      const size = 2 + pulse * 1.5;
      ctx.globalAlpha = 0.15 + pulse * 0.15;
      
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  // Floating circuit pathways
  ctx.strokeStyle = palette.secondary;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.1;
  
  for (let i = 0; i < 4; i++) {
    const startY = height * 0.2 + i * height * 0.2;
    ctx.beginPath();
    ctx.moveTo(0, startY);
    
    let x = 0;
    let y = startY;
    while (x < width) {
      const segmentLength = 30 + Math.random() * 50;
      const direction = Math.random() > 0.5 ? 1 : -1;
      
      if (Math.random() > 0.6) {
        // Vertical segment
        y += direction * 20;
        ctx.lineTo(x, y);
      }
      x += segmentLength;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  
  // Scan line effect
  ctx.globalAlpha = 0.04 + pulseIntensity;
  ctx.fillStyle = palette.accent;
  const scanY = (time * 150) % (height * 2);
  ctx.fillRect(0, scanY - height, width, 2);
  
  ctx.restore();
}

/**
 * Synaptic reef background (Sector 2 - Underwater/Organic)
 * Features: Flowing currents, bioluminescence, coral-like neurons
 */
export function drawSynapticReef(
  renderer: Renderer,
  width: number,
  height: number,
  time: number
): void {
  const ctx = renderer.context;
  const palette = SECTOR_PALETTES.synaptic_reef;
  
  // Deep sea gradient with shifting colors
  const depthShift = Math.sin(time * 0.3) * 10;
  renderer.radialGradientBackground(
    [palette.bg1, palette.bg2, palette.bg3],
    width / 2,
    height * 0.8 + depthShift
  );
  
  ctx.save();
  
  // Light rays from above
  ctx.globalAlpha = 0.04;
  for (let i = 0; i < 5; i++) {
    const x = width * (0.15 + i * 0.18);
    const sway = Math.sin(time * 0.5 + i) * 20;
    
    ctx.beginPath();
    ctx.moveTo(x + sway, 0);
    ctx.lineTo(x - 40 + sway * 0.5, height);
    ctx.lineTo(x + 40 + sway * 0.5, height);
    ctx.closePath();
    ctx.fillStyle = palette.accent;
    ctx.fill();
  }
  
  // Flowing currents (multiple layers)
  for (let layer = 0; layer < 4; layer++) {
    ctx.globalAlpha = 0.06 + layer * 0.02;
    ctx.strokeStyle = layer % 2 === 0 ? palette.primary : palette.secondary;
    ctx.lineWidth = 2 - layer * 0.3;
    
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      const startY = height * (0.15 + layer * 0.2 + i * 0.05);
      const speed = 25 + layer * 10;
      
      for (let x = 0; x <= width; x += 4) {
        const phase = (x + time * speed + layer * 80 + i * 150) * 0.008;
        const y = startY + 
          Math.sin(phase) * 40 + 
          Math.sin(phase * 2.3) * 20 + 
          Math.sin(phase * 0.7) * 30;
        
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }
  }
  
  // Coral-like neuron structures at bottom
  ctx.globalAlpha = 0.12;
  for (let i = 0; i < 6; i++) {
    const baseX = width * (0.1 + i * 0.15);
    const baseY = height - 20;
    const branchColor = i % 2 === 0 ? palette.primary : palette.secondary;
    
    drawCoralBranch(ctx, baseX, baseY, -Math.PI / 2, 60 + i * 10, 4, branchColor, time + i);
  }
  
  // Bioluminescent particles (plankton)
  for (let i = 0; i < 50; i++) {
    const seed = i * 137.5;
    const x = ((seed + time * 15) % (width + 100)) - 50;
    const y = ((seed * 2.3 + time * 8 + Math.sin(time + i) * 30) % (height + 50)) - 25;
    const size = 1 + Math.sin(time * 3 + i) * 0.8;
    const brightness = 0.3 + Math.sin(time * 2 + i * 0.5) * 0.2;
    
    ctx.globalAlpha = brightness;
    ctx.fillStyle = i % 3 === 0 ? palette.secondary : palette.primary;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Floating jellyfish silhouettes
  ctx.globalAlpha = 0.08;
  for (let i = 0; i < 3; i++) {
    const jx = width * (0.2 + i * 0.3) + Math.sin(time * 0.3 + i) * 40;
    const jy = height * 0.4 + Math.sin(time * 0.5 + i * 2) * 60;
    drawJellyfish(ctx, jx, jy, 25 + i * 5, time, palette.primary);
  }
  
  ctx.restore();
}

function drawCoralBranch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  length: number,
  depth: number,
  color: string,
  time: number
): void {
  if (depth <= 0 || length < 5) return;
  
  const sway = Math.sin(time * 0.5 + x * 0.01) * 0.1;
  const endX = x + Math.cos(angle + sway) * length;
  const endY = y + Math.sin(angle + sway) * length;
  
  ctx.strokeStyle = color;
  ctx.lineWidth = depth * 0.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  
  // Branches
  const branchAngle = 0.4 + Math.random() * 0.2;
  drawCoralBranch(ctx, endX, endY, angle - branchAngle, length * 0.7, depth - 1, color, time);
  drawCoralBranch(ctx, endX, endY, angle + branchAngle, length * 0.7, depth - 1, color, time);
}

function drawJellyfish(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  time: number,
  color: string
): void {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  
  // Bell
  ctx.beginPath();
  ctx.arc(x, y, size, Math.PI, 0);
  ctx.stroke();
  
  // Tentacles
  for (let i = 0; i < 5; i++) {
    const tx = x - size + (size * 2 / 4) * i;
    ctx.beginPath();
    ctx.moveTo(tx, y);
    
    for (let j = 0; j < 4; j++) {
      const ty = y + j * 10;
      const sway = Math.sin(time * 2 + i + j * 0.5) * 5;
      ctx.lineTo(tx + sway, ty);
    }
    ctx.stroke();
  }
}

/**
 * Forgotten Pantheon background (Sector 3 - Renaissance/Sacred)
 * Features: Stained glass patterns, mandala geometry, golden ratios
 */
export function drawPantheon(
  renderer: Renderer,
  width: number,
  height: number,
  time: number
): void {
  const ctx = renderer.context;
  const palette = SECTOR_PALETTES.pantheon;
  
  // Sacred gradient
  renderer.radialGradientBackground(
    [palette.bg1, palette.bg2, palette.bg3],
    width / 2,
    height / 3
  );
  
  ctx.save();
  
  const centerX = width / 2;
  const centerY = height / 2;
  
  // Outer stained glass effect (rotating mandala)
  for (let ring = 0; ring < 6; ring++) {
    const radius = 80 + ring * 70;
    const segments = 8 + ring * 4;
    const rotation = time * 0.08 * (ring % 2 === 0 ? 1 : -1);
    
    ctx.globalAlpha = 0.08 + ring * 0.01;
    ctx.strokeStyle = ring % 2 === 0 ? palette.primary : palette.secondary;
    ctx.lineWidth = 2;
    
    // Segment arcs
    for (let i = 0; i < segments; i++) {
      const startAngle = (i / segments) * Math.PI * 2 + rotation;
      const endAngle = ((i + 1) / segments) * Math.PI * 2 + rotation;
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.stroke();
      
      // Radial spokes
      if (ring < 5) {
        const spokeX = centerX + Math.cos(startAngle) * radius;
        const spokeY = centerY + Math.sin(startAngle) * radius;
        const nextRadius = radius + 70;
        const spokeEndX = centerX + Math.cos(startAngle) * nextRadius;
        const spokeEndY = centerY + Math.sin(startAngle) * nextRadius;
        
        ctx.beginPath();
        ctx.moveTo(spokeX, spokeY);
        ctx.lineTo(spokeEndX, spokeEndY);
        ctx.stroke();
      }
    }
  }
  
  // Inner sacred geometry (flower of life hint)
  ctx.globalAlpha = 0.1;
  ctx.strokeStyle = palette.primary;
  ctx.lineWidth = 1.5;
  
  const flowerRadius = 60;
  const petals = 6;
  
  for (let i = 0; i < petals; i++) {
    const angle = (i / petals) * Math.PI * 2 + time * 0.1;
    const px = centerX + Math.cos(angle) * flowerRadius;
    const py = centerY + Math.sin(angle) * flowerRadius;
    
    ctx.beginPath();
    ctx.arc(px, py, flowerRadius, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  // Central circle
  ctx.beginPath();
  ctx.arc(centerX, centerY, flowerRadius, 0, Math.PI * 2);
  ctx.stroke();
  
  // Floating halos
  ctx.globalAlpha = 0.15;
  for (let i = 0; i < 4; i++) {
    const hx = width * (0.2 + i * 0.2);
    const hy = height * 0.2 + Math.sin(time * 0.5 + i) * 15;
    
    ctx.strokeStyle = palette.primary;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(hx, hy, 25, 8, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  // Divine light rays from above
  ctx.globalAlpha = 0.03;
  for (let i = 0; i < 7; i++) {
    const rayX = width * (0.15 + i * 0.12);
    const spread = 30 + Math.sin(time + i) * 10;
    
    ctx.beginPath();
    ctx.moveTo(rayX, 0);
    ctx.lineTo(rayX - spread, height);
    ctx.lineTo(rayX + spread, height);
    ctx.closePath();
    ctx.fillStyle = palette.primary;
    ctx.fill();
  }
  
  ctx.restore();
}

/**
 * Black Projects background (Sector 4 - UFO/Conspiracy)
 * Features: Triangular shapes, redacted text, radar sweeps, starfield
 */
export function drawBlackOps(
  renderer: Renderer,
  width: number,
  height: number,
  time: number
): void {
  const ctx = renderer.context;
  const palette = SECTOR_PALETTES.black_ops;
  
  // Pure black gradient
  renderer.gradientBackground([palette.bg1, palette.bg2, palette.bg1], 180);
  
  ctx.save();
  
  // Starfield
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 80; i++) {
    const seed = i * 97.3;
    const x = (seed * 13.7) % width;
    const y = (seed * 7.3) % height;
    const twinkle = Math.sin(time * 3 + i) * 0.5 + 0.5;
    const size = 0.5 + (i % 3) * 0.3;
    
    ctx.globalAlpha = 0.3 + twinkle * 0.4;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Radar sweep
  const radarX = width * 0.85;
  const radarY = height * 0.15;
  const radarRadius = 60;
  const sweepAngle = time * 2;
  
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = palette.primary;
  ctx.lineWidth = 1;
  
  // Radar circles
  for (let r = 1; r <= 3; r++) {
    ctx.beginPath();
    ctx.arc(radarX, radarY, radarRadius * (r / 3), 0, Math.PI * 2);
    ctx.stroke();
  }
  
  // Sweep line
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.moveTo(radarX, radarY);
  ctx.lineTo(
    radarX + Math.cos(sweepAngle) * radarRadius,
    radarY + Math.sin(sweepAngle) * radarRadius
  );
  ctx.stroke();
  
  // Sweep trail
  ctx.globalAlpha = 0.1;
  ctx.beginPath();
  ctx.moveTo(radarX, radarY);
  ctx.arc(radarX, radarY, radarRadius, sweepAngle - 0.5, sweepAngle);
  ctx.closePath();
  ctx.fillStyle = palette.primary;
  ctx.fill();
  
  // Blips on radar
  for (let i = 0; i < 4; i++) {
    const blipAngle = sweepAngle - 0.3 - i * 0.1;
    const blipDist = radarRadius * (0.3 + i * 0.15);
    const blipX = radarX + Math.cos(blipAngle) * blipDist;
    const blipY = radarY + Math.sin(blipAngle) * blipDist;
    
    ctx.globalAlpha = 0.5 - i * 0.1;
    ctx.fillStyle = palette.primary;
    ctx.beginPath();
    ctx.arc(blipX, blipY, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Redacted document bars
  ctx.fillStyle = '#111111';
  for (let i = 0; i < 6; i++) {
    const barY = height * (0.3 + i * 0.1);
    const barWidth = 80 + Math.sin(time * 0.5 + i) * 30;
    const barX = ((time * 15 + i * 180) % (width + 300)) - 150;
    
    ctx.globalAlpha = 0.4;
    ctx.fillRect(barX, barY, barWidth, 12);
  }
  
  // Triangle UFOs
  for (let i = 0; i < 4; i++) {
    const ux = width * (0.15 + i * 0.22) + Math.sin(time * 0.3 + i * 2) * 30;
    const uy = height * 0.5 + Math.cos(time * 0.4 + i) * 40;
    const uSize = 25 + i * 5;
    
    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 1;
    
    ctx.beginPath();
    ctx.moveTo(ux, uy - uSize);
    ctx.lineTo(ux - uSize, uy + uSize * 0.6);
    ctx.lineTo(ux + uSize, uy + uSize * 0.6);
    ctx.closePath();
    ctx.stroke();
    
    // Light at bottom
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = palette.primary;
    ctx.beginPath();
    ctx.arc(ux, uy + uSize * 0.4, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // CRT scan lines
  ctx.globalAlpha = 0.03;
  ctx.fillStyle = '#ffffff';
  for (let y = 0; y < height; y += 4) {
    ctx.fillRect(0, y, width, 1);
  }
  
  // Green scan line moving
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = palette.primary;
  const scanY = (time * 80) % (height * 1.5);
  ctx.fillRect(0, scanY, width, 2);
  
  ctx.restore();
}

/**
 * Fractal Bloom background (Sector 5 - Psychedelic/Fractal)
 * Features: Color-shifting fractals, impossible geometry, reality glitches
 */
export function drawFractalBloom(
  renderer: Renderer,
  width: number,
  height: number,
  time: number
): void {
  const ctx = renderer.context;
  
  // Shifting hues
  const hue1 = (time * 25) % 360;
  const hue2 = (hue1 + 120) % 360;
  const hue3 = (hue1 + 240) % 360;
  
  // Psychedelic gradient with movement
  renderer.radialGradientBackground(
    [
      `hsl(${hue1}, 60%, 8%)`,
      `hsl(${hue2}, 70%, 12%)`,
      `hsl(${hue3}, 50%, 5%)`,
    ],
    width / 2 + Math.sin(time * 0.7) * 80,
    height / 2 + Math.cos(time * 0.5) * 60
  );
  
  ctx.save();
  
  const centerX = width / 2;
  const centerY = height / 2;
  
  // Reality glitch bars (random)
  if (Math.sin(time * 5) > 0.9) {
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 3; i++) {
      const glitchY = Math.random() * height;
      const glitchH = 2 + Math.random() * 8;
      ctx.fillStyle = `hsl(${Math.random() * 360}, 100%, 50%)`;
      ctx.fillRect(0, glitchY, width, glitchH);
    }
  }
  
  // Fractal spirals
  for (let layer = 0; layer < 4; layer++) {
    const layerHue = (hue1 + layer * 60) % 360;
    const layerTime = time * (0.6 + layer * 0.15);
    const maxRadius = 200 + layer * 60;
    const spiralTurns = 3 + layer;
    
    ctx.globalAlpha = 0.12 - layer * 0.02;
    ctx.strokeStyle = `hsl(${layerHue}, 80%, 60%)`;
    ctx.lineWidth = 2 - layer * 0.3;
    
    ctx.beginPath();
    for (let i = 0; i <= spiralTurns * 60; i++) {
      const t = i / 60;
      const angle = t * Math.PI * 2 + layerTime * (layer % 2 === 0 ? 1 : -1);
      const r = (t / spiralTurns) * maxRadius;
      const x = centerX + Math.cos(angle) * r;
      const y = centerY + Math.sin(angle) * r;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }
  
  // Morphing geometric shapes
  for (let i = 0; i < 8; i++) {
    const shapeTime = time + i * 0.5;
    const shapeX = centerX + Math.cos(shapeTime * 0.4 + i) * (100 + i * 30);
    const shapeY = centerY + Math.sin(shapeTime * 0.3 + i) * (80 + i * 20);
    const sides = 3 + (i % 5);
    const shapeSize = 15 + Math.sin(shapeTime * 2) * 8;
    const shapeHue = (hue1 + i * 45) % 360;
    
    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = `hsl(${shapeHue}, 70%, 55%)`;
    ctx.lineWidth = 1.5;
    
    ctx.beginPath();
    for (let j = 0; j <= sides; j++) {
      const angle = (j / sides) * Math.PI * 2 + shapeTime * (i % 2 === 0 ? 0.8 : -0.8);
      const px = shapeX + Math.cos(angle) * shapeSize;
      const py = shapeY + Math.sin(angle) * shapeSize;
      
      if (j === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
  }
  
  // Entity eyes (watching from void)
  for (let i = 0; i < 6; i++) {
    const eyePhase = time * 0.5 + i * 1.2;
    const eyeVisible = Math.sin(eyePhase) > 0.3;
    
    if (eyeVisible) {
      const eyeX = width * (0.1 + i * 0.15) + Math.sin(time + i) * 20;
      const eyeY = height * (0.2 + (i % 3) * 0.3) + Math.cos(time * 0.7 + i) * 30;
      const eyeSize = 8 + Math.sin(time * 2 + i) * 3;
      const eyeHue = (hue2 + i * 30) % 360;
      
      ctx.globalAlpha = 0.25 * Math.sin(eyePhase);
      ctx.fillStyle = `hsl(${eyeHue}, 100%, 70%)`;
      ctx.beginPath();
      ctx.ellipse(eyeX, eyeY, eyeSize, eyeSize * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Pupil
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(eyeX, eyeY, eyeSize * 0.3, eyeSize * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  // Iridescent particles
  for (let i = 0; i < 40; i++) {
    const seed = i * 73.7;
    const particleTime = time + seed * 0.01;
    const px = (seed * 17.3 + time * 20) % width;
    const py = (seed * 11.7 + time * 10 + Math.sin(particleTime) * 30) % height;
    const particleHue = (hue1 + i * 20 + time * 50) % 360;
    const size = 1.5 + Math.sin(particleTime * 3) * 0.8;
    
    ctx.globalAlpha = 0.4 + Math.sin(particleTime * 2) * 0.2;
    ctx.fillStyle = `hsl(${particleHue}, 100%, 70%)`;
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
}

/**
 * Draw background for a given type
 */
export function drawBackground(
  renderer: Renderer,
  type: BackgroundType,
  width: number,
  height: number,
  time: number
): void {
  switch (type) {
    case 'neural_grid':
      drawNeuralGrid(renderer, width, height, time);
      break;
    case 'synaptic_reef':
      drawSynapticReef(renderer, width, height, time);
      break;
    case 'pantheon':
      drawPantheon(renderer, width, height, time);
      break;
    case 'black_ops':
      drawBlackOps(renderer, width, height, time);
      break;
    case 'fractal_bloom':
      drawFractalBloom(renderer, width, height, time);
      break;
    default:
      drawNeuralGrid(renderer, width, height, time);
  }
}

/**
 * Get background type for sector number
 */
export function getBackgroundForSector(sectorNum: number): BackgroundType {
  const backgrounds: BackgroundType[] = [
    'neural_grid',
    'synaptic_reef',
    'pantheon',
    'black_ops',
    'fractal_bloom',
  ];
  return backgrounds[Math.min(sectorNum - 1, backgrounds.length - 1)] || 'neural_grid';
}
