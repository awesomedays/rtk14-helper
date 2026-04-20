// ===== UI RENDERER =====

import { AFFAIRS_CONFIG, THRESHOLDS, TRADE_NATION_NAMES, LIMITS, SORT_KEYS, TRADE_OVERFLOW_MODES, DEFAULT_ASSIGNMENT_CONFIG } from './config.js';
import { OFFICERS, CITIES, ALL_TRAITS, TRAITS_META, FORMATIONS_META, TACTICS_META, RELATIONSHIPS } from '../data.js';
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

  getSumStatClass(val) {
    if (val >= THRESHOLDS.statHigh) return 'stat-sum-high';
    if (val >= THRESHOLDS.statMid) return 'stat-sum-mid';
    return 'stat-sum-low';
  }

  traitBadgeHtml(traitName, overrideCls, label) {
    const meta = TRAITS_META[traitName];
    const tierCls = meta ? `trait-badge--${meta.tier}` : 'trait-badge--normal';
    const tooltip = meta && meta.desc ? meta.desc.replace(/"/g, '&quot;') : '';
    const cls = overrideCls || tierCls;
    const text = label || traitName;
    return `<span class="trait-badge ${cls}" data-tooltip="${tooltip}" data-trait="${traitName}">${text}</span>`;
  }

  formationBadgeHtml(name) {
    const meta = FORMATIONS_META[name];
    const tooltip = meta ? `기동: ${meta.mobility}\n공군: ${meta.attack}\n공성: ${meta.siege}\n파성: ${meta.breach}\n방어: ${meta.defense}` : '';
    const siege = ['충차', '정란', '투석'];
    const etc = ['사이'];
    const catCls = siege.includes(name) ? 'formation-badge--siege' : etc.includes(name) ? 'formation-badge--etc' : '';
    return `<span class="formation-badge ${catCls}" data-formation="${name}" data-formation-tooltip="${tooltip.replace(/"/g, '&quot;')}">${name}</span>`;
  }

  getOfficerTactics(officer) {
    const base = officer.tactics || [];
    const added = this.state.officerTacticsOverrides[officer.id] || [];
    return [...base, ...added];
  }

  getOfficerRelations(officer) {
    const relIds = RELATIONSHIPS[officer.id] || [];
    const rosterSet = new Set(this.state.rosterIds);
    return relIds
      .filter(id => rosterSet.has(id))
      .map(id => OFFICERS.find(o => o.id === id))
      .filter(Boolean);
  }

  relationBadgeHtml(officer) {
    return `<span class="relation-badge officer-name" data-id="${officer.id}" data-relation="${officer.name}">${officer.name}</span>`;
  }

  tacticBadgeHtml(name) {
    const meta = TACTICS_META[name];
    if (!meta) return `<span class="tactic-badge" data-tactic="${name}">${name}</span>`;

    const e1Label = meta.effect2 ? '효과1' : '효과';
    const lines = [`의존: ${meta.stat}`, `거점: ${meta.siege ? 'O' : 'X'}`, `쿨타임: ${meta.cooldown}`, `${e1Label}: ${meta.effect1}`];
    if (meta.effect2) lines.push(`효과2: ${meta.effect2}`);

    const tooltip = lines.join('\n');
    const uniqueCls = meta.unique ? 'tactic-badge--unique' : '';
    return `<span class="tactic-badge ${uniqueCls}" data-tactic="${name}" data-tactic-tooltip="${tooltip.replace(/"/g, '&quot;')}">${name}</span>`;
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
      return officer.traits.map(t => this.traitBadgeHtml(t)).join('');
    }
    const config = AFFAIRS_CONFIG[affairKey];
    const bonuses = config.traitBonuses;
    const keyTraits = Object.keys(bonuses).filter(t => bonuses[t] >= 10);

    return officer.traits
      .filter(t => t in bonuses)
      .map(t => {
        const cls = keyTraits.includes(t) ? 'trait-badge--key' : 'trait-badge--support';
        return this.traitBadgeHtml(t, cls, `${t} +${bonuses[t]}`);
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
    const totalCount = officers.length;
    officers = this.officerService.sortOfficers(officers, this.state.searchSort.key, this.state.searchSort.dir, this.state.currentAffair);

    const traitFilters = this.state.searchTraitFilters;
    const formationFilters = this.state.searchFormationFilters;
    const tacticsFilters = this.state.searchTacticsFilters;
    const hasFilter = !!(filters.name || filters.location ||
      filters.affinityMin !== null || filters.affinityMax !== null ||
      filters.appearMin !== null || filters.appearMax !== null ||
      traitFilters.length || formationFilters.length || tacticsFilters.length);

    const searchCount = document.getElementById('search-count');
    if (hasFilter) {
      searchCount.innerHTML = `검색 결과: <strong class="filter-count">${totalCount}명</strong> / ${OFFICERS.length}명`;
    } else {
      searchCount.textContent = `전체 무장: ${OFFICERS.length}명`;
    }

    const traitTagsContainer = document.getElementById('search-trait-filter-tags');
    traitTagsContainer.innerHTML = traitFilters.map(f => {
      const meta = TRAITS_META[f];
      const tierCls = meta ? `filter-tag--${meta.tier}` : '';
      return `<span class="filter-tag ${tierCls}"><span class="filter-tag__name">${f}</span><button class="filter-tag__close" data-trait="${f}">&times;</button></span>`;
    }).join('');

    const formationTagsContainer = document.getElementById('search-formation-filter-tags');
    formationTagsContainer.innerHTML = formationFilters.map(f =>
      `<span class="filter-tag filter-tag--formation"><span class="filter-tag__name">${f}</span><button class="filter-tag__close" data-formation="${f}">&times;</button></span>`
    ).join('');

    const tacticsTagsContainer = document.getElementById('search-tactic-filter-tags');
    tacticsTagsContainer.innerHTML = tacticsFilters.map(f => {
      const meta = TACTICS_META[f];
      const cls = meta && meta.unique ? 'filter-tag--tactic-unique' : 'filter-tag--tactic';
      return `<span class="filter-tag ${cls}"><span class="filter-tag__name">${f}</span><button class="filter-tag__close" data-tactic="${f}">&times;</button></span>`;
    }).join('');

    const shown = officers.slice(0, this.state.searchShown);
    const tbody = document.getElementById('search-tbody');
    if (shown.length === 0) {
      tbody.innerHTML = '<tr><td colspan="13" style="text-align:center;padding:24px;color:var(--text-muted)">해당 조건을 만족하는 무장이 없습니다.</td></tr>';
      const loadMore = document.getElementById('search-load-more');
      loadMore.style.display = 'none';
      this.updateSortIndicators('search-table', this.state.searchSort);
      return;
    }

    tbody.innerHTML = shown.map(o => {
      const badgeHtml = (o.traits || []).map(t => {
        const html = this.traitBadgeHtml(t);
        if (traitFilters.length > 0 && traitFilters.includes(t)) {
          return html.replace('class="trait-badge', 'class="trait-badge trait-badge--active');
        }
        return html;
      }).join('');

      const formationHtml = (o.formations || []).map(f => {
        const html = this.formationBadgeHtml(f);
        if (formationFilters.length > 0 && formationFilters.includes(f)) {
          return html.replace('class="formation-badge', 'class="formation-badge formation-badge--active');
        }
        return html;
      }).join('');

      const tacticHtml = (o.tactics || []).map(t => {
        const html = this.tacticBadgeHtml(t);
        if (tacticsFilters.length > 0 && tacticsFilters.includes(t)) {
          return html.replace('class="tactic-badge', 'class="tactic-badge tactic-badge--active');
        }
        return html;
      }).join('');

      return `<tr>
      <td class="col-id">${o.id}</td>
      <td><span class="officer-name" data-id="${o.id}">${o.name}</span></td>
      <td class="col-stat-sm col-group-start ${this.getStatClass(o.leadership)}">${o.leadership}</td>
      <td class="col-stat-sm ${this.getStatClass(o.power)}">${o.power}</td>
      <td class="col-stat-sm ${this.getStatClass(o.intelligence)}">${o.intelligence}</td>
      <td class="col-stat-sm ${this.getStatClass(o.politics)}">${o.politics}</td>
      <td class="col-stat-sm ${this.getStatClass(o.charm)}">${o.charm}</td>
      <td class="col-stat col-group-start ${this.getSumStatClass((o.leadership + o.power) / 2)}">${o.leadership + o.power}</td>
      <td class="col-stat ${this.getSumStatClass((o.intelligence + o.politics) / 2)}">${o.intelligence + o.politics}</td>
      <td class="col-stat col-group-start">${o.appearYear ? o.appearYear + '년' : '-'}</td>
      <td class="col-stat">${o.deathYear ? o.deathYear + '년' : '-'}</td>
      <td class="col-group-start"><div class="trait-badges">${badgeHtml}</div></td>
      <td class="col-group-start"><div class="formation-badges">${formationHtml}</div></td>
      <td class="col-group-start"><div class="tactic-badges">${tacticHtml}</div></td>
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
        return `<td>${t ? this.traitBadgeHtml(t) : ''}</td>`;
      }).join('');
      html += '</tr>';
    }

    html += '</tbody></table>';
    grid.innerHTML = html;
  }

  // ===== Roster Tab =====

  renderRoster() {
    let officers = this.state.rosterIds
      .map(id => OFFICERS.find(o => o.id === id))
      .filter(Boolean);

    const totalCount = officers.length;
    const filters = this.state.rosterTraitFilters;
    const formationFilters = this.state.rosterFormationFilters;
    const tacticsFilters = this.state.rosterTacticsFilters;
    const relationFilters = this.state.rosterRelationFilters;
    const hasFilter = filters.length > 0 || formationFilters.length > 0 || tacticsFilters.length > 0 || relationFilters.length > 0;

    if (filters.length > 0) {
      officers = officers.filter(o => filters.every(f => o.traits.includes(f)));
    }
    if (formationFilters.length > 0) {
      officers = officers.filter(o => formationFilters.every(f => o.formations.includes(f)));
    }
    if (tacticsFilters.length > 0) {
      officers = officers.filter(o => {
        const tactics = this.getOfficerTactics(o);
        return tacticsFilters.every(f => tactics.includes(f));
      });
    }
    if (relationFilters.length > 0) {
      officers = officers.filter(o => {
        const relIds = RELATIONSHIPS[o.id] || [];
        return relationFilters.every(f => relIds.includes(f));
      });
    }

    const sorted = this.officerService.sortOfficers(officers, this.state.rosterSort.key, this.state.rosterSort.dir, this.state.currentAffair);

    const rosterCount = document.getElementById('roster-count');
    if (hasFilter) {
      rosterCount.innerHTML = `보유 무장: <strong class="filter-count">${sorted.length}명</strong> / ${totalCount}명`;
    } else {
      rosterCount.textContent = `보유 무장: ${totalCount}명`;
    }

    const tagsContainer = document.getElementById('roster-filter-tags');
    tagsContainer.innerHTML = filters.map(f => {
      const meta = TRAITS_META[f];
      const tierCls = meta ? `filter-tag--${meta.tier}` : '';
      return `<span class="filter-tag ${tierCls}"><span class="filter-tag__name">${f}</span><button class="filter-tag__close" data-trait="${f}">&times;</button></span>`;
    }).join('');

    const formationTagsContainer = document.getElementById('roster-formation-filter-tags');
    formationTagsContainer.innerHTML = formationFilters.map(f =>
      `<span class="filter-tag filter-tag--formation"><span class="filter-tag__name">${f}</span><button class="filter-tag__close" data-formation="${f}">&times;</button></span>`
    ).join('');

    const tacticsTagsContainer = document.getElementById('roster-tactics-filter-tags');
    tacticsTagsContainer.innerHTML = tacticsFilters.map(f => {
      const meta = TACTICS_META[f];
      const cls = meta && meta.unique ? 'filter-tag--tactic-unique' : 'filter-tag--tactic';
      return `<span class="filter-tag ${cls}"><span class="filter-tag__name">${f}</span><button class="filter-tag__close" data-tactic="${f}">&times;</button></span>`;
    }).join('');

    const relationTagsContainer = document.getElementById('roster-relation-filter-tags');
    relationTagsContainer.innerHTML = relationFilters.map(id => {
      const o = OFFICERS.find(x => x.id === id);
      const name = o ? o.name : id;
      return `<span class="filter-tag filter-tag--relation"><span class="filter-tag__name">${name}</span><button class="filter-tag__close" data-relation-id="${id}">&times;</button></span>`;
    }).join('');

    const tbody = document.getElementById('roster-tbody');
    if (sorted.length === 0) {
      tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:24px;color:var(--text-muted)">' +
        (hasFilter ? '해당 조건을 만족하는 무장이 없습니다.' : '무장을 검색하여 추가해주세요.') + '</td></tr>';
      return;
    }

    tbody.innerHTML = sorted.map(o => {
      const badgeHtml = o.traits.map(t => {
        const html = this.traitBadgeHtml(t);
        if (filters.length > 0 && filters.includes(t)) {
          return html.replace('class="trait-badge', 'class="trait-badge trait-badge--active');
        }
        return html;
      }).join('');

      const formationHtml = o.formations.map(f => {
        const html = this.formationBadgeHtml(f);
        if (formationFilters.length > 0 && formationFilters.includes(f)) {
          return html.replace('class="formation-badge', 'class="formation-badge formation-badge--active');
        }
        return html;
      }).join('');

      const allTactics = this.getOfficerTactics(o);
      const baseCount = o.tactics.length;
      const tacticHtml = allTactics.map((t, i) => {
        let html = this.tacticBadgeHtml(t);
        if (tacticsFilters.length > 0 && tacticsFilters.includes(t)) {
          html = html.replace('class="tactic-badge', 'class="tactic-badge tactic-badge--active');
        }
        if (i >= baseCount) {
          html = html.replace('class="tactic-badge', 'class="tactic-badge tactic-badge--added');
          const closeBtn = `<button class="tactic-remove-btn" data-officer-id="${o.id}" data-tactic="${t}">&times;</button>`;
          html = html.replace('</span>', closeBtn + '</span>');
        }
        return html;
      }).join('');
      const addBtn = allTactics.length < 10
        ? `<button class="tactic-add-btn" data-officer-id="${o.id}">+</button>` : '';

      const relations = this.getOfficerRelations(o);
      const visibleRelations = relations.slice(0, 6);
      const relationHtml = visibleRelations.map(r => {
        let html = this.relationBadgeHtml(r);
        if (relationFilters.length > 0 && relationFilters.includes(r.id)) {
          html = html.replace('class="relation-badge', 'class="relation-badge relation-badge--active');
        }
        return html;
      }).join('');
      const moreBtn = relations.length > 6
        ? `<button class="relation-more-btn" data-officer-id="${o.id}">+${relations.length - 6}</button>` : '';

      return `<tr class="has-row-remove">
    <td><span class="officer-name" data-id="${o.id}">${o.name}</span></td>
    <td class="col-stat-sm col-group-start ${this.getStatClass(o.leadership)}">${o.leadership}</td>
    <td class="col-stat-sm ${this.getStatClass(o.power)}">${o.power}</td>
    <td class="col-stat-sm ${this.getStatClass(o.intelligence)}">${o.intelligence}</td>
    <td class="col-stat-sm ${this.getStatClass(o.politics)}">${o.politics}</td>
    <td class="col-stat-sm ${this.getStatClass(o.charm)}">${o.charm}</td>
    <td class="col-stat col-group-start ${this.getSumStatClass((o.leadership + o.power) / 2)}">${o.leadership + o.power}</td>
    <td class="col-stat ${this.getSumStatClass((o.intelligence + o.politics) / 2)}">${o.intelligence + o.politics}</td>
    <td class="col-group-start"><div class="trait-badges">${badgeHtml}</div></td>
    <td class="col-group-start"><div class="formation-badges">${formationHtml}</div></td>
    <td class="col-group-start"><div class="tactic-badges">${tacticHtml}${addBtn}</div></td>
    <td class="col-group-start"><div class="relation-badges">${relationHtml}${moreBtn}</div></td>
    <td class="cell-row-remove"><button class="row-remove" data-id="${o.id}">&times;</button></td>
  </tr>`;
    }).join('');

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
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted)">도시를 검색하여 추가해주세요.</td></tr>';
      return;
    }

    tbody.innerHTML = cities.map((c, i) => `<tr class="has-row-remove">
    <td style="font-weight:700;color:var(--accent-gold-bright)">${i + 1}</td>
    <td>${c.name}</td>
    <td class="col-stat">${c.province}</td>
    <td class="col-stat">${c.regionSlots}</td>
    <td>
      <button class="city-move-up" data-id="${c.id}" ${i === 0 ? 'disabled' : ''}>&#9650;</button>
      <button class="city-move-down" data-id="${c.id}" ${i === cities.length - 1 ? 'disabled' : ''}>&#9660;</button>
    </td>
    <td class="cell-row-remove"><button class="row-remove" data-id="${c.id}">&times;</button></td>
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

      const rankSections = (corps.ranks || []).map(rank => {
            const members = rank.memberIds
              .map(id => OFFICERS.find(o => o.id === id))
              .filter(Boolean);

            const memberRows = members.map(o => `<div class="corps-member" data-officer-id="${o.id}">
              <span class="corps-member__drag-handle">&#8286;&#8286;</span>
              <span class="officer-name" data-id="${o.id}">${o.name}</span>
              <span class="corps-member__stats"><span class="${this.corpsStatClass(o.leadership)}">${o.leadership}</span><span class="${this.corpsStatClass(o.power)}">${o.power}</span><span class="${this.corpsStatClass(o.intelligence)}">${o.intelligence}</span><span class="${this.corpsStatClass(o.politics)}">${o.politics}</span></span>
              <button class="corps-member__remove" data-corps-id="${corps.id}" data-rank-id="${rank.id}" data-officer-id="${o.id}">&times;</button>
            </div>`).join('');

            return `<div class="corps-rank" data-rank-id="${rank.id}">
            <div class="corps-rank__left">
              <div class="corps-rank__meta">
                <span class="corps-rank__name">${rank.name}</span>
                <span class="corps-rank__count">${members.length}명</span>
                <button class="corps-rank__delete" data-corps-id="${corps.id}" data-rank-id="${rank.id}">&times;</button>
              </div>
              <div class="compare-search-wrap corps-search-wrap">
                <input type="text" class="corps-member-input" data-corps-id="${corps.id}" data-rank-id="${rank.id}" placeholder="무장 검색..." autocomplete="off">
                <div class="autocomplete-list corps-member-autocomplete"></div>
              </div>
            </div>
            <div class="corps-rank__right">
              <div class="corps-card__member-list" data-corps-id="${corps.id}" data-rank-id="${rank.id}">${memberRows}</div>
            </div>
          </div>`;
          }).join('');

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
        <select class="corps-source-city" data-corps-id="${corps.id}">${sourceCityOptions}</select>
      </div>
      ${isDefense ? '' : `<span class="corps-city-arrow">→</span>
      <div class="corps-city-field">
        <select class="corps-target-city" data-corps-id="${corps.id}">${targetCityOptions}</select>
      </div>`}
    </div>`;

      return `<div class="corps-card corps-card--${corps.role}" data-corps-id="${corps.id}">
      <div class="corps-card__header">
        <div class="corps-card__header-row1">
          <div class="corps-card__title-group">
            <h3 class="corps-card__name">${corps.name}</h3>
            <span class="role-badge role-badge--${corps.role}">${corps.role}</span>
            <button class="corps-card__delete" data-corps-id="${corps.id}">&times;</button>
          </div>
        </div>
        <div class="corps-card__header-row2">
          <span class="corps-card__count">${totalMembers}명</span>
          ${citySelector}
        </div>
      </div>
      <div class="corps-card__body">
        ${rankSections}
        <div class="corps-rank-add">
          <input type="text" class="corps-rank-input" data-corps-id="${corps.id}" placeholder="직급명..." autocomplete="off">
          <button class="corps-rank-add-btn" data-corps-id="${corps.id}">직급 추가</button>
        </div>
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

    const prevSection = container.querySelector('.collapsible-section');
    const wasCollapsed = prevSection ? prevSection.classList.contains('collapsed') : false;

    container.innerHTML = `<div class="admin-section collapsible-section${wasCollapsed ? ' collapsed' : ''}">
    <h3 class="admin-section__title">도시별 내정인원</h3>
    <div class="collapsible-section__body">
      <div class="collapsible-section__inner">
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
      </div>
    </div>
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
        ${o.traits.length ? o.traits.map(t => this.traitBadgeHtml(t)).join('') : '<span style="color:var(--text-muted)">없음</span>'}
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

  showRelationsModal(officerId) {
    const officer = OFFICERS.find(o => o.id === officerId);
    if (!officer) return;
    const relations = this.getOfficerRelations(officer);
    const content = document.getElementById('modal-content');

    content.innerHTML = `
    <div class="modal-header" style="text-align:center">
      <h2>${officer.name}의 관계 무장 (${relations.length}명)</h2>
    </div>
    <div class="relation-modal-list">
      ${relations.map(r => `<span class="relation-badge officer-name" data-id="${r.id}">${r.name}</span>`).join('')}
    </div>`;

    document.getElementById('modal-overlay').classList.add('show');
  }
}
