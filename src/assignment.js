// ===== ASSIGNMENT ENGINE =====

import { SORT_KEYS, DEFAULT_ASSIGNMENT_CONFIG } from './config.js';
import { OFFICERS, CITIES } from '../data.js';

// ===== Sort helpers =====

function statCalc(keyId) {
  const entry = SORT_KEYS[keyId];
  return entry ? entry.calc : SORT_KEYS.ip.calc;
}

function descBy(keyId) {
  const calc = statCalc(keyId);
  return (a, b) => calc(b) - calc(a);
}

function absDistAsc(keyId, targetValue) {
  const calc = statCalc(keyId);
  return (a, b) => Math.abs(calc(a) - targetValue) - Math.abs(calc(b) - targetValue);
}

function traitPrioritySort(traitName, sortKeyId) {
  const tiebreak = descBy(sortKeyId);
  return (a, b) => {
    const ta = traitName && a.traits.includes(traitName) ? 1 : 0;
    const tb = traitName && b.traits.includes(traitName) ? 1 : 0;
    if (ta !== tb) return tb - ta;
    return tiebreak(a, b);
  };
}

export function getCityRegionSlots(state, city) {
  const override = state.citySlotOverrides[city.id];
  return (override !== undefined && override !== null) ? override : city.regionSlots;
}

export function getEffectiveDeathYear(officer, lifespanMode) {
  if (lifespanMode === 'none') return Infinity;
  if (lifespanMode === 'longLived') return officer.deathYear + 20;
  return officer.deathYear;
}

export class AssignmentEngine {
  constructor(appState) {
    this.state = appState;
  }

  get cfg() {
    return this.state.assignmentConfig || DEFAULT_ASSIGNMENT_CONFIG;
  }

  run() {
    const assignedToCorps = this.state.getAssignedOfficerIds();
    const manualTradeIds = this.state.getManualTradeIds();

    let pool = this.state.rosterIds
      .filter(id => !assignedToCorps.has(id) && !manualTradeIds.has(id))
      .map(id => OFFICERS.find(o => o.id === id))
      .filter(Boolean);

    // 사망 예정(현재 연도에 실효 사망년 도달) 무장을 pool에서 분리
    const dyingThisYear = [];
    const { currentYear, lifespanMode, lifespanExtendedIds } = this.state;
    if (currentYear != null) {
      pool = pool.filter(o => {
        const eff = getEffectiveDeathYear(o, lifespanMode);
        if (eff === currentYear && !lifespanExtendedIds.has(o.id)) {
          dyingThisYear.push(o.id);
          return false;
        }
        return true;
      });
    }

    // 방어군단 멤버를 도시별로 사전 수집 (지역내정요원으로 배정)
    const cityDefenseMap = new Map();
    const rosterSet = new Set(this.state.rosterIds);
    for (const corps of this.state.corps) {
      if (corps.role !== '방어' || corps.sourceCity == null) continue;
      for (const rank of (corps.ranks || [])) {
        for (const memberId of rank.memberIds) {
          if (!rosterSet.has(memberId)) continue;
          if (!cityDefenseMap.has(corps.sourceCity)) {
            cityDefenseMap.set(corps.sourceCity, []);
          }
          cityDefenseMap.get(corps.sourceCity).push(memberId);
        }
      }
    }

    const activeNations = Object.entries(this.state.tradeNations)
      .filter(([, v]) => v)
      .map(([k]) => k);

    const ownedCities = this.state.ownedCityIds
      .map(id => CITIES.find(c => c.id === id))
      .filter(Boolean);

    const N = ownedCities.length;
    const recruitN = ownedCities.filter(c => !this.state.cityRecruitDisabled[c.id]).length;
    const manualTradeCount = activeNations.reduce(
      (sum, n) => sum + (this.state.manualTrade[n] || []).filter(id => this.state.rosterIds.includes(id)).length, 0);
    const cfg = this.cfg;
    const tradeSlots = cfg.maxTradersPerNation * activeNations.length - manualTradeCount;

    const result = {
      tradeAgents: {},
      cities: ownedCities.map(c => ({
        cityId: c.id,
        cityName: c.name,
        province: c.province,
        regionSlots: getCityRegionSlots(this.state, c),
        governor: null,
        recruiter: null,
        trainer: null,
        regionalAdmins: [],
        defenseAdmins: cityDefenseMap.get(c.id) || []
      })),
      unassigned: [],
      dyingThisYear
    };

    // ===== 분류 단계 =====
    const adminPool = [];
    const recruitPool = [];
    const trainPool = [];
    const tradePool = [];

    // Step 1: 내정풀 진입 (능력치 >= 최소값)
    const adminCalc = statCalc(cfg.adminPoolStat);
    pool = pool.filter(o => {
      if (adminCalc(o) >= cfg.adminPoolMinValue) {
        adminPool.push(o);
        return false;
      }
      return true;
    });

    // Step 2: 모병 개성 → 모병 풀
    pool = pool.filter(o => {
      if (cfg.recruitTrait && o.traits.includes(cfg.recruitTrait)) {
        recruitPool.push(o);
        return false;
      }
      return true;
    });

    // Step 3: 훈련 개성 → 훈련 풀
    pool = pool.filter(o => {
      if (cfg.trainTrait && o.traits.includes(cfg.trainTrait)) {
        trainPool.push(o);
        return false;
      }
      return true;
    });

    // Step 4: 교역 개성 → 교역 풀 (교역국이 있을 때만)
    if (activeNations.length > 0) {
      pool = pool.filter(o => {
        if (cfg.tradeTrait && o.traits.includes(cfg.tradeTrait)) {
          tradePool.push(o);
          return false;
        }
        return true;
      });
    }

    // Step 5: 모병 잔여 슬롯 채움
    const recruitRemain = Math.max(0, recruitN - recruitPool.length);
    if (recruitRemain > 0 && pool.length > 0) {
      pool.sort(descBy(cfg.recruitSortKey));
      recruitPool.push(...pool.splice(0, recruitRemain));
    }

    // Step 6: 훈련 잔여 슬롯 채움
    const trainRemain = Math.max(0, N - trainPool.length);
    if (trainRemain > 0 && pool.length > 0) {
      pool.sort(descBy(cfg.trainSortKey));
      trainPool.push(...pool.splice(0, trainRemain));
    }

    // Step 7: 교역 잔여 슬롯 채움 (closest 모드만 — desc 모드는 내정 배치 후 처리)
    const tradeRemain = Math.max(0, tradeSlots - tradePool.length);
    if (cfg.tradeOverflowMode === 'closest' && tradeRemain > 0 && pool.length > 0) {
      pool.sort(absDistAsc(cfg.tradeSortKey, cfg.tradeTargetValue));
      tradePool.push(...pool.splice(0, tradeRemain));
    }

    // Step 8: 나머지 전부 → 내정 풀
    adminPool.push(...pool);
    pool = [];

    // ===== 배정 단계 =====

    // 교역: 개성 우선 + 정렬 기준 내림차순 후 라운드로빈 배정
    tradePool.sort(traitPrioritySort(cfg.tradeTrait, cfg.tradeSortKey));
    for (const nation of activeNations) {
      const manualIds = (this.state.manualTrade[nation] || [])
        .filter(id => this.state.rosterIds.includes(id));
      result.tradeAgents[nation] = [...manualIds];
    }
    let nationIdx = 0;
    const tradeOverflow = [];
    for (const officer of tradePool) {
      let placed = false;
      for (let attempt = 0; attempt < activeNations.length; attempt++) {
        const nation = activeNations[nationIdx % activeNations.length];
        nationIdx++;
        if (result.tradeAgents[nation].length < cfg.maxTradersPerNation) {
          result.tradeAgents[nation].push(officer.id);
          placed = true;
          break;
        }
      }
      if (!placed) tradeOverflow.push(officer);
    }

    // 모병: 개성 우선 + 정렬 기준 내림차순 후 활성 도시당 1명
    recruitPool.sort(traitPrioritySort(cfg.recruitTrait, cfg.recruitSortKey));
    let recruitIdx = 0;
    for (let i = 0; i < result.cities.length && recruitIdx < recruitPool.length; i++) {
      if (this.state.cityRecruitDisabled[result.cities[i].cityId]) continue;
      result.cities[i].recruiter = recruitPool[recruitIdx].id;
      recruitIdx++;
    }
    const recruitOverflow = recruitPool.slice(recruitN);

    // 훈련: 개성 우선 + 정렬 기준 내림차순 후 도시당 1명
    trainPool.sort(traitPrioritySort(cfg.trainTrait, cfg.trainSortKey));
    for (let i = 0; i < result.cities.length && i < trainPool.length; i++) {
      result.cities[i].trainer = trainPool[i].id;
    }
    const trainOverflow = trainPool.slice(N);

    // 내정: 정렬 기준 내림차순 → 도시별 잔여 용량에 라운드로빈 배정, 태수는 도시별 선발
    adminPool.sort(descBy(cfg.adminPoolStat));

    if (result.cities.length > 0 && adminPool.length > 0) {
      const capacity = result.cities.map(c => Math.max(0, c.regionSlots - c.defenseAdmins.length));
      let cityIdx = 0;

      for (const officer of adminPool) {
        let attempts = 0;
        while (capacity[cityIdx] <= 0 && attempts < result.cities.length) {
          cityIdx = (cityIdx + 1) % result.cities.length;
          attempts++;
        }
        if (attempts >= result.cities.length) {
          result.unassigned.push(officer.id);
          continue;
        }
        result.cities[cityIdx].regionalAdmins.push(officer.id);
        capacity[cityIdx]--;
        cityIdx = (cityIdx + 1) % result.cities.length;
      }
    }

    // 태수 선발: 각 도시의 지역내정요원(일반+방어) 중 선발 기준 최고
    const governorCalc = statCalc(cfg.governorSortKey);
    for (const cityResult of result.cities) {
      const allAdmins = [
        ...cityResult.regionalAdmins.map(id => ({ id, source: 'regional' })),
        ...cityResult.defenseAdmins.map(id => ({ id, source: 'defense' }))
      ];
      if (allAdmins.length === 0) continue;

      let bestIdx = 0;
      let bestVal = -1;
      for (let i = 0; i < allAdmins.length; i++) {
        const o = OFFICERS.find(x => x.id === allAdmins[i].id);
        if (!o) continue;
        const val = governorCalc(o);
        if (val > bestVal) {
          bestVal = val;
          bestIdx = i;
        }
      }

      const best = allAdmins[bestIdx];
      cityResult.governor = best.id;

      if (best.source === 'regional') {
        const idx = cityResult.regionalAdmins.indexOf(best.id);
        if (idx !== -1) cityResult.regionalAdmins.splice(idx, 1);
      } else {
        const idx = cityResult.defenseAdmins.indexOf(best.id);
        if (idx !== -1) cityResult.defenseAdmins.splice(idx, 1);
      }
    }

    // [desc 모드] 내정 배치 후 남은 무장에서 교역 잔여 슬롯 채움
    if (cfg.tradeOverflowMode === 'desc') {
      const descTradeRemain = Math.max(0, tradeSlots - tradePool.length);
      if (descTradeRemain > 0 && result.unassigned.length > 0) {
        const candidates = result.unassigned
          .map(id => OFFICERS.find(o => o.id === id))
          .filter(Boolean);
        candidates.sort(descBy(cfg.tradeSortKey));
        const toTrade = candidates.slice(0, descTradeRemain);
        const toTradeIds = new Set(toTrade.map(o => o.id));
        result.unassigned = result.unassigned.filter(id => !toTradeIds.has(id));
        let lateNationIdx = 0;
        for (const officer of toTrade) {
          let placed = false;
          for (let attempt = 0; attempt < activeNations.length; attempt++) {
            const nation = activeNations[lateNationIdx % activeNations.length];
            lateNationIdx++;
            if (result.tradeAgents[nation].length < cfg.maxTradersPerNation) {
              result.tradeAgents[nation].push(officer.id);
              placed = true;
              break;
            }
          }
          if (!placed) result.unassigned.push(officer.id);
        }
      }
    }

    // 초과분 → 미할당
    for (const o of tradeOverflow) result.unassigned.push(o.id);
    for (const o of recruitOverflow) result.unassigned.push(o.id);
    for (const o of trainOverflow) result.unassigned.push(o.id);

    return result;
  }
}
