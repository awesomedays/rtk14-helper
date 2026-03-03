// ===== PERSISTENCE MANAGER =====

import { DEFAULT_ASSIGNMENT_CONFIG } from './config.js';

const KEYS = {
  roster: 'rtk14_roster',
  cities: 'rtk14_cities',
  corps: 'rtk14_corps',
  trade: 'rtk14_trade',
  manualTrade: 'rtk14_manual_trade',
  citySlots: 'rtk14_city_slots',
  cityRecruit: 'rtk14_city_recruit',
  summon: 'rtk14_summon',
  appointment: 'rtk14_appointment',
  assignmentConfig: 'rtk14_assignment_config',
  theme: 'rtk14_theme',
};

const ALL_KEYS = Object.values(KEYS);

export class PersistenceManager {
  constructor(appState) {
    this.state = appState;
  }

  // ===== Save =====

  saveRoster() {
    localStorage.setItem(KEYS.roster, JSON.stringify(this.state.rosterIds));
  }

  saveCities() {
    localStorage.setItem(KEYS.cities, JSON.stringify(this.state.ownedCityIds));
  }

  saveCorps() {
    localStorage.setItem(KEYS.corps, JSON.stringify({
      corps: this.state.corps,
      nextId: this.state.corpsNextId
    }));
  }

  saveTradeNations() {
    localStorage.setItem(KEYS.trade, JSON.stringify(this.state.tradeNations));
  }

  saveManualTrade() {
    localStorage.setItem(KEYS.manualTrade, JSON.stringify(this.state.manualTrade));
  }

  saveCitySlots() {
    localStorage.setItem(KEYS.citySlots, JSON.stringify(this.state.citySlotOverrides));
  }

  saveCityRecruit() {
    localStorage.setItem(KEYS.cityRecruit, JSON.stringify(this.state.cityRecruitDisabled));
  }

  saveSummon() {
    localStorage.setItem(KEYS.summon, JSON.stringify([...this.state.summonedIds]));
  }

  saveAppointment() {
    localStorage.setItem(KEYS.appointment, JSON.stringify([...this.state.appointmentIds]));
  }

  saveAssignmentConfig() {
    localStorage.setItem(KEYS.assignmentConfig, JSON.stringify(this.state.assignmentConfig));
  }

  saveTheme(value) {
    localStorage.setItem(KEYS.theme, value);
  }

  // ===== Load =====

  loadRoster() {
    try {
      const saved = localStorage.getItem(KEYS.roster);
      if (saved) this.state.rosterIds = [...new Set(JSON.parse(saved))];
    } catch (e) { /* ignore */ }
  }

  loadCities() {
    try {
      const saved = localStorage.getItem(KEYS.cities);
      if (saved) this.state.ownedCityIds = [...new Set(JSON.parse(saved))];
    } catch (e) { /* ignore */ }
  }

  loadCorps() {
    try {
      const saved = localStorage.getItem(KEYS.corps);
      if (saved) {
        const data = JSON.parse(saved);
        this.state.corps = data.corps || [];
        this.state.corpsNextId = data.nextId || 1;
        // Migrate old memberIds format → ranks format
        for (const c of this.state.corps) {
          if (c.memberIds && !c.ranks) {
            c.ranks = c.memberIds.length > 0
              ? [{ id: 1, name: '멤버', memberIds: c.memberIds }]
              : [];
            c.rankNextId = 2;
            delete c.memberIds;
          }
          if (!c.ranks) { c.ranks = []; c.rankNextId = 1; }
          if (!c.rankNextId) c.rankNextId = 1;
        }
      }
    } catch (e) { /* ignore */ }
  }

  loadTradeNations() {
    try {
      const saved = localStorage.getItem(KEYS.trade);
      if (saved) this.state.tradeNations = JSON.parse(saved);
    } catch (e) { /* ignore */ }
  }

  loadManualTrade() {
    try {
      const saved = localStorage.getItem(KEYS.manualTrade);
      if (saved) this.state.manualTrade = JSON.parse(saved);
    } catch (e) { /* ignore */ }
  }

  loadCitySlots() {
    try {
      const saved = localStorage.getItem(KEYS.citySlots);
      if (saved) this.state.citySlotOverrides = JSON.parse(saved);
    } catch (e) { /* ignore */ }
  }

  loadCityRecruit() {
    try {
      const saved = localStorage.getItem(KEYS.cityRecruit);
      if (saved) this.state.cityRecruitDisabled = JSON.parse(saved);
    } catch (e) { /* ignore */ }
  }

  loadSummon() {
    try {
      const saved = localStorage.getItem(KEYS.summon);
      if (saved) this.state.summonedIds = new Set(JSON.parse(saved));
    } catch (e) { /* ignore */ }
  }

  loadAppointment() {
    try {
      const saved = localStorage.getItem(KEYS.appointment);
      if (saved) this.state.appointmentIds = new Set(JSON.parse(saved));
    } catch (e) { /* ignore */ }
  }

  loadAssignmentConfig() {
    try {
      const saved = localStorage.getItem(KEYS.assignmentConfig);
      if (saved) {
        this.state.assignmentConfig = { ...DEFAULT_ASSIGNMENT_CONFIG, ...JSON.parse(saved) };
      }
    } catch (e) { /* ignore */ }
  }

  loadTheme() {
    return localStorage.getItem(KEYS.theme); // 'dark' | 'light' | null
  }

  loadAll() {
    this.loadRoster();
    this.loadCities();
    this.loadCorps();
    this.loadTradeNations();
    this.loadManualTrade();
    this.loadCitySlots();
    this.loadCityRecruit();
    this.loadSummon();
    this.loadAppointment();
    this.loadAssignmentConfig();
  }

  // ===== Export / Import =====

  exportState() {
    const data = {};
    for (const key of ALL_KEYS) {
      const val = localStorage.getItem(key);
      if (val) {
        try { data[key] = JSON.parse(val); } catch (e) { data[key] = val; }
      }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().slice(0, 10);
    a.download = `rtk14_state_${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importState(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        for (const [key, val] of Object.entries(data)) {
          if (ALL_KEYS.includes(key)) {
            localStorage.setItem(key, JSON.stringify(val));
          }
        }
        location.reload();
      } catch (e) {
        alert('상태 파일을 읽을 수 없습니다.');
      }
    };
    reader.readAsText(file);
  }
}
