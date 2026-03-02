// ===== OFFICER SERVICE =====

import { AFFAIRS_CONFIG } from './config.js';

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
    return {
      name: document.getElementById('search-name').value.trim(),
      gender: document.getElementById('search-gender').value,
      ideology: document.getElementById('search-ideology').value,
      corps: document.getElementById('search-corps').value,
      location: document.getElementById('search-location').value,
      trait: document.getElementById('search-trait').value
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
      if (!matchesName(o, filters.name)) return false;
      if (filters.gender && o.gender !== filters.gender) return false;
      if (filters.ideology && o.ideology !== filters.ideology) return false;
      if (filters.corps && o.corps !== filters.corps) return false;
      if (filters.location && o.location !== filters.location) return false;
      if (filters.trait && !o.traits.includes(filters.trait)) return false;
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
