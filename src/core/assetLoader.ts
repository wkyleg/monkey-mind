/**
 * Asset loading and caching system
 */

export type AssetType = 'audio' | 'image' | 'json';

export interface Asset {
  type: AssetType;
  url: string;
  data: unknown;
}

export interface LoadProgress {
  loaded: number;
  total: number;
  current: string;
  percentage: number;
}

export type ProgressCallback = (progress: LoadProgress) => void;

class AssetLoader {
  private cache: Map<string, Asset> = new Map();
  private loading: Map<string, Promise<Asset>> = new Map();

  /**
   * Load a single asset
   */
  async load(url: string, type: AssetType): Promise<Asset> {
    // Check cache first
    const cached = this.cache.get(url);
    if (cached) {
      return cached;
    }

    // Check if already loading
    const pending = this.loading.get(url);
    if (pending) {
      return pending;
    }

    // Start loading
    const promise = this.loadAsset(url, type);
    this.loading.set(url, promise);

    try {
      const asset = await promise;
      this.cache.set(url, asset);
      return asset;
    } finally {
      this.loading.delete(url);
    }
  }

  /**
   * Load multiple assets with progress callback
   */
  async loadAll(
    assets: { url: string; type: AssetType }[],
    onProgress?: ProgressCallback,
  ): Promise<Map<string, Asset>> {
    const results = new Map<string, Asset>();
    const total = assets.length;
    let loaded = 0;

    for (const { url, type } of assets) {
      if (onProgress) {
        onProgress({
          loaded,
          total,
          current: url,
          percentage: (loaded / total) * 100,
        });
      }

      const asset = await this.load(url, type);
      results.set(url, asset);
      loaded++;
    }

    if (onProgress) {
      onProgress({
        loaded: total,
        total,
        current: '',
        percentage: 100,
      });
    }

    return results;
  }

  /**
   * Load an individual asset by type
   */
  private async loadAsset(url: string, type: AssetType): Promise<Asset> {
    switch (type) {
      case 'audio':
        return this.loadAudio(url);
      case 'image':
        return this.loadImage(url);
      case 'json':
        return this.loadJson(url);
      default:
        throw new Error(`Unknown asset type: ${type}`);
    }
  }

  /**
   * Load an audio file
   */
  private async loadAudio(url: string): Promise<Asset> {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.preload = 'auto';

      audio.addEventListener('canplaythrough', () => {
        resolve({ type: 'audio', url, data: audio });
      });

      audio.addEventListener('error', () => {
        reject(new Error(`Failed to load audio: ${url}`));
      });

      audio.src = url;
    });
  }

  /**
   * Load an image file
   */
  private async loadImage(url: string): Promise<Asset> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.addEventListener('load', () => {
        resolve({ type: 'image', url, data: img });
      });

      img.addEventListener('error', () => {
        reject(new Error(`Failed to load image: ${url}`));
      });

      img.src = url;
    });
  }

  /**
   * Load a JSON file
   */
  private async loadJson(url: string): Promise<Asset> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load JSON: ${url} (${response.status})`);
    }
    const data = await response.json();
    return { type: 'json', url, data };
  }

  /**
   * Get a cached asset
   */
  get<T>(url: string): T | null {
    const asset = this.cache.get(url);
    return asset ? (asset.data as T) : null;
  }

  /**
   * Check if an asset is loaded
   */
  has(url: string): boolean {
    return this.cache.has(url);
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Remove a specific asset from cache
   */
  unload(url: string): void {
    this.cache.delete(url);
  }
}

// Global asset loader instance
export const assets = new AssetLoader();
