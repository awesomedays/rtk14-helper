// ===== STATE MANAGEMENT =====

import { PAGE_SIZE, DEFAULT_ASSIGNMENT_CONFIG } from './config.js';

export class AppState {
  constructor() {
    this.currentCategory = 'current';
    this.currentTab = 'roster';
    this.currentAffair = 'agriculture';
    this.optimizeSort = { key: 'score', dir: 'desc' };
    this.searchSort = { key: 'id', dir: 'asc' };
    this.optimizeShown = PAGE_SIZE;
    this.searchShown = PAGE_SIZE;
    this.compareIds = [];
    this.rosterIds = [];
    this.rosterSort = { key: 'name', dir: 'asc' };
    this.rosterTraitFilters = [];
    this.rosterFormationFilters = [];
    this.rosterTacticsFilters = [];
    this.rosterRelationFilters = [];
    this.searchTraitFilters = [];
    this.searchFormationFilters = [];
    this.searchTacticsFilters = [];
    this.searchHideDummy = true;
    this.searchHideEthnic = false;
    this.officerTacticsOverrides = {};
    // 보유도시
    this.ownedCityIds = [];
    // 군단관리
    this.corps = [];
    this.corpsNextId = 1;
    // 내정관리
    this.tradeNations = { ansik: false, cheonchuk: false, daejin: false, guisang: false };
    this.manualTrade = { ansik: [], cheonchuk: [], daejin: [], guisang: [] };
    this.citySlotOverrides = {};
    this.cityRecruitDisabled = {};
    this.assignmentResult = null;
    this.assignmentConfig = { ...DEFAULT_ASSIGNMENT_CONFIG };
    // 수명/사망 설정
    this.currentYear = null;
    this.lifespanMode = 'realistic';
    this.lifespanExtendedIds = new Set();
    // 호출현황
    this.summonedIds = new Set();
    // 임명현황
    this.appointmentIds = new Set();
  }

  getAssignedOfficerIds() {
    const ids = new Set();
    for (const c of this.corps) {
      for (const rank of (c.ranks || [])) {
        for (const id of rank.memberIds) ids.add(id);
      }
    }
    return ids;
  }

  getManualTradeIds() {
    const ids = new Set();
    for (const arr of Object.values(this.manualTrade)) {
      for (const id of arr) ids.add(id);
    }
    return ids;
  }
}

export const state = new AppState();
