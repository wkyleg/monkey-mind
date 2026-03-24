/**
 * CodexSystem tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('CodexSystem', () => {
  let eventListeners: Map<string, Function[]>;
  let mockEmit: ReturnType<typeof vi.fn>;
  let mockOn: ReturnType<typeof vi.fn>;
  let mockIsCodexUnlocked: ReturnType<typeof vi.fn>;
  let mockUnlockCodex: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    eventListeners = new Map();

    mockEmit = vi.fn();
    mockOn = vi.fn((event: string, cb: Function) => {
      if (!eventListeners.has(event)) eventListeners.set(event, []);
      eventListeners.get(event)!.push(cb);
      return () => {};
    });
    mockIsCodexUnlocked = vi.fn(() => false);
    mockUnlockCodex = vi.fn(() => true);

    vi.doMock('../core/events', () => ({
      events: {
        emit: mockEmit,
        on: mockOn,
        off: vi.fn(),
      },
    }));

    vi.doMock('../core/storage', () => ({
      storage: {
        isCodexUnlocked: mockIsCodexUnlocked,
        unlockCodex: mockUnlockCodex,
      },
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  const triggerEvent = (name: string, data?: unknown) => {
    for (const cb of eventListeners.get(name) || []) cb(data);
  };

  const loadCodex = async () => {
    const { CodexSystem } = await import('./codex');
    return CodexSystem;
  };

  it('construction registers listeners for enemy:death, boss:defeat, and sector:complete', async () => {
    const CodexSystem = await loadCodex();
    new CodexSystem();

    const registered = mockOn.mock.calls.map((c) => c[0] as string);
    expect(registered).toContain('enemy:death');
    expect(registered).toContain('boss:defeat');
    expect(registered).toContain('sector:complete');
    expect(mockOn).toHaveBeenCalledTimes(3);
  });

  it('getEntry returns entry for valid ID and undefined for invalid', async () => {
    const CodexSystem = await loadCodex();
    const codex = new CodexSystem();

    expect(codex.getEntry('synapse_drone')?.id).toBe('synapse_drone');
    expect(codex.getEntry('project_monkeymind')?.category).toBe('lore');
    expect(codex.getEntry('not_a_real_entry')).toBeUndefined();
  });

  it("getCategory('enemy') returns enemy entries", async () => {
    const CodexSystem = await loadCodex();
    const codex = new CodexSystem();
    const enemies = codex.getCategory('enemy');

    expect(enemies).toHaveLength(4);
    expect(enemies.map((e) => e.id).sort()).toEqual(
      ['glitch_sprite', 'neuron_cluster', 'orbital_eye', 'synapse_drone'].sort(),
    );
    expect(enemies.every((e) => e.category === 'enemy')).toBe(true);
  });

  it("getCategory('boss') returns boss entries", async () => {
    const CodexSystem = await loadCodex();
    const codex = new CodexSystem();
    const bosses = codex.getCategory('boss');

    expect(bosses).toHaveLength(2);
    expect(bosses.map((b) => b.id).sort()).toEqual(['cortex_auditor', 'grey_administrator'].sort());
  });

  it("getCategory('lore') returns lore entries", async () => {
    const CodexSystem = await loadCodex();
    const codex = new CodexSystem();
    const lore = codex.getCategory('lore');

    expect(lore).toHaveLength(3);
    expect(lore.map((e) => e.id).sort()).toEqual(
      ['entry_neural_cage', 'entry_synaptic_reef', 'project_monkeymind'].sort(),
    );
  });

  it('unlockEntry returns true for known IDs and false for unknown', async () => {
    const CodexSystem = await loadCodex();
    const codex = new CodexSystem();

    expect(codex.unlockEntry('synapse_drone')).toBe(true);
    expect(mockUnlockCodex).toHaveBeenCalledWith('synapse_drone');

    expect(codex.unlockEntry('unknown_codex_id')).toBe(false);
  });

  it('getProgress returns correct unlocked and total counts', async () => {
    mockIsCodexUnlocked.mockImplementation((id: string) =>
      ['synapse_drone', 'cortex_auditor', 'project_monkeymind'].includes(id),
    );

    const CodexSystem = await loadCodex();
    const codex = new CodexSystem();

    expect(codex.getProgress()).toEqual({ unlocked: 3, total: 9 });
  });

  it('enemy:death with type synapse_drone unlocks entry after first defeat (defeat_first)', async () => {
    const CodexSystem = await loadCodex();
    new CodexSystem();

    triggerEvent('enemy:death', { type: 'synapse_drone' });

    expect(mockUnlockCodex).toHaveBeenCalledWith('synapse_drone');
    expect(mockEmit).toHaveBeenCalledWith('codex:unlock', {
      id: 'synapse_drone',
      category: 'enemy',
    });
  });

  it('enemy:death with type neuron_cluster unlocks only after 3 defeats (defeat_3)', async () => {
    const CodexSystem = await loadCodex();
    new CodexSystem();

    triggerEvent('enemy:death', { type: 'neuron_cluster' });
    triggerEvent('enemy:death', { type: 'neuron_cluster' });
    expect(mockUnlockCodex).not.toHaveBeenCalledWith('neuron_cluster');

    triggerEvent('enemy:death', { type: 'neuron_cluster' });
    expect(mockUnlockCodex).toHaveBeenCalledWith('neuron_cluster');
  });

  it('sector:complete with sectorId sector1_neural_cage unlocks project_monkeymind', async () => {
    const CodexSystem = await loadCodex();
    new CodexSystem();

    triggerEvent('sector:complete', { sectorId: 'sector1_neural_cage' });

    expect(mockUnlockCodex).toHaveBeenCalledWith('project_monkeymind');
    expect(mockEmit).toHaveBeenCalledWith('codex:unlock', {
      id: 'project_monkeymind',
      category: 'lore',
    });
  });

  it('resetSession clears defeated enemy counts so defeat_3 must be earned again', async () => {
    const CodexSystem = await loadCodex();
    const codex = new CodexSystem();

    triggerEvent('enemy:death', { type: 'neuron_cluster' });
    triggerEvent('enemy:death', { type: 'neuron_cluster' });
    codex.resetSession();
    triggerEvent('enemy:death', { type: 'neuron_cluster' });

    expect(mockUnlockCodex).not.toHaveBeenCalledWith('neuron_cluster');
  });
});
