// ===== UI RENDERER =====

import { AFFAIRS_CONFIG, THRESHOLDS, TRADE_NATION_NAMES, LIMITS, SORT_KEYS, TRADE_OVERFLOW_MODES, DEFAULT_ASSIGNMENT_CONFIG } from './config.js';
import { OFFICERS, CITIES, ALL_TRAITS } from '../data.js';
import { getCityRegionSlots } from './assignment.js';

export class UIRenderer {
  constructor(appState, officerService) {
    this.state = appState;
    this.officerService = officerService;
  }

  // ===== CSS Class Helpers =====

  getScoreClass(score) {
    if (score >= THRESHOLDS.scoreExceptional) return 'score--exceptional';
    if (score >= THRESHOLDS.scoreHigh) return 'score--high';
    if (score >= THRESHOLDS.scoreGood) return 'score--good';
    if (score >= THRESHOLDS.scoreMid) return 'score--mid';
    return 'score--low';
  }

  getStatClass(val) {
    if (val >= THRESHOLDS.statHigh) return 'stat-high';
    if (val >= THRESHOLDS.statMid) return 'stat-mid';
    return 'stat-low';
  }

  corpsStatClass(val) {
    if (val >= THRESHOLDS.corpsStatHigh) return 'stat--high';
    if (val >= THRESHOLDS.corpsStatMid) return 'stat--mid';
    return '';
  }

  // ===== Sort Indicators =====

  updateSortIndicators(tableId, sortState) {
    const table = document.getElementById(tableId);
    table.querySelectorAll('th.sortable').forEach(th => {
      th.classList.remove('sort-asc', 'sort-desc');
      if (th.dataset.sort === sortState.key) {
        th.classList.add(sortState.dir === 'asc' ? 'sort-asc' : 'sort-desc');
      }
    });
  }

  // ===== Dropdown Helper =====

  populateDropdown(selectId, items, labelFn) {
    const select = document.getElementById(selectId);
    const firstOption = select.querySelector('option');
    select.innerHTML = '';
    select.appendChild(firstOption);
    items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item;
      opt.textContent = labelFn ? labelFn(item) : item;
      select.appendChild(opt);
    });
  }

  // ===== Trait Badges =====

  renderTraitBadges(officer, affairKey) {
    if (!affairKey) {
      return officer.traits.map(t =>
        `<span class="trait-badge trait-badge--normal">${t}</span>`
      ).join('');
    }
    const config = AFFAIRS_CONFIG[affairKey];
    const bonuses = config.traitBonuses;
    const keyTraits = Object.keys(bonuses).filter(t => bonuses[t] >= 10);

    return officer.traits
      .filter(t => t in bonuses)
      .map(t => {
        const cls = keyTraits.includes(t) ? 'trait-badge--key' : 'trait-badge--support';
        const bonus = bonuses[t];
        return `<span class="trait-badge ${cls}">${t} +${bonus}</span>`;
      }).join('');
  }

  // ===== Optimize Tab =====

  renderOptimizeTable() {
    const affairKey = this.state.currentAffair;
    const config = AFFAIRS_CONFIG[affairKey];
    const filters = this.officerService.getOptimizeFilters();
    let officers = this.officerService.filterForOptimize(OFFICERS, filters, affairKey);
    officers = this.officerService.sortOfficers(officers, this.state.optimizeSort.key, this.state.optimizeSort.dir, affairKey);

    document.getElementById('opt-count').textContent = `${officers.length}명의 무장`;
    document.getElementById('affair-info').innerHTML =
      `<strong>${config.icon} ${config.name}</strong> — ${config.description}`;

    const shown = officers.slice(0, this.state.optimizeShown);
    const tbody = document.getElementById('opt-tbody');
    tbody.innerHTML = shown.map((o, i) => {
      const base = config.baseCalc(o);
      const score = o.scores[affairKey];
      const pct = Math.min(score, 120);
      const cls = this.getScoreClass(score);
      return `<tr>
      <td class="col-rank">${i + 1}</td>
      <td><span class="officer-name" data-id="${o.id}">${o.name}</span></td>
      <td class="col-stat ${this.getStatClass(base)}">${base}</td>
      <td><div class="score-cell ${cls}">
        <div class="score-bar"><div class="score-bar__fill" style="width:${pct}%"></div></div>
        <span class="score-value">${score}</span>
      </div></td>
      <td><div class="trait-badges">${this.renderTraitBadges(o, affairKey)}</div></td>
      <td>${o.location}</td>
      <td>${o.corps || '재야'}</td>
    </tr>`;
    }).join('');

    const loadMore = document.getElementById('opt-load-more');
    loadMore.style.display = officers.length > this.state.optimizeShown ? '' : 'none';

    this.updateSortIndicators('opt-table', this.state.optimizeSort);
  }

  // ===== Search Tab =====

  renderSearchTable() {
    const filters = this.officerService.getSearchFilters();
    let officers = this.officerService.filterForSearch(OFFICERS, filters);
    officers = this.officerService.sortOfficers(officers, this.state.searchSort.key, this.state.searchSort.dir, this.state.currentAffair);

    document.getElementById('search-count').textContent = `${officers.length}명의 무장`;

    const shown = officers.slice(0, this.state.searchShown);
    const tbody = document.getElementById('search-tbody');
    tbody.innerHTML = shown.map(o => {
      return `<tr>
      <td class="col-id">${o.id}</td>
      <td><span class="officer-name" data-id="${o.id}">${o.name}</span></td>
      <td class="col-stat ${this.getStatClass(o.leadership)}">${o.leadership}</td>
      <td class="col-stat ${this.getStatClass(o.power)}">${o.power}</td>
      <td class="col-stat ${this.getStatClass(o.intelligence)}">${o.intelligence}</td>
      <td class="col-stat ${this.getStatClass(o.politics)}">${o.politics}</td>
      <td class="col-stat ${this.getStatClass(o.charm)}">${o.charm}</td>
      <td class="col-total ${this.getStatClass(o.total / 5)}">${o.total}</td>
      <td><div class="trait-badges">${o.traits.map(t => `<span class="trait-badge trait-badge--normal">${t}</span>`).join('')}</div></td>
      <td>${o.corps || '재야'}</td>
    </tr>`;
    }).join('');

    const loadMore = document.getElementById('search-load-more');
    loadMore.style.display = officers.length > this.state.searchShown ? '' : 'none';

    this.updateSortIndicators('search-table', this.state.searchSort);
  }

  // ===== Compare Tab =====

  renderCompare() {
    const grid = document.getElementById('compare-grid');
    const chips = document.getElementById('compare-chips');

    chips.innerHTML = this.state.compareIds.map(id => {
      const o = OFFICERS.find(x => x.id === id);
      return `<div class="compare-chip">
      <span>${o.name}</span>
      <button class="compare-chip__remove" data-id="${id}">&times;</button>
    </div>`;
    }).join('');

    if (this.state.compareIds.length === 0) {
      grid.innerHTML = '<p class="compare-placeholder">비교할 무장을 선택해주세요.</p>';
      return;
    }

    const selected = this.state.compareIds.map(id => OFFICERS.find(x => x.id === id));

    const statRows = [
      { label: '통솔', key: 'leadership' },
      { label: '무력', key: 'power' },
      { label: '지력', key: 'intelligence' },
      { label: '정치', key: 'politics' },
      { label: '매력', key: 'charm' },
      { label: '합계', key: 'total' }
    ];

    const affairRows = Object.entries(AFFAIRS_CONFIG).map(([key, cfg]) => ({
      label: `${cfg.icon} ${cfg.name}`,
      key: key
    }));

    function findBest(values) {
      const max = Math.max(...values);
      return values.map(v => v === max);
    }

    let html = '<table class="compare-table"><thead><tr><th></th>';
    html += selected.map(o => `<th>${o.name}</th>`).join('');
    html += '</tr></thead><tbody>';

    // Stats section
    html += `<tr class="compare-section-header"><td colspan="${selected.length + 1}">기본 능력치</td></tr>`;
    for (const row of statRows) {
      const values = selected.map(o => o[row.key]);
      const bests = findBest(values);
      html += `<tr><td>${row.label}</td>`;
      html += selected.map((o, i) => {
        const val = values[i];
        const maxVal = row.key === 'total' ? 500 : 100;
        const pct = (val / maxVal) * 100;
        const color = bests[i] ? 'var(--accent-blue)' : 'var(--border-dark)';
        return `<td class="${bests[i] ? 'best-value' : ''}">
        <span class="compare-bar" style="width:${pct}%;background:${color}"></span>${val}
      </td>`;
      }).join('');
      html += '</tr>';
    }

    // Affairs section
    html += `<tr class="compare-section-header"><td colspan="${selected.length + 1}">내정 점수</td></tr>`;
    for (const row of affairRows) {
      const values = selected.map(o => o.scores[row.key]);
      const bests = findBest(values);
      html += `<tr><td>${row.label}</td>`;
      html += selected.map((o, i) => {
        const val = values[i];
        const pct = Math.min(val, 120);
        const color = bests[i] ? 'var(--accent-blue)' : 'var(--border-dark)';
        return `<td class="${bests[i] ? 'best-value' : ''}">
        <span class="compare-bar" style="width:${pct}%;background:${color}"></span>${val}
      </td>`;
      }).join('');
      html += '</tr>';
    }

    // Traits section
    html += `<tr class="compare-section-header"><td colspan="${selected.length + 1}">개성</td></tr>`;
    const maxTraits = Math.max(...selected.map(o => o.traits.length));
    for (let i = 0; i < maxTraits; i++) {
      html += `<tr><td>${i === 0 ? '' : ''}</td>`;
      html += selected.map(o => {
        const t = o.traits[i] || '';
        return `<td>${t ? `<span class="trait-badge trait-badge--normal">${t}</span>` : ''}</td>`;
      }).join('');
      html += '</tr>';
    }

    html += '</tbody></table>';
    grid.innerHTML = html;
  }

  // ===== Roster Tab =====

  renderRoster() {
    const officers = this.state.rosterIds
      .map(id => OFFICERS.find(o => o.id === id))
      .filter(Boolean);

    const sorted = this.officerService.sortOfficers(officers, this.state.rosterSort.key, this.state.rosterSort.dir, this.state.currentAffair);

    document.getElementById('roster-count').textContent = `보유 무장: ${sorted.length}명`;

    const tbody = document.getElementById('roster-tbody');
    if (sorted.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--text-muted)">무장을 검색하여 추가해주세요.</td></tr>';
      return;
    }

    tbody.innerHTML = sorted.map(o => `<tr>
    <td><span class="officer-name" data-id="${o.id}">${o.name}</span></td>
    <td class="col-stat-sm ${this.getStatClass(o.leadership)}">${o.leadership}</td>
    <td class="col-stat-sm ${this.getStatClass(o.power)}">${o.power}</td>
    <td class="col-stat-sm ${this.getStatClass(o.intelligence)}">${o.intelligence}</td>
    <td class="col-stat-sm ${this.getStatClass(o.politics)}">${o.politics}</td>
    <td class="col-stat-sm ${this.getStatClass(o.charm)}">${o.charm}</td>
    <td class="col-stat ${this.getStatClass((o.leadership + o.power) / 2)}">${o.leadership + o.power}</td>
    <td class="col-stat ${this.getStatClass((o.intelligence + o.politics) / 2)}">${o.intelligence + o.politics}</td>
    <td><div class="trait-badges">${o.traits.map(t =>
      `<span class="trait-badge trait-badge--normal">${t}</span>`
    ).join('')}</div></td>
    <td style="text-align:center"><button class="roster-remove" data-id="${o.id}">&times;</button></td>
  </tr>`).join('');

    this.updateSortIndicators('roster-table', this.state.rosterSort);
  }

  // ===== Cities Tab =====

  renderCities() {
    const cities = this.state.ownedCityIds
      .map(id => CITIES.find(c => c.id === id))
      .filter(Boolean);

    document.getElementById('cities-count').textContent = `보유 도시: ${cities.length}개`;

    const tbody = document.getElementById('cities-tbody');
    if (cities.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted)">도시를 검색하여 추가해주세요.</td></tr>';
      return;
    }

    tbody.innerHTML = cities.map((c, i) => `<tr>
    <td style="text-align:center;font-weight:700;color:var(--accent-gold-bright)">${i + 1}</td>
    <td>${c.name}</td>
    <td class="col-stat">${c.province}</td>
    <td class="col-stat">${c.regionSlots}</td>
    <td style="text-align:center">
      <button class="city-move-up" data-id="${c.id}" ${i === 0 ? 'disabled' : ''}>&#9650;</button>
      <button class="city-move-down" data-id="${c.id}" ${i === cities.length - 1 ? 'disabled' : ''}>&#9660;</button>
    </td>
    <td style="text-align:center"><button class="roster-remove" data-id="${c.id}">&times;</button></td>
  </tr>`).join('');
  }

  // ===== Corps Tab =====

  renderCorpsList(focusTarget) {
    const container = document.getElementById('corps-list');

    if (this.state.corps.length === 0) {
      container.innerHTML = '<p style="text-align:center;padding:24px;color:var(--text-muted)">군단을 추가해주세요.</p>';
      return;
    }

    container.innerHTML = this.state.corps.map(corps => {
      const totalMembers = (corps.ranks || []).reduce((sum, r) => sum + r.memberIds.length, 0);

      const rankSections = (corps.ranks || []).length > 0
        ? corps.ranks.map(rank => {
            const members = rank.memberIds
              .map(id => OFFICERS.find(o => o.id === id))
              .filter(Boolean);

            const memberRows = members.map((o, i) => `<div class="corps-member">
              <span class="officer-name" data-id="${o.id}">${o.name}</span>
              <span class="corps-member__stats">통<span class="${this.corpsStatClass(o.leadership)}">${o.leadership}</span> 무<span class="${this.corpsStatClass(o.power)}">${o.power}</span> 지<span class="${this.corpsStatClass(o.intelligence)}">${o.intelligence}</span> 정<span class="${this.corpsStatClass(o.politics)}">${o.politics}</span></span>
              <button class="corps-member-up" data-corps-id="${corps.id}" data-rank-id="${rank.id}" data-officer-id="${o.id}" ${i === 0 ? 'disabled' : ''}>&#9650;</button>
              <button class="corps-member-down" data-corps-id="${corps.id}" data-rank-id="${rank.id}" data-officer-id="${o.id}" ${i === members.length - 1 ? 'disabled' : ''}>&#9660;</button>
              <button class="corps-member__remove" data-corps-id="${corps.id}" data-rank-id="${rank.id}" data-officer-id="${o.id}">&times;</button>
            </div>`).join('');

            return `<div class="corps-rank" data-rank-id="${rank.id}">
            <div class="corps-rank__header">
              <span class="corps-rank__name">${rank.name}</span>
              <span class="corps-rank__count">${members.length}명</span>
              <button class="corps-rank__delete" data-corps-id="${corps.id}" data-rank-id="${rank.id}">삭제</button>
            </div>
            <div class="corps-rank__body">
              <div class="corps-card__member-list">${memberRows}</div>
              <div class="compare-search-wrap corps-search-wrap">
                <input type="text" class="corps-member-input" data-corps-id="${corps.id}" data-rank-id="${rank.id}" placeholder="무장 검색..." autocomplete="off">
                <div class="autocomplete-list corps-member-autocomplete"></div>
              </div>
            </div>
          </div>`;
          }).join('')
        : '<p class="corps-empty-msg">직급을 추가해주세요.</p>';

      // City selector options
      const ownedCities = this.state.ownedCityIds
        .map(id => CITIES.find(c => c.id === id))
        .filter(Boolean);
      const allCities = CITIES;

      const sourceCityOptions = '<option value="">-- 선택 --</option>' +
        ownedCities.map(c =>
          `<option value="${c.id}" ${corps.sourceCity === c.id ? 'selected' : ''}>${c.name} (${c.province})</option>`
        ).join('');

      const targetCityOptions = '<option value="">-- 선택 --</option>' +
        allCities.map(c =>
          `<option value="${c.id}" ${corps.targetCity === c.id ? 'selected' : ''}>${c.name} (${c.province})</option>`
        ).join('');

      const isDefense = corps.role === '방어';

      const citySelector = `<div class="corps-city-selector">
      <div class="corps-city-field">
        <label>소속도시</label>
        <select class="corps-source-city" data-corps-id="${corps.id}">${sourceCityOptions}</select>
      </div>
      ${isDefense ? '' : `<span class="corps-city-arrow">→</span>
      <div class="corps-city-field">
        <label>목표도시</label>
        <select class="corps-target-city" data-corps-id="${corps.id}">${targetCityOptions}</select>
      </div>`}
    </div>`;

      return `<div class="corps-card corps-card--${corps.role}" data-corps-id="${corps.id}">
      <div class="corps-card__header">
        <h3 class="corps-card__name">${corps.name}</h3>
        <span class="role-badge role-badge--${corps.role}">${corps.role}</span>
        <span class="corps-card__count">${totalMembers}명</span>
        <button class="corps-card__delete" data-corps-id="${corps.id}">삭제</button>
      </div>
      ${citySelector}
      <div class="corps-card__body">
        <div class="corps-rank-add">
          <input type="text" class="corps-rank-input" data-corps-id="${corps.id}" placeholder="직급명..." autocomplete="off">
          <button class="corps-rank-add-btn" data-corps-id="${corps.id}">직급 추가</button>
        </div>
        ${rankSections}
      </div>
    </div>`;
    }).join('');

    // Restore focus for continuous search
    if (focusTarget) {
      const input = container.querySelector(
        `.corps-member-input[data-corps-id="${focusTarget.corpsId}"][data-rank-id="${focusTarget.rankId}"]`
      );
      if (input) {
        input.focus();
        input.value = '';
      }
    }
  }

  // ===== Admin Tab =====

  renderAdminCitySlots() {
    const container = document.getElementById('admin-city-slots');
    const cities = this.state.ownedCityIds
      .map(id => CITIES.find(c => c.id === id))
      .filter(Boolean);

    if (cities.length === 0) {
      container.innerHTML = '';
      return;
    }

    const rows = cities.map((c, i) => {
      const current = getCityRegionSlots(this.state, c);
      const isModified = this.state.citySlotOverrides[c.id] !== undefined && this.state.citySlotOverrides[c.id] !== c.regionSlots;
      const recruitEnabled = !this.state.cityRecruitDisabled[c.id];
      const modifiedStyle = isModified ? 'color:#2563eb;border-color:#2563eb;font-weight:600' : '';
      return `<tr>
      <td style="text-align:center;color:var(--text-muted)">${i + 1}</td>
      <td>${c.name} <span style="color:var(--text-muted)">(${c.province})</span></td>
      <td style="text-align:center"><input type="checkbox" class="city-recruit-checkbox" data-city-id="${c.id}" ${recruitEnabled ? 'checked' : ''}></td>
      <td style="text-align:center">${c.regionSlots}</td>
      <td style="text-align:center">
        <input type="number" class="city-slot-input" data-city-id="${c.id}" value="${current}" min="0" max="20" style="width:50px;text-align:center;${modifiedStyle}">
        ${isModified ? '<button class="city-slot-reset" data-city-id="' + c.id + '" title="기본값 복원">↺</button>' : ''}
      </td>
    </tr>`;
    }).join('');

    container.innerHTML = `<div class="admin-section">
    <h3 class="admin-section__title">도시별 내정인원</h3>
    <table class="data-table admin-city-slots-table">
      <thead><tr>
        <th style="width:50px">순위</th>
        <th>도시</th>
        <th style="width:60px">모병</th>
        <th style="width:70px">기본</th>
        <th style="width:100px">배정인원</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
  }

  renderTradeConfig() {
    const container = document.getElementById('trade-manual-config');
    const activeNations = Object.entries(this.state.tradeNations)
      .filter(([, v]) => v)
      .map(([k]) => k);

    if (activeNations.length === 0) {
      container.innerHTML = '';
      return;
    }

    const assignedIds = this.state.getAssignedOfficerIds();
    const allManualIds = this.state.getManualTradeIds();

    let html = '<div style="margin-top:12px"><label style="font-size:0.85rem;color:var(--text-muted)">수동 교역 배정 (현재 이동 중인 무장)</label>';
    for (const nation of activeNations) {
      const ids = this.state.manualTrade[nation] || [];
      html += `<div class="trade-manual" data-nation="${nation}">`;
      html += `<span class="trade-manual__label">${TRADE_NATION_NAMES[nation]}</span>`;
      html += `<div class="trade-manual__body">`;
      for (const id of ids) {
        const o = OFFICERS.find(x => x.id === id);
        if (!o) continue;
        html += `<span class="trade-manual__chip">`;
        html += `<span class="officer-name" data-id="${o.id}">${o.name}</span>`;
        html += `<span class="trade-manual__chip-remove" data-nation="${nation}" data-officer-id="${id}">&times;</span>`;
        html += `</span>`;
      }
      html += `<div class="trade-manual__search">`;
      html += `<input class="trade-manual__input" data-nation="${nation}" placeholder="무장 검색..." autocomplete="off">`;
      html += `<div class="trade-manual-autocomplete"></div>`;
      html += `</div>`;
      html += `</div></div>`;
    }
    html += '</div>';
    container.innerHTML = html;
  }

  renderOfficerChip(officerId, showStat, traitNames) {
    const o = OFFICERS.find(x => x.id === officerId);
    if (!o) return '<span class="text-muted">?</span>';
    const stat = showStat ? ` <span class="admin-chip__stat">${showStat(o)}</span>` : '';
    let traitHtml = '';
    if (traitNames) {
      traitHtml = traitNames
        .filter(t => o.traits.includes(t))
        .map(t => ` <span class="trait-tag trait-tag--${t}">${t}</span>`)
        .join('');
    }
    return `<span class="admin-chip"><span class="officer-name" data-id="${o.id}">${o.name}</span>${stat}${traitHtml}</span>`;
  }

  renderAssignmentConfig() {
    const cfg = this.state.assignmentConfig;

    // Populate sort key selects
    const sortKeySelects = [
      'cfg-admin-pool-stat', 'cfg-recruit-sort', 'cfg-train-sort',
      'cfg-trade-sort', 'cfg-governor-sort'
    ];
    for (const id of sortKeySelects) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.innerHTML = Object.entries(SORT_KEYS)
        .map(([k, v]) => `<option value="${k}">${v.label}</option>`)
        .join('');
    }

    // Populate trait selects
    const traitSelects = ['cfg-recruit-trait', 'cfg-train-trait', 'cfg-trade-trait'];
    for (const id of traitSelects) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.innerHTML = '<option value="">(없음)</option>' +
        ALL_TRAITS.map(t => `<option value="${t}">${t}</option>`).join('');
    }

    // Populate trade overflow mode select
    const modeEl = document.getElementById('cfg-trade-overflow-mode');
    if (modeEl) {
      modeEl.innerHTML = Object.entries(TRADE_OVERFLOW_MODES)
        .map(([k, v]) => `<option value="${k}">${v}</option>`)
        .join('');
    }

    // Set current values
    this.syncAssignmentConfigUI();
  }

  syncAssignmentConfigUI() {
    const cfg = this.state.assignmentConfig;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    set('cfg-admin-pool-stat', cfg.adminPoolStat);
    set('cfg-admin-pool-min', cfg.adminPoolMinValue);
    set('cfg-recruit-trait', cfg.recruitTrait);
    set('cfg-recruit-sort', cfg.recruitSortKey);
    set('cfg-train-trait', cfg.trainTrait);
    set('cfg-train-sort', cfg.trainSortKey);
    set('cfg-trade-trait', cfg.tradeTrait);
    set('cfg-trade-sort', cfg.tradeSortKey);
    set('cfg-trade-overflow-mode', cfg.tradeOverflowMode);
    set('cfg-trade-target-value', cfg.tradeTargetValue);
    set('cfg-max-traders', cfg.maxTradersPerNation);
    set('cfg-governor-sort', cfg.governorSortKey);

    // Toggle trade target row visibility
    const targetRow = document.getElementById('cfg-trade-target-row');
    if (targetRow) {
      targetRow.style.display = cfg.tradeOverflowMode === 'closest' ? '' : 'none';
    }
  }

  renderAssignmentResults(result) {
    const container = document.getElementById('admin-results');
    if (!result) {
      container.innerHTML = '<p style="text-align:center;padding:24px;color:var(--text-muted)">보유무장, 보유도시, 군단을 설정한 후 "배정 실행" 버튼을 눌러주세요.</p>';
      return;
    }

    let html = '';

    // 도시별 배정 섹션
    if (result.cities.length > 0) {
      html += '<div class="admin-section"><h3 class="admin-section__title">도시별 배정</h3>';
      for (let i = 0; i < result.cities.length; i++) {
        const city = result.cities[i];
        html += `<div class="admin-city-card">`;
        html += `<h4 class="admin-city-card__title">${i + 1}순위 — ${city.cityName} <span class="admin-city-card__province">(${city.province})</span></h4>`;

        // 태수
        html += `<div class="admin-role"><span class="admin-role__label">태수</span>`;
        html += city.governor
          ? this.renderOfficerChip(city.governor, o => `지정${o.intelligence + o.politics}`)
          : '<span class="text-muted">미배정</span>';
        html += '</div>';

        // 도시내정
        html += `<div class="admin-role"><span class="admin-role__label">도시내정</span>`;
        html += `<div class="admin-chip-list">`;
        if (city.recruiter) {
          html += this.renderOfficerChip(city.recruiter, o => `무력${o.power}`, ['모집']);
        }
        if (city.trainer) {
          html += this.renderOfficerChip(city.trainer, o => `통무${o.leadership + o.power}`, ['교련']);
        }
        if (!city.recruiter && !city.trainer) {
          html += '<span class="text-muted">미배정</span>';
        }
        html += '</div></div>';

        // 지역내정
        html += `<div class="admin-role"><span class="admin-role__label">지역내정 (${city.regionalAdmins.length}명)</span>`;
        if (city.regionalAdmins.length > 0) {
          html += `<div class="admin-chip-list">`;
          html += city.regionalAdmins.map(id => this.renderOfficerChip(id, o => `지정${o.intelligence + o.politics}`)).join('');
          html += '</div>';
        } else {
          html += '<span class="text-muted">미배정</span>';
        }
        html += '</div>';

        // 방어요원
        if (city.defenseAdmins.length > 0) {
          html += `<hr class="appointment-divider">`;
          html += `<div class="admin-role"><span class="admin-role__label">방어요원 (${city.defenseAdmins.length}명)</span>`;
          html += `<div class="admin-chip-list">`;
          html += city.defenseAdmins.map(id => this.renderOfficerChip(id, o => `지정${o.intelligence + o.politics}`)).join('');
          html += '</div></div>';
        }

        // 내정 배정 합계
        const totalAssigned = (city.governor ? 1 : 0) + city.regionalAdmins.length + city.defenseAdmins.length;
        html += `<div style="text-align:right;margin-top:4px;font-size:0.8rem;color:var(--text-muted)">내정 배정: ${totalAssigned}/${city.regionSlots}</div>`;

        html += '</div>';
      }
      html += '</div>';
    }

    // 교역요원 섹션
    const tradeEntries = Object.entries(result.tradeAgents);
    if (tradeEntries.length > 0) {
      html += '<div class="admin-section"><h3 class="admin-section__title">교역요원</h3>';
      for (const [nation, ids] of tradeEntries) {
        html += `<div class="admin-group">`;
        html += `<h4 class="admin-group__title">${TRADE_NATION_NAMES[nation]} (${ids.length}/${this.state.assignmentConfig.maxTradersPerNation})</h4>`;
        html += `<div class="admin-chip-list">`;
        html += ids.map(id => this.renderOfficerChip(id, o => {
          const ip = o.intelligence + o.politics;
          return `지정${ip}`;
        }, ['특사'])).join('');
        html += '</div></div>';
      }
      html += '</div>';
    }

    // 미배정 섹션 (테이블 형태)
    if (result.unassigned.length > 0) {
      html += '<div class="admin-section"><h3 class="admin-section__title">미배정 (' + result.unassigned.length + '명)</h3>';
      html += '<table class="unassigned-table"><thead><tr>';
      html += '<th>이름</th><th>통솔</th><th>무력</th><th>지력</th><th>정치</th><th>매력</th>';
      html += '</tr></thead><tbody>';
      for (const id of result.unassigned) {
        const o = OFFICERS.find(x => x.id === id);
        if (!o) continue;
        html += `<tr>`;
        html += `<td><span class="officer-name" data-id="${o.id}">${o.name}</span></td>`;
        html += `<td class="col-stat-sm ${this.getStatClass(o.leadership)}">${o.leadership}</td>`;
        html += `<td class="col-stat-sm ${this.getStatClass(o.power)}">${o.power}</td>`;
        html += `<td class="col-stat-sm ${this.getStatClass(o.intelligence)}">${o.intelligence}</td>`;
        html += `<td class="col-stat-sm ${this.getStatClass(o.politics)}">${o.politics}</td>`;
        html += `<td class="col-stat-sm ${this.getStatClass(o.charm)}">${o.charm}</td>`;
        html += `</tr>`;
      }
      html += '</tbody></table></div>';
    }

    if (!html) {
      html = '<p style="text-align:center;padding:24px;color:var(--text-muted)">배정할 무장 또는 도시가 없습니다.</p>';
    }

    container.innerHTML = html;
  }

  // ===== Summon Tab =====

  buildSummonData() {
    const result = this.state.assignmentResult;
    if (!result) return null;

    const cityMap = new Map();

    for (const cityResult of result.cities) {
      const entry = {
        cityId: cityResult.cityId,
        cityName: cityResult.cityName,
        province: cityResult.province,
        officers: []
      };

      if (cityResult.governor) {
        entry.officers.push({ id: cityResult.governor, role: '태수' });
      }
      if (cityResult.recruiter) {
        entry.officers.push({ id: cityResult.recruiter, role: '모병' });
      }
      if (cityResult.trainer) {
        entry.officers.push({ id: cityResult.trainer, role: '훈련' });
      }
      for (const adminId of cityResult.regionalAdmins) {
        entry.officers.push({ id: adminId, role: '지역내정' });
      }

      cityMap.set(cityResult.cityId, entry);
    }

    for (const corps of this.state.corps) {
      if (corps.sourceCity == null) continue;
      const entry = cityMap.get(corps.sourceCity);
      if (!entry) continue;

      const existingIds = new Set(entry.officers.map(o => o.id));
      for (const rank of (corps.ranks || [])) {
        for (const memberId of rank.memberIds) {
          if (!existingIds.has(memberId)) {
            entry.officers.push({ id: memberId, role: `군단:${corps.name}` });
            existingIds.add(memberId);
          }
        }
      }
    }

    const data = Array.from(cityMap.values());
    for (const city of data) {
      city.officers.sort((a, b) => {
        const nameA = (OFFICERS.find(x => x.id === a.id) || {}).name || '';
        const nameB = (OFFICERS.find(x => x.id === b.id) || {}).name || '';
        return nameA.localeCompare(nameB, 'ko');
      });
    }
    return data;
  }

  renderSummonTab() {
    const container = document.getElementById('summon-content');
    const data = this.buildSummonData();

    if (!data) {
      container.innerHTML = '<p style="text-align:center;padding:24px;color:var(--text-muted)">"내정관리" 탭에서 "배정 실행"을 먼저 수행해주세요.</p>';
      return;
    }

    if (data.length === 0) {
      container.innerHTML = '<p style="text-align:center;padding:24px;color:var(--text-muted)">보유도시가 없습니다.</p>';
      return;
    }

    let totalOfficers = 0;
    let totalSummoned = 0;
    for (const city of data) {
      totalOfficers += city.officers.length;
      totalSummoned += city.officers.filter(o => this.state.summonedIds.has(o.id)).length;
    }

    let html = '';

    html += `<div class="summon-header">`;
    html += `<span class="summon-progress-global">전체 호출 진행: <strong>${totalSummoned}/${totalOfficers}</strong></span>`;
    html += `<button class="btn btn--secondary" id="summon-reset-btn">초기화</button>`;
    html += `</div>`;

    for (let i = 0; i < data.length; i++) {
      const city = data[i];
      const summoned = city.officers.filter(o => this.state.summonedIds.has(o.id)).length;
      const total = city.officers.length;
      const allDone = total > 0 && summoned === total;

      html += `<div class="summon-city-card${allDone ? ' summon-city-card--done' : ''}">`;
      html += `<div class="summon-city-card__header">`;
      html += `<h4 class="summon-city-card__title">${i + 1}순위 — ${city.cityName} <span class="admin-city-card__province">(${city.province})</span></h4>`;
      html += `<span class="summon-city-card__progress">${summoned}/${total} 호출완료</span>`;
      html += `</div>`;

      html += `<div class="summon-officer-list">`;
      for (const officer of city.officers) {
        const o = OFFICERS.find(x => x.id === officer.id);
        if (!o) continue;
        const isSummoned = this.state.summonedIds.has(officer.id);
        html += `<button class="summon-officer${isSummoned ? ' summon-officer--done' : ''}" data-officer-id="${officer.id}">`;
        html += `<span class="summon-officer__check">${isSummoned ? '&#10003;' : ''}</span>`;
        html += `<span class="summon-officer__name">${o.name}</span>`;
        html += `<span class="summon-officer__role">${officer.role}</span>`;
        html += `</button>`;
      }
      html += `</div>`;

      html += `</div>`;
    }

    container.innerHTML = html;
  }

  // ===== Appointment Tab =====

  buildAppointmentData() {
    const result = this.state.assignmentResult;
    if (!result) return null;

    return result.cities.map(cityResult => {
      const governor = cityResult.governor ? [cityResult.governor] : [];
      const cityAdmin = [];
      if (cityResult.recruiter) cityAdmin.push(cityResult.recruiter);
      if (cityResult.trainer) cityAdmin.push(cityResult.trainer);
      const regional = [...cityResult.regionalAdmins];
      const defense = [...cityResult.defenseAdmins];

      return {
        cityId: cityResult.cityId,
        cityName: cityResult.cityName,
        province: cityResult.province,
        groups: [
          { label: '태수', ids: governor },
          { label: '도시내정', ids: cityAdmin },
          { label: '지역내정', ids: regional },
          { label: '방어요원', ids: defense }
        ]
      };
    });
  }

  renderAppointmentTab() {
    const container = document.getElementById('appointment-content');
    const data = this.buildAppointmentData();

    if (!data) {
      container.innerHTML = '<p style="text-align:center;padding:24px;color:var(--text-muted)">"내정관리" 탭에서 "배정 실행"을 먼저 수행해주세요.</p>';
      return;
    }

    if (data.length === 0) {
      container.innerHTML = '<p style="text-align:center;padding:24px;color:var(--text-muted)">보유도시가 없습니다.</p>';
      return;
    }

    let totalOfficers = 0;
    let totalAppointed = 0;
    for (const city of data) {
      for (const group of city.groups) {
        totalOfficers += group.ids.length;
        totalAppointed += group.ids.filter(id => this.state.appointmentIds.has(id)).length;
      }
    }

    let html = '';

    html += `<div class="summon-header">`;
    html += `<span class="summon-progress-global">전체 임명 진행: <strong>${totalAppointed}/${totalOfficers}</strong></span>`;
    html += `<button class="btn btn--secondary" id="appointment-reset-btn">초기화</button>`;
    html += `</div>`;

    for (let i = 0; i < data.length; i++) {
      const city = data[i];
      let cityTotal = 0, cityDone = 0;
      for (const group of city.groups) {
        cityTotal += group.ids.length;
        cityDone += group.ids.filter(id => this.state.appointmentIds.has(id)).length;
      }
      const allDone = cityTotal > 0 && cityDone === cityTotal;

      html += `<div class="summon-city-card${allDone ? ' summon-city-card--done' : ''}">`;
      html += `<div class="summon-city-card__header">`;
      html += `<h4 class="summon-city-card__title">${i + 1}순위 — ${city.cityName} <span class="admin-city-card__province">(${city.province})</span></h4>`;
      html += `<span class="summon-city-card__progress">${cityDone}/${cityTotal} 임명완료</span>`;
      html += `</div>`;

      for (const group of city.groups) {
        if (group.ids.length === 0) continue;
        if (group.label === '방어요원') {
          html += `<hr class="appointment-divider">`;
        }
        html += `<div class="admin-role">`;
        html += `<span class="admin-role__label">${group.label}</span>`;
        html += `<div class="summon-officer-list">`;
        for (const officerId of group.ids) {
          const o = OFFICERS.find(x => x.id === officerId);
          if (!o) continue;
          const isDone = this.state.appointmentIds.has(officerId);
          html += `<button class="summon-officer${isDone ? ' summon-officer--done' : ''}" data-officer-id="${officerId}">`;
          html += `<span class="summon-officer__check">${isDone ? '&#10003;' : ''}</span>`;
          html += `<span class="summon-officer__name">${o.name}</span>`;
          html += `</button>`;
        }
        html += `</div></div>`;
      }

      html += `</div>`;
    }

    container.innerHTML = html;
  }

  // ===== Modal =====

  showOfficerModal(officerId) {
    const o = OFFICERS.find(x => x.id === officerId);
    if (!o) return;

    const content = document.getElementById('modal-content');

    const statNames = [
      { key: 'leadership', label: '통솔' },
      { key: 'power', label: '무력' },
      { key: 'intelligence', label: '지력' },
      { key: 'politics', label: '정치' },
      { key: 'charm', label: '매력' }
    ];

    let html = `
    <div class="modal-header">
      <h2>${o.name}</h2>
      <div class="modal-header__meta">주의: ${o.ideology} | 성별: ${o.gender} | 상성: ${o.affinity}</div>
    </div>
    <div class="modal-stats">
      ${statNames.map(s => `
        <div class="modal-stat">
          <span class="modal-stat__label">${s.label}</span>
          <span class="modal-stat__value ${this.getStatClass(o[s.key])}">${o[s.key]}</span>
        </div>
      `).join('')}
    </div>
    <div class="modal-section">
      <div class="modal-section__title">내정 적성</div>
      <div class="modal-affair-list">
        ${Object.entries(AFFAIRS_CONFIG).map(([key, cfg]) => {
          const score = o.scores[key];
          const pct = Math.min(score, 120);
          const cls = this.getScoreClass(score);
          return `<div class="modal-affair-item">
            <span class="modal-affair-item__icon">${cfg.icon}</span>
            <span class="modal-affair-item__name">${cfg.name}</span>
            <div class="modal-affair-item__bar ${cls}">
              <div class="modal-affair-item__bar-fill score-bar__fill" style="width:${pct}%"></div>
            </div>
            <span class="modal-affair-item__score ${cls.replace('score--', 'score-value ')}">${score}</span>
          </div>`;
        }).join('')}
      </div>
    </div>
    <div class="modal-section">
      <div class="modal-section__title">개성</div>
      <div class="trait-badges">
        ${o.traits.length ? o.traits.map(t => `<span class="trait-badge trait-badge--normal">${t}</span>`).join('') : '<span style="color:var(--text-muted)">없음</span>'}
      </div>
    </div>
    <div class="modal-section">
      <div class="modal-section__title">전법</div>
      <div class="trait-badges">
        ${o.tactics.length ? o.tactics.map(t => `<span class="trait-badge trait-badge--support">${t}</span>`).join('') : '<span style="color:var(--text-muted)">없음</span>'}
      </div>
    </div>
    <div class="modal-section">
      <div class="modal-info">
        군단: <strong>${o.corps || '재야'}</strong> | 소속: ${o.faction} | 소재: ${o.location}<br>
        생년: ${o.birthYear} | 등장: ${o.appearYear} | 몰년: ${o.deathYear}
      </div>
    </div>
  `;

    content.innerHTML = html;
    document.getElementById('modal-overlay').classList.add('show');
  }

  closeModal() {
    document.getElementById('modal-overlay').classList.remove('show');
  }
}
