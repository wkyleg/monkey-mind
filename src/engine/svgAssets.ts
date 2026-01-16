/**
 * SVG Asset loading and rendering system
 */

export interface SvgAsset {
  id: string;
  image: HTMLImageElement;
  width: number;
  height: number;
  loaded: boolean;
}

export interface SvgRenderOptions {
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  alpha?: number;
  tint?: string;
  glow?: number;
  glowColor?: string;
}

/**
 * SVG Asset Manager
 * Preloads SVG files and caches them as Image elements for Canvas rendering
 */
class SvgAssetManager {
  private assets: Map<string, SvgAsset> = new Map();
  private loadPromises: Map<string, Promise<SvgAsset>> = new Map();
  private basePath: string = '/assets/svg';
  
  /**
   * Preload all game SVG assets
   */
  async preloadAll(): Promise<void> {
    const manifest: Record<string, string[]> = {
      player: ['monkey_default', 'monkey_calm', 'monkey_passion'],
      projectiles: ['banana', 'banana_explosive', 'beam'],
      'enemies/tier1': ['synapse_drone', 'neuron_cluster', 'pulse_node'],
      'enemies/tier2': ['zigzag_cherub', 'orbital_eye', 'jellyfish_thought'],
      'enemies/tier3': ['logic_cultist', 'angelic_bureaucrat', 'animal_philosopher'],
      'enemies/tier4': ['tentacled_halo', 'fractal_insect', 'cyborg_dolphin'],
      bosses: ['cortex_auditor', 'grey_administrator', 'banana_pentagon', 'seraphim_exe', 'mirror_self'],
      powerups: ['calm_shield', 'calm_beam', 'passion_fury', 'passion_explosive'],
      ui: ['heart', 'logo'],
    };
    
    const loadPromises: Promise<SvgAsset | null>[] = [];
    
    for (const [folder, files] of Object.entries(manifest)) {
      for (const file of files) {
        const id = `${folder}/${file}`;
        const path = `${this.basePath}/${folder}/${file}.svg`;
        loadPromises.push(this.load(id, path).catch(() => null));
      }
    }
    
    await Promise.all(loadPromises);
    console.log(`SVG Assets loaded: ${this.assets.size}`);
  }
  
  /**
   * Load a single SVG asset
   */
  async load(id: string, path: string): Promise<SvgAsset> {
    // Return cached
    if (this.assets.has(id)) {
      return this.assets.get(id)!;
    }
    
    // Return pending promise
    if (this.loadPromises.has(id)) {
      return this.loadPromises.get(id)!;
    }
    
    // Create new load promise
    const promise = new Promise<SvgAsset>((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        const asset: SvgAsset = {
          id,
          image: img,
          width: img.naturalWidth || 64,
          height: img.naturalHeight || 64,
          loaded: true,
        };
        this.assets.set(id, asset);
        this.loadPromises.delete(id);
        resolve(asset);
      };
      
      img.onerror = () => {
        this.loadPromises.delete(id);
        reject(new Error(`Failed to load SVG: ${path}`));
      };
      
      img.src = path;
    });
    
    this.loadPromises.set(id, promise);
    return promise;
  }
  
  /**
   * Get a loaded asset by ID
   */
  get(id: string): SvgAsset | undefined {
    return this.assets.get(id);
  }
  
  /**
   * Check if an asset is loaded
   */
  has(id: string): boolean {
    return this.assets.has(id);
  }
  
  /**
   * Render an SVG asset to canvas
   */
  render(ctx: CanvasRenderingContext2D, id: string, options: SvgRenderOptions): boolean {
    const asset = this.assets.get(id);
    if (!asset || !asset.loaded) {
      return false;
    }
    
    const {
      x,
      y,
      width = asset.width,
      height = asset.height,
      rotation = 0,
      alpha = 1,
      glow = 0,
      glowColor = '#ffffff',
    } = options;
    
    ctx.save();
    
    // Apply transformations
    ctx.translate(x, y);
    if (rotation !== 0) {
      ctx.rotate(rotation);
    }
    
    // Apply alpha
    ctx.globalAlpha = alpha;
    
    // Apply glow effect
    if (glow > 0) {
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = glow;
    }
    
    // Draw centered
    ctx.drawImage(asset.image, -width / 2, -height / 2, width, height);
    
    ctx.restore();
    return true;
  }
  
  /**
   * Render with animation frame (for sprite sheets or time-based variations)
   */
  renderAnimated(
    ctx: CanvasRenderingContext2D,
    baseId: string,
    _frame: number,
    options: SvgRenderOptions
  ): boolean {
    // For now, just render the base asset
    // Can be extended for sprite sheet support
    return this.render(ctx, baseId, options);
  }
  
  /**
   * Get asset dimensions
   */
  getDimensions(id: string): { width: number; height: number } | undefined {
    const asset = this.assets.get(id);
    if (!asset) return undefined;
    return { width: asset.width, height: asset.height };
  }
  
  /**
   * Clear all cached assets
   */
  clear(): void {
    this.assets.clear();
    this.loadPromises.clear();
  }
}

// Global instance
export const svgAssets = new SvgAssetManager();
