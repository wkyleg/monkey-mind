/**
 * Monkey Mind: Inner Invaders
 * Main entry point
 */

import { Game } from './engine/game';
import { CONFIG } from './config';

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const loading = document.getElementById('loading') as HTMLElement;
  
  if (!canvas) {
    console.error('Canvas element not found');
    return;
  }
  
  // Set canvas dimensions
  canvas.width = CONFIG.CANVAS_WIDTH;
  canvas.height = CONFIG.CANVAS_HEIGHT;
  
  try {
    // Create and initialize the game
    const game = new Game(canvas);
    await game.init();
    
    // Hide loading, show canvas
    loading.classList.add('hidden');
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
    loading.textContent = 'NEURAL LINK FAILED - REFRESH TO RETRY';
  }
});
