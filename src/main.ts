/**
 * Monkey Mind: Inner Invaders
 * Main entry point
 */

import { CONFIG } from './config';
import { Game } from './engine/game';

// Extend window for loading progress function
declare global {
  interface Window {
    updateLoadingProgress: (percent: number, status?: string) => void;
  }
}

/**
 * Update loading screen progress
 */
function updateProgress(percent: number, status?: string): void {
  if (window.updateLoadingProgress) {
    window.updateLoadingProgress(percent, status);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const loadingScreen = document.getElementById('loading-screen') as HTMLElement;

  if (!canvas) {
    console.error('Canvas element not found');
    return;
  }

  // Set canvas dimensions
  canvas.width = CONFIG.CANVAS_WIDTH;
  canvas.height = CONFIG.CANVAS_HEIGHT;

  try {
    updateProgress(5, 'INITIALIZING NEURAL INTERFACE...');

    // Create game instance
    const game = new Game(canvas);

    updateProgress(15, 'LOADING CONTENT MODULES...');

    // Initialize with progress updates
    await game.init((progress, status) => {
      // Map game init progress (0-1) to our range (15-90)
      const mappedProgress = 15 + progress * 75;
      updateProgress(mappedProgress, status);
    });

    updateProgress(95, 'ESTABLISHING NEURAL LINK...');

    // Brief delay for visual effect
    await new Promise((resolve) => setTimeout(resolve, 500));

    updateProgress(100, 'NEURAL LINK ESTABLISHED');

    // Fade out loading screen
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Hide loading, show canvas
    if (loadingScreen) {
      loadingScreen.style.opacity = '0';
      loadingScreen.style.transition = 'opacity 0.5s ease-out';
      await new Promise((resolve) => setTimeout(resolve, 500));
      loadingScreen.classList.add('hidden');
    }
    canvas.classList.remove('hidden');

    // Start the game
    game.start();

    // Make game accessible for debugging
    if (CONFIG.DEBUG) {
      (window as unknown as { game: Game }).game = game;
    }

    console.log('🐵 Monkey Mind: Inner Invaders initialized');
  } catch (error) {
    console.error('Failed to initialize game:', error);
    updateProgress(0, 'NEURAL LINK FAILED - REFRESH TO RETRY');

    const statusEl = document.getElementById('loading-status');
    if (statusEl) {
      statusEl.style.color = '#ff4444';
      statusEl.textContent = 'NEURAL LINK FAILED - REFRESH TO RETRY';
    }
  }
});
