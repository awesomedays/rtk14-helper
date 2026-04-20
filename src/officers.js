// ===== OFFICER SERVICE =====

import { AFFAIRS_CONFIG } from './config.js';
import { state } from './state.js';

const ETHNIC_TRAITS = ['남만', '오환', '선비', '산월'];

function isEthnicOfficer(o) {
  if (o.location === '강' || o.faction === '강') return true;
  return (o.traits || []).some(t => ETHNIC_TRAITS.includes(t));
}

// ===== Korean Initial Consonant Search =====

const INITIAL_CONSONANTS = [
  'ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ',
  'ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'
];

function getInitialConsonant(char) {
  const code = char.charCodeAt(0);
  if (code < 0xAC00 || code > 0xD7A3) return char;
  return INITIAL_CONSONANTS[Math.floor((code - 0xAC00) / 588)];
}

function getInitials(str) {
  return [...str].map(getInitialConsonant).join('');
}

function isAllConsonants(str) {
  return [...str].every(c => INITIAL_CONSONANTS.includes(c));
}

export function matchesName(officer, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  const name = officer.name.toLowerCase();
  if (name.includes(q)) return true;
  if (isAllConsonants(query)) {
    return getInitials(officer.name).includes(query);
  }
  return false;
}

// ===== Officer Service =====

export class OfficerService {
  constructor(config = AFFAIRS_CONFIG) {
    this.config = config;
  }

  getOptimizeFilters() {
    return {
      corps: document.getElementById('opt-corps').value,
      location: document.getElementById('opt-location').value,
      minStat: parseInt(document.getElementById('opt-min-stat').value) || 0
    };
  }

  getSearchFilters() {
    const affMin = parseInt(document.getElementById('search-affinity-min').value);
    const affMax = parseInt(document.getElementById('search-affinity-max').value);
    const yearMin = parseInt(document.getElementById('search-appear-min').value);
    const yearMax = parseInt(document.getElementById('search-appear-max').value);
    return {
      name: document.getElementById('search-name').value.trim(),
      location: document.getElementById('search-location').value,
      affinityMin: isNaN(affMin) ? null : affMin,
      affinityMax: isNaN(affMax) ? null : affMax,
      appearMin: isNaN(yearMin) ? null : yearMin,
      appearMax: isNaN(yearMax) ? null : yearMax,
      traitFilters: state.searchTraitFilters,
      formationFilters: state.searchFormationFilters,
      tacticsFilters: state.searchTacticsFilters,
    };
  }

  filterForOptimize(officers, filters, affairKey) {
    const config = this.config[affairKey];
    return officers.filter(o => {
      if (filters.corps && o.corps !== filters.corps) return false;
      if (filters.location && o.location !== filters.location) return false;
      if (filters.minStat && config.baseCalc(o) < filters.minStat) return false;
      return true;
    });
  }

  filterForSearch(officers, filters) {
    return officers.filter(o => {
      if (state.searchHideDummy && o.status === '무효') return false;
      if (state.searchHideEthnic && isEthnicOfficer(o)) return false;
      if (!matchesName(o, filters.name)) return false;
      if (filters.location && o.location !== filters.location) return false;
      if (filters.affinityMin !== null && o.affinity < filters.affinityMin) return false;
      if (filters.affinityMax !== null && o.affinity > filters.affinityMax) return false;
      if (filters.appearMin !== null && o.appearYear < filters.appearMin) return false;
      if (filters.appearMax !== null && o.appearYear > filters.appearMax) return false;
      if (filters.traitFilters && filters.traitFilters.length && !filters.traitFilters.every(t => o.traits.includes(t))) return false;
      if (filters.formationFilters && filters.formationFilters.length && !filters.formationFilters.every(f => (o.formations || []).includes(f))) return false;
      if (filters.tacticsFilters && filters.tacticsFilters.length && !filters.tacticsFilters.every(t => (o.tactics || []).includes(t))) return false;
      return true;
    });
  }

  sortOfficers(officers, key, dir, currentAffair) {
    const config = this.config;
    return [...officers].sort((a, b) => {
      let va, vb;
      if (key === 'score') {
        va = a.scores[currentAffair];
        vb = b.scores[currentAffair];
      } else if (key === 'baseStat') {
        const calc = config[currentAffair].baseCalc;
        va = calc(a);
        vb = calc(b);
      } else if (key === 'total') {
        va = a.total;
        vb = b.total;
      } else if (key === 'lp') {
        va = a.leadership + a.power;
        vb = b.leadership + b.power;
      } else if (key === 'ip') {
        va = a.intelligence + a.politics;
        vb = b.intelligence + b.politics;
      } else {
        va = a[key];
        vb = b[key];
      }
      if (typeof va === 'string') {
        const cmp = va.localeCompare(vb, 'ko');
        return dir === 'asc' ? cmp : -cmp;
      }
      return dir === 'asc' ? va - vb : vb - va;
    });
  }
}
