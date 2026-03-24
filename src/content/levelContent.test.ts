/**
 * Comprehensive tests for level content validation
 * Ensures all levels have unique enemies, backgrounds, and dialogue
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

// Level content structure
interface LevelEnemyDialogue {
  spawn: string[];
  death: string[];
}

interface LevelEnemyConfig {
  visualId: string;
  dialogue?: LevelEnemyDialogue;
}

interface BgLayerConfig {
  svgId: string;
  parallaxSpeed?: number;
  opacity?: number;
}

interface LevelData {
  id: string;
  act: number;
  index: number;
  title: string;
  levelEnemies?: Record<string, LevelEnemyConfig>;
  bgLayers?: BgLayerConfig[];
  copyLayers?: {
    codexSnippet?: string;
  };
}

interface ExpansionLevelData {
  id: string;
  expansion: string;
  index: number;
  title: string;
  levelEnemies?: Record<string, LevelEnemyConfig>;
  bgLayers?: BgLayerConfig[];
  copyLayers?: {
    codexSnippet?: string;
  };
}

// Helper to get all act level JSON files
function getAllLevelFiles(): string[] {
  const actsDir = path.join(process.cwd(), 'public/content/acts');
  const levelFiles: string[] = [];

  if (!fs.existsSync(actsDir)) return levelFiles;

  const acts = fs.readdirSync(actsDir);
  for (const act of acts) {
    const actDir = path.join(actsDir, act);
    if (fs.statSync(actDir).isDirectory()) {
      const files = fs.readdirSync(actDir);
      for (const file of files) {
        if (file.startsWith('level_') && file.endsWith('.json')) {
          levelFiles.push(path.join(actDir, file));
        }
      }
    }
  }

  return levelFiles;
}

// Helper to get all expansion level JSON files
function getAllExpansionLevelFiles(): string[] {
  const expansionsDir = path.join(process.cwd(), 'public/content/expansions');
  const levelFiles: string[] = [];

  if (!fs.existsSync(expansionsDir)) return levelFiles;

  const expansions = fs.readdirSync(expansionsDir);
  for (const expansion of expansions) {
    const expansionDir = path.join(expansionsDir, expansion);
    if (fs.statSync(expansionDir).isDirectory()) {
      const files = fs.readdirSync(expansionDir);
      for (const file of files) {
        if (file.startsWith('level_') && file.endsWith('.json')) {
          levelFiles.push(path.join(expansionDir, file));
        }
      }
    }
  }

  return levelFiles;
}

// Helper to check if SVG file exists (for acts)
function svgExists(actId: string, svgPath: string): boolean {
  // Check level-specific background: acts/{actId}/bg/level{N}_{svgId}.svg
  // Check act-level background: acts/{actId}/bg/{svgId}.svg
  const baseDir = path.join(process.cwd(), 'public/assets/svg');

  // Direct path
  const directPath = path.join(baseDir, `${svgPath}.svg`);
  if (fs.existsSync(directPath)) return true;

  // Act background path
  const actBgPath = path.join(baseDir, 'acts', actId, 'bg', `${svgPath}.svg`);
  if (fs.existsSync(actBgPath)) return true;

  return false;
}

// Helper to check if expansion SVG file exists
function expansionSvgExists(expansionId: string, svgPath: string): boolean {
  const baseDir = path.join(process.cwd(), 'public/assets/svg');

  // Direct path for expansions/pack/bg/level{N}_{svgId}.svg
  const bgPath = path.join(baseDir, 'expansions', expansionId, 'bg', `${svgPath}.svg`);
  if (fs.existsSync(bgPath)) return true;

  // Fallback: check old-style path
  const oldPath = path.join(baseDir, 'expansions', expansionId, `${svgPath}.svg`);
  if (fs.existsSync(oldPath)) return true;

  return false;
}

// Helper to check if expansion enemy SVG exists
function expansionEnemySvgExists(expansionId: string, levelIndex: number, visualId: string): boolean {
  const baseDir = path.join(process.cwd(), 'public/assets/svg');

  // Level-specific enemy: expansions/{pack}/level{N}_enemies/{visualId}.svg
  const levelEnemyPath = path.join(baseDir, 'expansions', expansionId, `level${levelIndex}_enemies`, `${visualId}.svg`);
  if (fs.existsSync(levelEnemyPath)) return true;

  // Fallback: old-style path expansions/{pack}/enemy_{visualId}.svg
  const oldPath = path.join(baseDir, 'expansions', expansionId, `enemy_${visualId}.svg`);
  if (fs.existsSync(oldPath)) return true;

  // Also check direct name
  const directPath = path.join(baseDir, 'expansions', expansionId, `${visualId}.svg`);
  if (fs.existsSync(directPath)) return true;

  return false;
}

// Helper to check if enemy SVG exists
function enemySvgExists(actId: string, levelIndex: number, visualId: string): boolean {
  const baseDir = path.join(process.cwd(), 'public/assets/svg');

  // Level-specific enemy: acts/{actId}/level{N}_enemies/{visualId}.svg
  const levelEnemyPath = path.join(baseDir, 'acts', actId, `level${levelIndex}_enemies`, `${visualId}.svg`);
  if (fs.existsSync(levelEnemyPath)) return true;

  // Act-level enemy: acts/{actId}/enemies/{visualId}.svg
  const actEnemyPath = path.join(baseDir, 'acts', actId, 'enemies', `${visualId}.svg`);
  if (fs.existsSync(actEnemyPath)) return true;

  return false;
}

// Load all level data
const levelFiles = getAllLevelFiles();
const levels: { file: string; data: LevelData; actId: string }[] = [];

for (const file of levelFiles) {
  try {
    const content = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(content) as LevelData;
    const actId = path.basename(path.dirname(file));
    levels.push({ file, data, actId });
  } catch (_e) {
    // Skip invalid files
  }
}

// Group levels by act
const levelsByAct: Record<string, typeof levels> = {};
for (const level of levels) {
  if (!levelsByAct[level.actId]) {
    levelsByAct[level.actId] = [];
  }
  levelsByAct[level.actId].push(level);
}

describe('Level Content Validation', () => {
  describe('Level File Structure', () => {
    it('should have 40 total level files (8 acts × 5 levels)', () => {
      expect(levels.length).toBe(40);
    });

    it('should have levels for all 8 acts', () => {
      const actIds = Object.keys(levelsByAct);
      expect(actIds).toContain('act1_escape');
      expect(actIds).toContain('act2_ocean');
      expect(actIds).toContain('act3_heroic');
      expect(actIds).toContain('act4_sacred');
      expect(actIds).toContain('act5_painted');
      expect(actIds).toContain('act6_library');
      expect(actIds).toContain('act7_machine');
      expect(actIds).toContain('act8_signals');
    });

    it('each act should have exactly 5 levels', () => {
      for (const [actId, actLevels] of Object.entries(levelsByAct)) {
        expect(actLevels.length, `${actId} should have 5 levels`).toBe(5);
      }
    });
  });

  describe('Level Enemies (levelEnemies)', () => {
    // Test each non-boss level has levelEnemies
    for (const level of levels) {
      const isBossLevel = level.data.title.toLowerCase().includes('boss') || level.data.index === 5;

      if (!isBossLevel) {
        describe(`${level.actId} - ${level.data.title}`, () => {
          it('should have levelEnemies defined', () => {
            expect(level.data.levelEnemies, `${level.file} is missing levelEnemies`).toBeDefined();
          });

          it('should have at least 3 unique enemy types', () => {
            if (!level.data.levelEnemies) {
              expect.fail(`${level.file} is missing levelEnemies`);
              return;
            }
            const enemyCount = Object.keys(level.data.levelEnemies).length;
            expect(enemyCount, `${level.file} has only ${enemyCount} enemies, needs 3+`).toBeGreaterThanOrEqual(3);
          });

          it('each enemy should have visualId and dialogue', () => {
            if (!level.data.levelEnemies) return;

            for (const [enemyId, config] of Object.entries(level.data.levelEnemies)) {
              expect(config.visualId, `${level.file}: enemy "${enemyId}" missing visualId`).toBeDefined();

              expect(config.dialogue, `${level.file}: enemy "${enemyId}" missing dialogue`).toBeDefined();
            }
          });

          it('each enemy dialogue should have 5+ spawn and death lines', () => {
            if (!level.data.levelEnemies) return;

            for (const [enemyId, config] of Object.entries(level.data.levelEnemies)) {
              if (!config.dialogue) continue;

              expect(
                config.dialogue.spawn?.length,
                `${level.file}: enemy "${enemyId}" needs 5+ spawn lines`,
              ).toBeGreaterThanOrEqual(5);

              expect(
                config.dialogue.death?.length,
                `${level.file}: enemy "${enemyId}" needs 5+ death lines`,
              ).toBeGreaterThanOrEqual(5);
            }
          });

          it('enemy SVG files should exist', () => {
            if (!level.data.levelEnemies) return;

            for (const [enemyId, config] of Object.entries(level.data.levelEnemies)) {
              const exists = enemySvgExists(level.actId, level.data.index, config.visualId);
              expect(exists, `${level.file}: enemy "${enemyId}" SVG "${config.visualId}" not found`).toBe(true);
            }
          });
        });
      }
    }
  });

  describe('Background Layers (bgLayers)', () => {
    for (const level of levels) {
      const isBossLevel = level.data.title.toLowerCase().includes('boss') || level.data.index === 5;

      if (!isBossLevel) {
        describe(`${level.actId} - ${level.data.title}`, () => {
          it('should have bgLayers defined', () => {
            expect(level.data.bgLayers, `${level.file} is missing bgLayers`).toBeDefined();
          });

          it('should have at least 2 background layers', () => {
            if (!level.data.bgLayers) return;
            expect(
              level.data.bgLayers.length,
              `${level.file} has only ${level.data.bgLayers.length} bg layers, needs 2+`,
            ).toBeGreaterThanOrEqual(2);
          });

          it('background SVG files should exist', () => {
            if (!level.data.bgLayers) return;

            for (const layer of level.data.bgLayers) {
              // Build expected path: level{N}_{svgId}
              const levelBgId = `level${level.data.index}_${layer.svgId}`;
              const exists = svgExists(level.actId, levelBgId) || svgExists(level.actId, layer.svgId);
              expect(exists, `${level.file}: background "${layer.svgId}" SVG not found (tried ${levelBgId})`).toBe(
                true,
              );
            }
          });
        });
      }
    }
  });

  describe('Lore Content (copyLayers)', () => {
    for (const level of levels) {
      describe(`${level.actId} - ${level.data.title}`, () => {
        it('should have codexSnippet for lore', () => {
          expect(level.data.copyLayers?.codexSnippet, `${level.file} is missing copyLayers.codexSnippet`).toBeDefined();
        });

        it('codexSnippet should be at least 50 characters', () => {
          const snippet = level.data.copyLayers?.codexSnippet;
          if (snippet) {
            expect(
              snippet.length,
              `${level.file} codexSnippet too short (${snippet.length} chars)`,
            ).toBeGreaterThanOrEqual(50);
          }
        });
      });
    }
  });

  describe('Dialogue Uniqueness', () => {
    it('all enemy IDs should be unique within each level', () => {
      for (const level of levels) {
        if (!level.data.levelEnemies) continue;

        const enemyIds = Object.keys(level.data.levelEnemies);
        const uniqueIds = [...new Set(enemyIds)];
        expect(uniqueIds.length, `${level.file} has duplicate enemy IDs`).toBe(enemyIds.length);
      }
    });

    it('spawn dialogue lines should be unique within each enemy', () => {
      for (const level of levels) {
        if (!level.data.levelEnemies) continue;

        for (const [enemyId, config] of Object.entries(level.data.levelEnemies)) {
          if (!config.dialogue?.spawn) continue;

          const lines = config.dialogue.spawn;
          const uniqueLines = [...new Set(lines)];
          expect(uniqueLines.length, `${level.file}: enemy "${enemyId}" has duplicate spawn lines`).toBe(lines.length);
        }
      }
    });

    it('death dialogue lines should be unique within each enemy', () => {
      for (const level of levels) {
        if (!level.data.levelEnemies) continue;

        for (const [enemyId, config] of Object.entries(level.data.levelEnemies)) {
          if (!config.dialogue?.death) continue;

          const lines = config.dialogue.death;
          const uniqueLines = [...new Set(lines)];
          expect(uniqueLines.length, `${level.file}: enemy "${enemyId}" has duplicate death lines`).toBe(lines.length);
        }
      }
    });
  });

  describe('Content Summary', () => {
    it('should report content coverage', () => {
      let levelsWithEnemies = 0;
      let totalEnemies = 0;
      let totalDialogueLines = 0;
      let levelsWithBgLayers = 0;

      for (const level of levels) {
        if (level.data.levelEnemies) {
          levelsWithEnemies++;
          const enemies = Object.values(level.data.levelEnemies);
          totalEnemies += enemies.length;
          for (const enemy of enemies) {
            if (enemy.dialogue) {
              totalDialogueLines += enemy.dialogue.spawn?.length || 0;
              totalDialogueLines += enemy.dialogue.death?.length || 0;
            }
          }
        }
        if (level.data.bgLayers && level.data.bgLayers.length > 0) {
          levelsWithBgLayers++;
        }
      }

      console.log('\n=== Level Content Coverage ===');
      console.log(`Levels with levelEnemies: ${levelsWithEnemies}/40`);
      console.log(`Total unique enemies: ${totalEnemies}`);
      console.log(`Total dialogue lines: ${totalDialogueLines}`);
      console.log(`Levels with bgLayers: ${levelsWithBgLayers}/40`);
      console.log('==============================\n');

      // This test always passes - it's just for reporting
      expect(true).toBe(true);
    });
  });
});

// ============================================================
// EXPANSION CONTENT VALIDATION
// ============================================================

// Load all expansion level data
const expansionFiles = getAllExpansionLevelFiles();
const expansionLevels: { file: string; data: ExpansionLevelData; expansionId: string }[] = [];

for (const file of expansionFiles) {
  try {
    const content = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(content) as ExpansionLevelData;
    const expansionId = path.basename(path.dirname(file));
    expansionLevels.push({ file, data, expansionId });
  } catch (_e) {
    // Skip invalid files
  }
}

// Group expansion levels by pack
const levelsByExpansion: Record<string, typeof expansionLevels> = {};
for (const level of expansionLevels) {
  if (!levelsByExpansion[level.expansionId]) {
    levelsByExpansion[level.expansionId] = [];
  }
  levelsByExpansion[level.expansionId].push(level);
}

describe('Expansion Content Validation', () => {
  describe('Expansion File Structure', () => {
    it('should have 100 total expansion level files', () => {
      expect(expansionLevels.length).toBe(100);
    });

    it('should have levels for all 12 expansion packs', () => {
      const expansionIds = Object.keys(levelsByExpansion);
      expect(expansionIds).toContain('art');
      expect(expansionIds).toContain('climax');
      expect(expansionIds).toContain('cosmic');
      expect(expansionIds).toContain('literature');
      expect(expansionIds).toContain('lost_worlds');
      expect(expansionIds).toContain('monkey_vars');
      expect(expansionIds).toContain('myth');
      expect(expansionIds).toContain('paranoia');
      expect(expansionIds).toContain('samurai');
      expect(expansionIds).toContain('science');
      expect(expansionIds).toContain('state');
      expect(expansionIds).toContain('travel');
    });
  });

  describe('Expansion Level Enemies (levelEnemies)', () => {
    for (const level of expansionLevels) {
      describe(`${level.expansionId} - ${level.data.title}`, () => {
        it('should have levelEnemies defined', () => {
          expect(level.data.levelEnemies, `${level.file} is missing levelEnemies`).toBeDefined();
        });

        it('should have at least 3 unique enemy types', () => {
          if (!level.data.levelEnemies) {
            expect.fail(`${level.file} is missing levelEnemies`);
            return;
          }
          const enemyCount = Object.keys(level.data.levelEnemies).length;
          expect(enemyCount, `${level.file} has only ${enemyCount} enemies, needs 3+`).toBeGreaterThanOrEqual(3);
        });

        it('each enemy should have visualId and dialogue', () => {
          if (!level.data.levelEnemies) return;

          for (const [enemyId, config] of Object.entries(level.data.levelEnemies)) {
            expect(config.visualId, `${level.file}: enemy "${enemyId}" missing visualId`).toBeDefined();

            expect(config.dialogue, `${level.file}: enemy "${enemyId}" missing dialogue`).toBeDefined();
          }
        });

        it('each enemy dialogue should have 5+ spawn and death lines', () => {
          if (!level.data.levelEnemies) return;

          for (const [enemyId, config] of Object.entries(level.data.levelEnemies)) {
            if (!config.dialogue) continue;

            expect(
              config.dialogue.spawn?.length,
              `${level.file}: enemy "${enemyId}" needs 5+ spawn lines`,
            ).toBeGreaterThanOrEqual(5);

            expect(
              config.dialogue.death?.length,
              `${level.file}: enemy "${enemyId}" needs 5+ death lines`,
            ).toBeGreaterThanOrEqual(5);
          }
        });

        it('enemy SVG files should exist', () => {
          if (!level.data.levelEnemies) return;

          for (const [enemyId, config] of Object.entries(level.data.levelEnemies)) {
            const exists = expansionEnemySvgExists(level.expansionId, level.data.index, config.visualId);
            expect(exists, `${level.file}: enemy "${enemyId}" SVG "${config.visualId}" not found`).toBe(true);
          }
        });
      });
    }
  });

  describe('Expansion Background Layers (bgLayers)', () => {
    for (const level of expansionLevels) {
      describe(`${level.expansionId} - ${level.data.title}`, () => {
        it('should have bgLayers defined', () => {
          expect(level.data.bgLayers, `${level.file} is missing bgLayers`).toBeDefined();
        });

        it('should have at least 2 background layers', () => {
          if (!level.data.bgLayers) return;
          expect(
            level.data.bgLayers.length,
            `${level.file} has only ${level.data.bgLayers.length} bg layers, needs 2+`,
          ).toBeGreaterThanOrEqual(2);
        });

        it('background SVG files should exist', () => {
          if (!level.data.bgLayers) return;

          for (const layer of level.data.bgLayers) {
            // Build expected path: level{N}_{svgId}
            const svgId = layer.svgId.replace(/^expansions\/[^/]+\//, '').replace(/^bg_/, '');
            const levelBgId = `level${level.data.index}_${svgId}`;
            const exists =
              expansionSvgExists(level.expansionId, levelBgId) ||
              expansionSvgExists(level.expansionId, svgId) ||
              expansionSvgExists(level.expansionId, layer.svgId.replace(/^expansions\/[^/]+\//, ''));
            expect(exists, `${level.file}: background "${layer.svgId}" SVG not found (tried ${levelBgId})`).toBe(true);
          }
        });
      });
    }
  });

  describe('Expansion Lore Content', () => {
    for (const level of expansionLevels) {
      describe(`${level.expansionId} - ${level.data.title}`, () => {
        it('should have codexSnippet for lore', () => {
          expect(level.data.copyLayers?.codexSnippet, `${level.file} is missing copyLayers.codexSnippet`).toBeDefined();
        });

        it('codexSnippet should be at least 50 characters', () => {
          const snippet = level.data.copyLayers?.codexSnippet;
          if (snippet) {
            expect(
              snippet.length,
              `${level.file} codexSnippet too short (${snippet.length} chars)`,
            ).toBeGreaterThanOrEqual(50);
          }
        });
      });
    }
  });

  describe('Expansion Dialogue Uniqueness', () => {
    it('all enemy IDs should be unique within each expansion level', () => {
      for (const level of expansionLevels) {
        if (!level.data.levelEnemies) continue;

        const enemyIds = Object.keys(level.data.levelEnemies);
        const uniqueIds = [...new Set(enemyIds)];
        expect(uniqueIds.length, `${level.file} has duplicate enemy IDs`).toBe(enemyIds.length);
      }
    });

    it('spawn dialogue lines should be unique within each enemy', () => {
      for (const level of expansionLevels) {
        if (!level.data.levelEnemies) continue;

        for (const [enemyId, config] of Object.entries(level.data.levelEnemies)) {
          if (!config.dialogue?.spawn) continue;

          const lines = config.dialogue.spawn;
          const uniqueLines = [...new Set(lines)];
          expect(uniqueLines.length, `${level.file}: enemy "${enemyId}" has duplicate spawn lines`).toBe(lines.length);
        }
      }
    });

    it('death dialogue lines should be unique within each enemy', () => {
      for (const level of expansionLevels) {
        if (!level.data.levelEnemies) continue;

        for (const [enemyId, config] of Object.entries(level.data.levelEnemies)) {
          if (!config.dialogue?.death) continue;

          const lines = config.dialogue.death;
          const uniqueLines = [...new Set(lines)];
          expect(uniqueLines.length, `${level.file}: enemy "${enemyId}" has duplicate death lines`).toBe(lines.length);
        }
      }
    });
  });

  describe('Expansion Content Summary', () => {
    it('should report expansion content coverage', () => {
      let levelsWithEnemies = 0;
      let totalEnemies = 0;
      let totalDialogueLines = 0;
      let levelsWithBgLayers = 0;

      for (const level of expansionLevels) {
        if (level.data.levelEnemies) {
          levelsWithEnemies++;
          const enemies = Object.values(level.data.levelEnemies);
          totalEnemies += enemies.length;
          for (const enemy of enemies) {
            if (enemy.dialogue) {
              totalDialogueLines += enemy.dialogue.spawn?.length || 0;
              totalDialogueLines += enemy.dialogue.death?.length || 0;
            }
          }
        }
        if (level.data.bgLayers && level.data.bgLayers.length > 0) {
          levelsWithBgLayers++;
        }
      }

      console.log('\n=== Expansion Content Coverage ===');
      console.log(`Expansion levels with levelEnemies: ${levelsWithEnemies}/100`);
      console.log(`Total unique expansion enemies: ${totalEnemies}`);
      console.log(`Total expansion dialogue lines: ${totalDialogueLines}`);
      console.log(`Expansion levels with bgLayers: ${levelsWithBgLayers}/100`);
      console.log('==================================\n');

      // This test always passes - it's just for reporting
      expect(true).toBe(true);
    });
  });
});
