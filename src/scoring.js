// ===== SCORING ENGINE =====

import { AFFAIRS_CONFIG } from './config.js';

export class ScoringEngine {
  constructor(config = AFFAIRS_CONFIG) {
    this.config = config;
  }

  calculateScore(officer, affairKey) {
    const cfg = this.config[affairKey];
    let score = cfg.baseCalc(officer);
    for (const [trait, bonus] of Object.entries(cfg.traitBonuses)) {
      if (officer.traits.includes(trait)) {
        score += bonus;
      }
    }
    return score;
  }

  precomputeScores(officers) {
    for (const officer of officers) {
      officer.scores = {};
      for (const key of Object.keys(this.config)) {
        officer.scores[key] = this.calculateScore(officer, key);
      }
      officer.total = officer.leadership + officer.power + officer.intelligence + officer.politics + officer.charm;
    }
  }
}
