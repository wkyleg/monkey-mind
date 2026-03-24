/**
 * Tests for Rule Card System
 * TDD: Tests written FIRST before implementation
 *
 * Rule Cards:
 * - Each level has ONE rule card
 * - Displayed as: icon + one-line hint
 * - Rule is felt within 15 seconds of play
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RuleCard } from '../content/schema';
import type { RuleCardSystem } from './ruleCards';
import { ALL_MECHANICS, createRuleCardSystem } from './ruleCards';

describe('Rule Card System', () => {
  describe('ALL_MECHANICS constant', () => {
    it('should contain common mechanics', () => {
      expect(ALL_MECHANICS).toContain('mirror_fire');
      expect(ALL_MECHANICS).toContain('attention_tax');
      expect(ALL_MECHANICS).toContain('sequence_kill');
      expect(ALL_MECHANICS).toContain('rhythm_sync');
      expect(ALL_MECHANICS).toContain('no_damage_bonus');
      expect(ALL_MECHANICS).toContain('stillness_reward');
    });
  });

  describe('createRuleCardSystem', () => {
    it('should create a rule card system', () => {
      const system = createRuleCardSystem();
      expect(system).toBeDefined();
    });
  });

  describe('RuleCardSystem', () => {
    let system: RuleCardSystem;

    beforeEach(() => {
      system = createRuleCardSystem();
    });

    describe('Card Loading', () => {
      it('should load a rule card', () => {
        const card: RuleCard = {
          icon: 'mirror',
          hint: 'Enemies mirror your fire; shoot gaps',
          mechanic: 'mirror_fire',
        };
        system.loadCard(card);
        expect(system.getCurrentCard()).toEqual(card);
      });

      it('should replace existing card on load', () => {
        const card1: RuleCard = { icon: 'mirror', hint: 'First', mechanic: 'mirror_fire' };
        const card2: RuleCard = { icon: 'clock', hint: 'Second', mechanic: 'rhythm_sync' };

        system.loadCard(card1);
        system.loadCard(card2);

        expect(system.getCurrentCard()).toEqual(card2);
      });

      it('should clear card', () => {
        const card: RuleCard = { icon: 'mirror', hint: 'Test', mechanic: 'mirror_fire' };
        system.loadCard(card);
        system.clearCard();
        expect(system.getCurrentCard()).toBeNull();
      });
    });

    describe('Card Display', () => {
      it('should return display info for current card', () => {
        const card: RuleCard = {
          icon: 'mirror',
          hint: 'Enemies mirror your fire; shoot gaps',
          mechanic: 'mirror_fire',
        };
        system.loadCard(card);

        const display = system.getDisplayInfo();
        expect(display).toBeDefined();
        expect(display!.icon).toBe('mirror');
        expect(display!.hint).toBe('Enemies mirror your fire; shoot gaps');
      });

      it('should return null display when no card loaded', () => {
        expect(system.getDisplayInfo()).toBeNull();
      });

      it('should track display duration', () => {
        const card: RuleCard = { icon: 'test', hint: 'Test', mechanic: 'mirror_fire' };
        system.loadCard(card);

        system.update(5);
        expect(system.getDisplayDuration()).toBe(5);

        system.update(3);
        expect(system.getDisplayDuration()).toBe(8);
      });

      it('should reset display duration on new card', () => {
        const card1: RuleCard = { icon: 'test1', hint: 'Test1', mechanic: 'mirror_fire' };
        const card2: RuleCard = { icon: 'test2', hint: 'Test2', mechanic: 'rhythm_sync' };

        system.loadCard(card1);
        system.update(10);
        system.loadCard(card2);

        expect(system.getDisplayDuration()).toBe(0);
      });
    });

    describe('Mechanic Activation', () => {
      it('should activate mechanic on card load', () => {
        const callback = vi.fn();
        system.onMechanicActivate('mirror_fire', callback);

        const card: RuleCard = { icon: 'mirror', hint: 'Test', mechanic: 'mirror_fire' };
        system.loadCard(card);

        expect(callback).toHaveBeenCalled();
      });

      it('should deactivate mechanic on card clear', () => {
        const callback = vi.fn();
        system.onMechanicDeactivate('mirror_fire', callback);

        const card: RuleCard = { icon: 'mirror', hint: 'Test', mechanic: 'mirror_fire' };
        system.loadCard(card);
        system.clearCard();

        expect(callback).toHaveBeenCalled();
      });

      it('should check if mechanic is active', () => {
        const card: RuleCard = { icon: 'mirror', hint: 'Test', mechanic: 'mirror_fire' };
        system.loadCard(card);

        expect(system.isMechanicActive('mirror_fire')).toBe(true);
        expect(system.isMechanicActive('rhythm_sync')).toBe(false);
      });

      it('should pass params to mechanic callback', () => {
        const callback = vi.fn();
        system.onMechanicActivate('attention_tax', callback);

        const card: RuleCard = {
          icon: 'eye',
          hint: 'Test',
          mechanic: 'attention_tax',
          params: { taxRate: 0.5 },
        };
        system.loadCard(card);

        expect(callback).toHaveBeenCalledWith({ taxRate: 0.5 });
      });
    });

    describe('Mechanic Effects', () => {
      describe('mirror_fire', () => {
        it('should enable enemy mirroring', () => {
          const card: RuleCard = { icon: 'mirror', hint: 'Test', mechanic: 'mirror_fire' };
          system.loadCard(card);

          expect(system.shouldEnemiesMirror()).toBe(true);
        });

        it('should disable enemy mirroring when cleared', () => {
          const card: RuleCard = { icon: 'mirror', hint: 'Test', mechanic: 'mirror_fire' };
          system.loadCard(card);
          system.clearCard();

          expect(system.shouldEnemiesMirror()).toBe(false);
        });
      });

      describe('attention_tax', () => {
        it('should apply attention tax to score', () => {
          const card: RuleCard = {
            icon: 'eye',
            hint: 'Test',
            mechanic: 'attention_tax',
            params: { taxRate: 0.2 },
          };
          system.loadCard(card);

          const taxedScore = system.applyScoreModifier(100);
          expect(taxedScore).toBe(80); // 20% tax
        });

        it('should not apply tax when mechanic inactive', () => {
          const score = system.applyScoreModifier(100);
          expect(score).toBe(100);
        });
      });

      describe('sequence_kill', () => {
        it('should track kill sequence', () => {
          const card: RuleCard = {
            icon: 'sequence',
            hint: 'Test',
            mechanic: 'sequence_kill',
            params: { sequence: ['A', 'B', 'C'] },
          };
          system.loadCard(card);

          expect(system.getRequiredSequence()).toEqual(['A', 'B', 'C']);
        });

        it('should validate kill in sequence', () => {
          const card: RuleCard = {
            icon: 'sequence',
            hint: 'Test',
            mechanic: 'sequence_kill',
            params: { sequence: ['A', 'B', 'C'] },
          };
          system.loadCard(card);

          expect(system.validateKill('A')).toBe(true);
          expect(system.validateKill('B')).toBe(true);
          expect(system.validateKill('C')).toBe(true);
          expect(system.isSequenceComplete()).toBe(true);
        });

        it('should reject out-of-sequence kill', () => {
          const card: RuleCard = {
            icon: 'sequence',
            hint: 'Test',
            mechanic: 'sequence_kill',
            params: { sequence: ['A', 'B', 'C'] },
          };
          system.loadCard(card);

          expect(system.validateKill('B')).toBe(false); // Should be A first
        });
      });

      describe('rhythm_sync', () => {
        it('should track rhythm timing', () => {
          const card: RuleCard = {
            icon: 'rhythm',
            hint: 'Test',
            mechanic: 'rhythm_sync',
            params: { bpm: 120 },
          };
          system.loadCard(card);

          expect(system.getRhythmBPM()).toBe(120);
        });

        it('should check if action is on beat', () => {
          const card: RuleCard = {
            icon: 'rhythm',
            hint: 'Test',
            mechanic: 'rhythm_sync',
            params: { bpm: 60 }, // 1 beat per second
          };
          system.loadCard(card);

          // At time 0, should be on beat
          system.update(0);
          expect(system.isOnBeat(0.1)).toBe(true); // Within tolerance

          // At time 0.5, should be off beat
          system.update(0.5);
          expect(system.isOnBeat(0.1)).toBe(false);
        });

        it('should give bonus for on-beat actions', () => {
          const card: RuleCard = {
            icon: 'rhythm',
            hint: 'Test',
            mechanic: 'rhythm_sync',
            params: { bpm: 60, bonusMultiplier: 2 },
          };
          system.loadCard(card);

          const bonus = system.getRhythmBonus(true); // On beat
          expect(bonus).toBe(2);

          const noBonus = system.getRhythmBonus(false); // Off beat
          expect(noBonus).toBe(1);
        });
      });

      describe('no_damage_bonus', () => {
        it('should track no-damage duration', () => {
          const card: RuleCard = {
            icon: 'shield',
            hint: 'Test',
            mechanic: 'no_damage_bonus',
            params: { requiredDuration: 10, bonusReward: 'powerup' },
          };
          system.loadCard(card);

          system.update(5);
          expect(system.getNoDamageDuration()).toBe(5);
        });

        it('should reset on damage', () => {
          const card: RuleCard = {
            icon: 'shield',
            hint: 'Test',
            mechanic: 'no_damage_bonus',
            params: { requiredDuration: 10 },
          };
          system.loadCard(card);

          system.update(5);
          system.onPlayerDamage();
          expect(system.getNoDamageDuration()).toBe(0);
        });

        it('should trigger reward at threshold', () => {
          const callback = vi.fn();
          system.onNoDamageReward(callback);

          const card: RuleCard = {
            icon: 'shield',
            hint: 'Test',
            mechanic: 'no_damage_bonus',
            params: { requiredDuration: 10, bonusReward: 'powerup' },
          };
          system.loadCard(card);

          system.update(10);
          expect(callback).toHaveBeenCalledWith('powerup');
        });
      });

      describe('stillness_reward', () => {
        it('should track stillness', () => {
          const card: RuleCard = {
            icon: 'zen',
            hint: 'Test',
            mechanic: 'stillness_reward',
            params: { requiredStillness: 5 },
          };
          system.loadCard(card);

          system.updateStillness(3, false); // Not moving
          expect(system.getStillnessProgress()).toBe(3);
        });

        it('should reset stillness on movement', () => {
          const card: RuleCard = {
            icon: 'zen',
            hint: 'Test',
            mechanic: 'stillness_reward',
            params: { requiredStillness: 5 },
          };
          system.loadCard(card);

          system.updateStillness(3, false);
          system.updateStillness(1, true); // Moving
          expect(system.getStillnessProgress()).toBe(0);
        });

        it('should trigger reward at stillness threshold', () => {
          const callback = vi.fn();
          system.onStillnessReward(callback);

          const card: RuleCard = {
            icon: 'zen',
            hint: 'Test',
            mechanic: 'stillness_reward',
            params: { requiredStillness: 5, reward: 'shield' },
          };
          system.loadCard(card);

          system.updateStillness(5, false);
          expect(callback).toHaveBeenCalledWith('shield');
        });
      });
    });

    describe('Card Visibility', () => {
      it('should show card initially', () => {
        const card: RuleCard = { icon: 'test', hint: 'Test', mechanic: 'mirror_fire' };
        system.loadCard(card);
        expect(system.isCardVisible()).toBe(true);
      });

      it('should hide card after display duration', () => {
        const card: RuleCard = { icon: 'test', hint: 'Test', mechanic: 'mirror_fire' };
        system.loadCard(card);
        system.setDisplayDuration(5);

        system.update(6);
        expect(system.isCardVisible()).toBe(false);
      });

      it('should allow manual show/hide', () => {
        const card: RuleCard = { icon: 'test', hint: 'Test', mechanic: 'mirror_fire' };
        system.loadCard(card);

        system.hideCard();
        expect(system.isCardVisible()).toBe(false);

        system.showCard();
        expect(system.isCardVisible()).toBe(true);
      });
    });

    describe('Events', () => {
      it('should emit card loaded event', () => {
        const callback = vi.fn();
        system.on('card:loaded', callback);

        const card: RuleCard = { icon: 'test', hint: 'Test', mechanic: 'mirror_fire' };
        system.loadCard(card);

        expect(callback).toHaveBeenCalledWith({ card });
      });

      it('should emit card cleared event', () => {
        const callback = vi.fn();
        system.on('card:cleared', callback);

        const card: RuleCard = { icon: 'test', hint: 'Test', mechanic: 'mirror_fire' };
        system.loadCard(card);
        system.clearCard();

        expect(callback).toHaveBeenCalled();
      });

      it('should emit mechanic triggered event', () => {
        const callback = vi.fn();
        system.on('mechanic:triggered', callback);

        const card: RuleCard = {
          icon: 'sequence',
          hint: 'Test',
          mechanic: 'sequence_kill',
          params: { sequence: ['A'] },
        };
        system.loadCard(card);
        system.validateKill('A');

        expect(callback).toHaveBeenCalledWith({ mechanic: 'sequence_kill', action: 'kill', target: 'A' });
      });
    });
  });
});
