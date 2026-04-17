// ===== APPLICATION ENTRY POINT =====

import { OFFICERS, CITIES, CORPS_LIST, LOCATIONS_LIST, IDEOLOGIES_LIST, ALL_TRAITS, FORMATIONS_META, TACTICS_META, ALL_TACTICS_LIST, RELATIONSHIPS } from '../data.js';
import { AFFAIRS_CONFIG, PAGE_SIZE, TAB_CATEGORIES, THRESHOLDS, LIMITS, DEFAULT_ASSIGNMENT_CONFIG } from './config.js';
import { state } from './state.js';
import { PersistenceManager } from './persistence.js';
import { ScoringEngine } from './scoring.js';
import { OfficerService, matchesName } from './officers.js';
import { AssignmentEngine } from './assignment.js';
import { UIRenderer } from './renderers.js';

function init() {
  // Instantiate services
  const persistence = new PersistenceManager(state);
  const scoring = new ScoringEngine();
  const officerService = new OfficerService();
  const assignment = new AssignmentEngine(state);
  const renderer = new UIRenderer(state, officerService);

  // State export/import
  document.getElementById('state-export').addEventListener('click', () => persistence.exportState());
  document.getElementById('state-import').addEventListener('change', (e) => {
    if (e.target.files[0]) persistence.importState(e.target.files[0]);
  });

  // Dark mode
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.getElementById('theme-toggle').textContent = theme === 'dark' ? '☀️ 라이트모드' : '🌙 다크모드';
    persistence.saveTheme(theme);
  }

  const savedTheme = persistence.loadTheme();
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(savedTheme ?? (prefersDark ? 'dark' : 'light'));

  document.getElementById('theme-toggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });

  scoring.precomputeScores(OFFICERS);

  // Populate dropdowns
  renderer.populateDropdown('opt-corps', CORPS_LIST);
  renderer.populateDropdown('opt-location', LOCATIONS_LIST);
  renderer.populateDropdown('search-location', LOCATIONS_LIST);
  renderer.populateDropdown('search-trait', ALL_TRAITS);
  renderer.populateDropdown('search-formation', Object.keys(FORMATIONS_META));
  renderer.populateDropdown('search-tactic', ALL_TACTICS_LIST);

  // ===== 2-tier tab system =====

  function renderSubTabs(category) {
    const container = document.getElementById('tabs-sub');
    const tabs = TAB_CATEGORIES[category];
    let html = '';
    let prevGroup = null;
    tabs.forEach((t, i) => {
      if (t.group && prevGroup && t.group !== prevGroup) {
        html += '<span class="tab-sub-divider"></span>';
      }
      prevGroup = t.group || null;
      html += `<button class="tab-sub${i === 0 ? ' active' : ''}" data-tab="${t.id}">${t.label}</button>`;
    });
    container.innerHTML = html;
  }

  const tabScrollPositions = {};

  function activateTab(tabId) {
    if (state.currentTab) {
      tabScrollPositions[state.currentTab] = window.scrollY;
    }

    document.querySelectorAll('.tab-sub').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

    const subBtn = document.querySelector(`.tab-sub[data-tab="${tabId}"]`);
    if (subBtn) subBtn.classList.add('active');

    const target = document.getElementById('tab-' + tabId);
    if (target) target.classList.add('active');

    state.currentTab = tabId;
    if (tabId === 'admin') renderer.renderAdminCitySlots();
    if (tabId === 'summon') renderer.renderSummonTab();
    if (tabId === 'appointment') renderer.renderAppointmentTab();

    const savedScroll = tabScrollPositions[tabId];
    window.scrollTo(0, savedScroll || 0);
  }

  // Top-level category switching
  document.getElementById('tabs-top').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-top');
    if (!btn) return;
    const category = btn.dataset.category;

    document.querySelectorAll('.tab-top').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');

    state.currentCategory = category;
    renderSubTabs(category);

    const firstTab = TAB_CATEGORIES[category][0].id;
    activateTab(firstTab);
  });

  // Sub-tab switching
  document.getElementById('tabs-sub').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-sub');
    if (!btn) return;
    activateTab(btn.dataset.tab);
  });

  renderSubTabs('current');
  activateTab('roster');

  // ===== Affair type switching =====

  document.querySelectorAll('.affair-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.affair-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentAffair = btn.dataset.affair;
      state.optimizeShown = PAGE_SIZE;
      state.optimizeSort = { key: 'score', dir: 'desc' };
      renderer.renderOptimizeTable();
    });
  });

  // ===== Optimize filters =====

  ['opt-corps', 'opt-location', 'opt-min-stat'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
      state.optimizeShown = PAGE_SIZE;
      renderer.renderOptimizeTable();
    });
  });

  document.getElementById('opt-reset').addEventListener('click', () => {
    document.getElementById('opt-corps').value = '';
    document.getElementById('opt-location').value = '';
    document.getElementById('opt-min-stat').value = '0';
    state.optimizeShown = PAGE_SIZE;
    renderer.renderOptimizeTable();
  });

  document.getElementById('opt-load-more').addEventListener('click', () => {
    state.optimizeShown += PAGE_SIZE;
    renderer.renderOptimizeTable();
  });

  // Optimize table sorting
  document.getElementById('opt-table').addEventListener('click', (e) => {
    const th = e.target.closest('th.sortable');
    if (!th) return;
    const key = th.dataset.sort;
    if (state.optimizeSort.key === key) {
      state.optimizeSort.dir = state.optimizeSort.dir === 'desc' ? 'asc' : 'desc';
    } else {
      state.optimizeSort = { key, dir: 'desc' };
    }
    renderer.renderOptimizeTable();
  });

  // ===== Search filters =====

  let searchTimeout;
  const searchNameInput = document.getElementById('search-name');

  function handleSearchInput() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.searchShown = PAGE_SIZE;
      renderer.renderSearchTable();
    }, 200);
  }

  searchNameInput.addEventListener('input', handleSearchInput);
  searchNameInput.addEventListener('compositionend', handleSearchInput);

  ['search-location', 'search-trait', 'search-formation', 'search-tactic',
   'search-affinity-min', 'search-affinity-max', 'search-appear-min', 'search-appear-max'].forEach(id => {
    const el = document.getElementById(id);
    const eventType = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(eventType, () => {
      state.searchShown = PAGE_SIZE;
      renderer.renderSearchTable();
    });
  });

  document.getElementById('search-reset').addEventListener('click', () => {
    searchNameInput.value = '';
    ['search-location', 'search-trait', 'search-formation', 'search-tactic',
     'search-affinity-min', 'search-affinity-max', 'search-appear-min', 'search-appear-max'].forEach(id => {
      document.getElementById(id).value = '';
    });
    state.searchShown = PAGE_SIZE;
    renderer.renderSearchTable();
  });

  document.getElementById('search-load-more').addEventListener('click', () => {
    state.searchShown += PAGE_SIZE;
    renderer.renderSearchTable();
  });

  // Search table sorting
  document.getElementById('search-table').addEventListener('click', (e) => {
    const th = e.target.closest('th.sortable');
    if (!th) return;
    const key = th.dataset.sort;
    if (state.searchSort.key === key) {
      state.searchSort.dir = state.searchSort.dir === 'desc' ? 'asc' : 'desc';
    } else {
      state.searchSort = { key, dir: 'desc' };
    }
    renderer.renderSearchTable();
  });

  // ===== Officer name clicks (delegation) =====

  document.addEventListener('click', (e) => {
    const nameEl = e.target.closest('.officer-name');
    if (nameEl) {
      renderer.showOfficerModal(parseInt(nameEl.dataset.id));
    }
  });

  // ===== Trait Tooltip =====

  const tooltip = document.getElementById('trait-tooltip');

  function positionTooltip(anchorEl) {
    const rect = anchorEl.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - tooltip.offsetWidth / 2;
    let top = rect.top - tooltip.offsetHeight - 6;
    if (left < 4) left = 4;
    if (left + tooltip.offsetWidth > window.innerWidth - 4) left = window.innerWidth - tooltip.offsetWidth - 4;
    if (top < 4) top = rect.bottom + 6;
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
  }

  document.addEventListener('mouseenter', (e) => {
    const badge = e.target.closest('.trait-badge[data-tooltip]');
    if (badge && badge.dataset.tooltip) {
      tooltip.textContent = badge.dataset.tooltip;
      tooltip.classList.add('show');
      positionTooltip(badge);
      return;
    }

    const formBadge = e.target.closest('.formation-badge[data-formation-tooltip]');
    if (formBadge && formBadge.dataset.formationTooltip) {
      const lines = formBadge.dataset.formationTooltip.split('\n');
      tooltip.innerHTML = '<table class="tooltip-table">' +
        lines.map(line => {
          const [label, value] = line.split(': ');
          return `<tr><td class="tooltip-table__label">${label}</td><td class="tooltip-table__value">${value}</td></tr>`;
        }).join('') + '</table>';
      tooltip.classList.add('show');
      positionTooltip(formBadge);
      return;
    }

    const tacticBadgeEl = e.target.closest('.tactic-badge[data-tactic-tooltip]');
    if (tacticBadgeEl && tacticBadgeEl.dataset.tacticTooltip) {
      const lines = tacticBadgeEl.dataset.tacticTooltip.split('\n');
      tooltip.innerHTML = '<table class="tooltip-table">' +
        lines.map(line => {
          const idx = line.indexOf(': ');
          const label = line.substring(0, idx);
          const value = line.substring(idx + 2);
          return `<tr><td class="tooltip-table__label">${label}</td><td class="tooltip-table__value">${value}</td></tr>`;
        }).join('') + '</table>';
      tooltip.classList.add('show');
      positionTooltip(tacticBadgeEl);
    }
  }, true);

  document.addEventListener('mouseleave', (e) => {
    if (e.target.closest('.trait-badge[data-tooltip]') || e.target.closest('.formation-badge[data-formation-tooltip]') || e.target.closest('.tactic-badge[data-tactic-tooltip]')) {
      tooltip.classList.remove('show');
    }
  }, true);

  // ===== Modal =====

  document.getElementById('modal-close').addEventListener('click', () => renderer.closeModal());
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) renderer.closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      renderer.closeModal();
      document.getElementById('settings-overlay').classList.remove('show');
      closeConfirm();
    }
  });

  // ===== Settings Modal =====

  document.getElementById('settings-open').addEventListener('click', () => {
    document.getElementById('settings-overlay').classList.add('show');
  });
  document.getElementById('settings-close').addEventListener('click', () => {
    document.getElementById('settings-overlay').classList.remove('show');
  });
  document.getElementById('settings-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      document.getElementById('settings-overlay').classList.remove('show');
    }
  });

  // ===== Confirm Modal =====

  let confirmCallback = null;
  const confirmOverlay = document.getElementById('confirm-overlay');

  function showConfirm(message, onConfirm) {
    document.getElementById('confirm-message').textContent = message;
    confirmCallback = onConfirm;
    confirmOverlay.classList.add('show');
  }

  function closeConfirm() {
    confirmOverlay.classList.remove('show');
    confirmCallback = null;
  }

  document.getElementById('confirm-ok').addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
    closeConfirm();
  });
  document.getElementById('confirm-cancel').addEventListener('click', closeConfirm);
  confirmOverlay.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeConfirm();
  });

  // ===== Compare tab =====

  const compareInput = document.getElementById('compare-input');
  const autocomplete = document.getElementById('compare-autocomplete');

  compareInput.addEventListener('input', () => {
    const q = compareInput.value.trim();
    if (!q) {
      autocomplete.classList.remove('show');
      return;
    }
    const matches = OFFICERS.filter(o => matchesName(o, q) && !state.compareIds.includes(o.id)).slice(0, LIMITS.maxAutocompleteItems);
    if (matches.length === 0) {
      autocomplete.classList.remove('show');
      return;
    }
    autocomplete.innerHTML = matches.map(o =>
      `<div class="autocomplete-item" data-id="${o.id}">
        <span>${o.name}</span>
        <span class="autocomplete-item__stats">통${o.leadership} 무${o.power} 지${o.intelligence} 정${o.politics} 매${o.charm}</span>
      </div>`
    ).join('');
    autocomplete.classList.add('show');
  });

  compareInput.addEventListener('compositionend', () => {
    compareInput.dispatchEvent(new Event('input'));
  });

  autocomplete.addEventListener('click', (e) => {
    const item = e.target.closest('.autocomplete-item');
    if (!item) return;
    const id = parseInt(item.dataset.id);
    if (state.compareIds.length >= LIMITS.maxCompareOfficers) return;
    state.compareIds.push(id);
    compareInput.value = '';
    autocomplete.classList.remove('show');
    renderer.renderCompare();
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.compare-search-wrap')) {
      autocomplete.classList.remove('show');
    }
  });

  document.getElementById('compare-chips').addEventListener('click', (e) => {
    const btn = e.target.closest('.compare-chip__remove');
    if (!btn) return;
    const id = parseInt(btn.dataset.id);
    state.compareIds = state.compareIds.filter(x => x !== id);
    renderer.renderCompare();
  });

  // ===== Roster tab =====

  const rosterInput = document.getElementById('roster-input');
  const rosterAutocomplete = document.getElementById('roster-autocomplete');
  let rosterAcIndex = -1;

  function updateActiveItem(items, index) {
    items.forEach((el, i) => el.classList.toggle('active', i === index));
  }

  function flashInput(el, cls) {
    el.classList.remove('flash-success', 'flash-fail');
    void el.offsetWidth;
    el.classList.add(cls);
    el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
  }

  rosterInput.addEventListener('input', () => {
    rosterAcIndex = -1;
    const q = rosterInput.value.trim();
    if (!q) {
      rosterAutocomplete.innerHTML = '';
      rosterAutocomplete.classList.remove('show');
      return;
    }
    const matches = OFFICERS.filter(o => matchesName(o, q) && !state.rosterIds.includes(o.id)).slice(0, LIMITS.maxAutocompleteItems);
    if (matches.length === 0) {
      rosterAutocomplete.innerHTML = '';
      rosterAutocomplete.classList.remove('show');
      return;
    }
    rosterAutocomplete.innerHTML = matches.map(o =>
      `<div class="autocomplete-item" data-id="${o.id}">
        <span>${o.name}</span>
        <span class="autocomplete-item__stats">통${o.leadership} 무${o.power} 지${o.intelligence} 정${o.politics} 매${o.charm}</span>
      </div>`
    ).join('');
    rosterAutocomplete.classList.add('show');
  });

  rosterInput.addEventListener('compositionend', () => {
    rosterInput.dispatchEvent(new Event('input'));
  });

  rosterInput.addEventListener('keydown', (e) => {
    if (e.isComposing) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      const items = rosterAutocomplete.querySelectorAll('.autocomplete-item');
      if (items.length) {
        const target = rosterAcIndex >= 0 ? items[rosterAcIndex] : items[0];
        if (target) { target.click(); flashInput(rosterInput, 'flash-success'); }
      } else if (rosterInput.value.trim()) {
        flashInput(rosterInput, 'flash-fail');
      }
      return;
    }

    const items = rosterAutocomplete.querySelectorAll('.autocomplete-item');
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      rosterAcIndex = Math.min(rosterAcIndex + 1, items.length - 1);
      updateActiveItem(items, rosterAcIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      rosterAcIndex = Math.max(rosterAcIndex - 1, 0);
      updateActiveItem(items, rosterAcIndex);
    } else if (e.key === 'Escape') {
      rosterAutocomplete.classList.remove('show');
      rosterAcIndex = -1;
    }
  });

  rosterAutocomplete.addEventListener('click', (e) => {
    const item = e.target.closest('.autocomplete-item');
    if (!item) return;
    const id = parseInt(item.dataset.id);
    if (state.rosterIds.includes(id)) return;
    state.rosterIds.push(id);
    persistence.saveRoster();
    rosterInput.value = '';
    rosterAutocomplete.innerHTML = '';
    rosterAutocomplete.classList.remove('show');
    renderer.renderRoster();
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#tab-roster .compare-search-wrap')) {
      rosterAutocomplete.classList.remove('show');
    }
  });

  document.getElementById('roster-tbody').addEventListener('click', (e) => {
    const btn = e.target.closest('.row-remove');
    if (btn) {
      const id = parseInt(btn.dataset.id);
      state.rosterIds = state.rosterIds.filter(x => x !== id);
      persistence.saveRoster();
      renderer.renderRoster();
      return;
    }

    const badge = e.target.closest('.trait-badge');
    if (badge && badge.dataset.trait) {
      const trait = badge.dataset.trait;
      const idx = state.rosterTraitFilters.indexOf(trait);
      if (idx >= 0) {
        state.rosterTraitFilters.splice(idx, 1);
      } else {
        state.rosterTraitFilters.push(trait);
      }
      renderer.renderRoster();
      return;
    }

    const formBadge = e.target.closest('.formation-badge');
    if (formBadge && formBadge.dataset.formation) {
      const formation = formBadge.dataset.formation;
      const idx = state.rosterFormationFilters.indexOf(formation);
      if (idx >= 0) {
        state.rosterFormationFilters.splice(idx, 1);
      } else {
        state.rosterFormationFilters.push(formation);
      }
      renderer.renderRoster();
      return;
    }

    const tacticRemoveBtn = e.target.closest('.tactic-remove-btn');
    if (tacticRemoveBtn) {
      const officerId = parseInt(tacticRemoveBtn.dataset.officerId);
      const tactic = tacticRemoveBtn.dataset.tactic;
      const overrides = state.officerTacticsOverrides[officerId] || [];
      const idx = overrides.indexOf(tactic);
      if (idx >= 0) overrides.splice(idx, 1);
      if (overrides.length === 0) delete state.officerTacticsOverrides[officerId];
      else state.officerTacticsOverrides[officerId] = overrides;
      persistence.saveTacticsOverrides();
      renderer.renderRoster();
      return;
    }

    const tacticBadge = e.target.closest('.tactic-badge');
    if (tacticBadge && tacticBadge.dataset.tactic) {
      const tactic = tacticBadge.dataset.tactic;
      const idx = state.rosterTacticsFilters.indexOf(tactic);
      if (idx >= 0) state.rosterTacticsFilters.splice(idx, 1);
      else state.rosterTacticsFilters.push(tactic);
      renderer.renderRoster();
      return;
    }

    const addBtn = e.target.closest('.tactic-add-btn');
    if (addBtn) {
      showTacticAddPopup(parseInt(addBtn.dataset.officerId), addBtn);
      return;
    }

    const moreBtn = e.target.closest('.relation-more-btn');
    if (moreBtn) {
      renderer.showRelationsModal(parseInt(moreBtn.dataset.officerId));
      return;
    }

    const relBadge = e.target.closest('.relation-badge');
    if (relBadge && relBadge.dataset.id) {
      e.stopPropagation(); // officer-name 모달 오픈 방지
      const id = parseInt(relBadge.dataset.id);
      const idx = state.rosterRelationFilters.indexOf(id);
      if (idx >= 0) state.rosterRelationFilters.splice(idx, 1);
      else state.rosterRelationFilters.push(id);
      renderer.renderRoster();
    }
  });

  document.getElementById('roster-filter-tags').addEventListener('click', (e) => {
    const closeBtn = e.target.closest('.filter-tag__close');
    if (!closeBtn) return;
    const trait = closeBtn.dataset.trait;
    const idx = state.rosterTraitFilters.indexOf(trait);
    if (idx >= 0) state.rosterTraitFilters.splice(idx, 1);
    renderer.renderRoster();
  });

  document.getElementById('roster-formation-filter-tags').addEventListener('click', (e) => {
    const closeBtn = e.target.closest('.filter-tag__close');
    if (!closeBtn) return;
    const formation = closeBtn.dataset.formation;
    const idx = state.rosterFormationFilters.indexOf(formation);
    if (idx >= 0) state.rosterFormationFilters.splice(idx, 1);
    renderer.renderRoster();
  });

  document.getElementById('roster-tactics-filter-tags').addEventListener('click', (e) => {
    const closeBtn = e.target.closest('.filter-tag__close');
    if (!closeBtn) return;
    const tactic = closeBtn.dataset.tactic;
    const idx = state.rosterTacticsFilters.indexOf(tactic);
    if (idx >= 0) state.rosterTacticsFilters.splice(idx, 1);
    renderer.renderRoster();
  });

  document.getElementById('roster-relation-filter-tags').addEventListener('click', (e) => {
    const closeBtn = e.target.closest('.filter-tag__close');
    if (!closeBtn) return;
    const id = parseInt(closeBtn.dataset.relationId);
    const idx = state.rosterRelationFilters.indexOf(id);
    if (idx >= 0) state.rosterRelationFilters.splice(idx, 1);
    renderer.renderRoster();
  });

  // ===== Header Filter Search (개성/진형/전법/관계) =====

  function initFilterSearch({ inputId, autocompleteId, allItems, getFilters, addFilter }) {
    const input = document.getElementById(inputId);
    const acList = document.getElementById(autocompleteId);
    let acIndex = -1;

    input.addEventListener('click', (e) => e.stopPropagation());

    input.addEventListener('input', () => {
      acIndex = -1;
      const q = input.value.trim().toLowerCase();
      if (!q) { acList.innerHTML = ''; acList.classList.remove('show'); return; }

      const currentFilters = getFilters();
      const matches = allItems
        .filter(name => name.toLowerCase().includes(q) && !currentFilters.includes(name))
        .slice(0, 8);

      if (!matches.length) { acList.innerHTML = ''; acList.classList.remove('show'); return; }

      acList.innerHTML = matches.map(name =>
        `<div class="autocomplete-item" data-name="${name}"><span>${name}</span></div>`
      ).join('');
      acList.classList.add('show');
    });

    input.addEventListener('compositionend', () => {
      input.dispatchEvent(new Event('input'));
    });

    input.addEventListener('keydown', (e) => {
      if (e.isComposing) return;
      const items = acList.querySelectorAll('.autocomplete-item');

      if (e.key === 'Enter') {
        e.preventDefault();
        const target = acIndex >= 0 ? items[acIndex] : items[0];
        if (target) target.click();
        return;
      }
      if (!items.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        acIndex = Math.min(acIndex + 1, items.length - 1);
        items.forEach((el, i) => el.classList.toggle('active', i === acIndex));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        acIndex = Math.max(acIndex - 1, 0);
        items.forEach((el, i) => el.classList.toggle('active', i === acIndex));
      } else if (e.key === 'Escape') {
        acList.classList.remove('show');
        acIndex = -1;
      }
    });

    acList.addEventListener('click', (e) => {
      const item = e.target.closest('.autocomplete-item');
      if (!item) return;
      addFilter(item.dataset.name);
      input.value = '';
      acList.innerHTML = '';
      acList.classList.remove('show');
      renderer.renderRoster();
    });
  }

  const ALL_FORMATIONS = Object.keys(FORMATIONS_META);

  initFilterSearch({
    inputId: 'trait-filter-input',
    autocompleteId: 'trait-filter-autocomplete',
    allItems: ALL_TRAITS,
    getFilters: () => state.rosterTraitFilters,
    addFilter: (name) => {
      if (!state.rosterTraitFilters.includes(name)) state.rosterTraitFilters.push(name);
    }
  });

  initFilterSearch({
    inputId: 'formation-filter-input',
    autocompleteId: 'formation-filter-autocomplete',
    allItems: ALL_FORMATIONS,
    getFilters: () => state.rosterFormationFilters,
    addFilter: (name) => {
      if (!state.rosterFormationFilters.includes(name)) state.rosterFormationFilters.push(name);
    }
  });

  initFilterSearch({
    inputId: 'tactic-filter-input',
    autocompleteId: 'tactic-filter-autocomplete',
    allItems: ALL_TACTICS_LIST,
    getFilters: () => state.rosterTacticsFilters,
    addFilter: (name) => {
      if (!state.rosterTacticsFilters.includes(name)) state.rosterTacticsFilters.push(name);
    }
  });

  // Relation filter search (ID-based, not name-based)
  {
    const input = document.getElementById('relation-filter-input');
    const acList = document.getElementById('relation-filter-autocomplete');
    let acIndex = -1;

    input.addEventListener('click', (e) => e.stopPropagation());

    input.addEventListener('input', () => {
      acIndex = -1;
      const q = input.value.trim().toLowerCase();
      if (!q) { acList.innerHTML = ''; acList.classList.remove('show'); return; }

      const rosterOfficers = state.rosterIds
        .map(id => OFFICERS.find(o => o.id === id))
        .filter(Boolean);
      const matches = rosterOfficers
        .filter(o => o.name.toLowerCase().includes(q) && !state.rosterRelationFilters.includes(o.id))
        .slice(0, 8);

      if (!matches.length) { acList.innerHTML = ''; acList.classList.remove('show'); return; }

      acList.innerHTML = matches.map(o =>
        `<div class="autocomplete-item" data-id="${o.id}"><span>${o.name}</span></div>`
      ).join('');
      acList.classList.add('show');
    });

    input.addEventListener('compositionend', () => {
      input.dispatchEvent(new Event('input'));
    });

    input.addEventListener('keydown', (e) => {
      if (e.isComposing) return;
      const items = acList.querySelectorAll('.autocomplete-item');
      if (e.key === 'Enter') {
        e.preventDefault();
        const target = acIndex >= 0 ? items[acIndex] : items[0];
        if (target) target.click();
        return;
      }
      if (!items.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        acIndex = Math.min(acIndex + 1, items.length - 1);
        items.forEach((el, i) => el.classList.toggle('active', i === acIndex));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        acIndex = Math.max(acIndex - 1, 0);
        items.forEach((el, i) => el.classList.toggle('active', i === acIndex));
      } else if (e.key === 'Escape') {
        acList.classList.remove('show');
        acIndex = -1;
      }
    });

    acList.addEventListener('click', (e) => {
      const item = e.target.closest('.autocomplete-item');
      if (!item) return;
      const id = parseInt(item.dataset.id);
      if (!state.rosterRelationFilters.includes(id)) state.rosterRelationFilters.push(id);
      input.value = '';
      acList.innerHTML = '';
      acList.classList.remove('show');
      renderer.renderRoster();
    });
  }

  // ===== Tactic Add Popup =====

  const tacticPopup = document.getElementById('tactic-add-popup');
  const tacticAddInput = document.getElementById('tactic-add-input');
  const tacticAddAc = document.getElementById('tactic-add-autocomplete');
  let tacticAddAcIndex = -1;

  function showTacticAddPopup(officerId, anchorEl) {
    tacticPopup.dataset.officerId = officerId;
    tacticAddInput.value = '';
    tacticAddAc.innerHTML = '';
    tacticAddAc.classList.remove('show');
    tacticPopup.classList.add('show');

    const rect = anchorEl.getBoundingClientRect();
    tacticPopup.style.left = rect.left + 'px';
    tacticPopup.style.top = (rect.bottom + 4) + 'px';

    tacticAddInput.focus();
  }

  tacticAddInput.addEventListener('click', (e) => e.stopPropagation());

  tacticAddInput.addEventListener('input', () => {
    tacticAddAcIndex = -1;
    const q = tacticAddInput.value.trim().toLowerCase();
    if (!q) { tacticAddAc.innerHTML = ''; tacticAddAc.classList.remove('show'); return; }

    const officerId = parseInt(tacticPopup.dataset.officerId);
    const officer = OFFICERS.find(o => o.id === officerId);
    const existing = officer ? [...officer.tactics, ...(state.officerTacticsOverrides[officerId] || [])] : [];

    const matches = ALL_TACTICS_LIST
      .filter(name => name.toLowerCase().includes(q) && !existing.includes(name))
      .slice(0, 8);

    if (!matches.length) { tacticAddAc.innerHTML = ''; tacticAddAc.classList.remove('show'); return; }

    tacticAddAc.innerHTML = matches.map(name =>
      `<div class="autocomplete-item" data-name="${name}"><span>${name}</span></div>`
    ).join('');
    tacticAddAc.classList.add('show');
  });

  tacticAddInput.addEventListener('compositionend', () => {
    tacticAddInput.dispatchEvent(new Event('input'));
  });

  tacticAddInput.addEventListener('keydown', (e) => {
    if (e.isComposing) return;
    const items = tacticAddAc.querySelectorAll('.autocomplete-item');

    if (e.key === 'Enter') {
      e.preventDefault();
      const target = tacticAddAcIndex >= 0 ? items[tacticAddAcIndex] : items[0];
      if (target) target.click();
      return;
    }
    if (!items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      tacticAddAcIndex = Math.min(tacticAddAcIndex + 1, items.length - 1);
      items.forEach((el, i) => el.classList.toggle('active', i === tacticAddAcIndex));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      tacticAddAcIndex = Math.max(tacticAddAcIndex - 1, 0);
      items.forEach((el, i) => el.classList.toggle('active', i === tacticAddAcIndex));
    } else if (e.key === 'Escape') {
      tacticPopup.classList.remove('show');
    }
  });

  tacticAddAc.addEventListener('click', (e) => {
    const item = e.target.closest('.autocomplete-item');
    if (!item) return;
    const officerId = parseInt(tacticPopup.dataset.officerId);
    const name = item.dataset.name;
    if (!state.officerTacticsOverrides[officerId]) state.officerTacticsOverrides[officerId] = [];
    state.officerTacticsOverrides[officerId].push(name);
    persistence.saveTacticsOverrides();
    tacticPopup.classList.remove('show');
    renderer.renderRoster();
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.th-filter__search')) {
      document.getElementById('trait-filter-autocomplete').classList.remove('show');
      document.getElementById('formation-filter-autocomplete').classList.remove('show');
      document.getElementById('tactic-filter-autocomplete').classList.remove('show');
      document.getElementById('relation-filter-autocomplete').classList.remove('show');
    }
    if (!e.target.closest('.tactic-add-popup') && !e.target.closest('.tactic-add-btn')) {
      tacticPopup.classList.remove('show');
    }
  });

  document.getElementById('roster-table').addEventListener('click', (e) => {
    const th = e.target.closest('th.sortable');
    if (!th) return;
    const key = th.dataset.sort;
    if (state.rosterSort.key === key) {
      state.rosterSort.dir = state.rosterSort.dir === 'desc' ? 'asc' : 'desc';
    } else {
      state.rosterSort = { key, dir: 'desc' };
    }
    renderer.renderRoster();
  });

  document.getElementById('roster-clear').addEventListener('click', () => {
    if (state.rosterIds.length === 0) return;
    showConfirm('보유 무장을 모두 초기화하시겠습니까?', () => {
      state.rosterIds = [];
      persistence.saveRoster();
      renderer.renderRoster();
    });
  });

  // ===== Cities Tab =====

  const citiesInput = document.getElementById('cities-input');
  const citiesAutocomplete = document.getElementById('cities-autocomplete');
  let citiesAcIndex = -1;

  citiesInput.addEventListener('input', () => {
    citiesAcIndex = -1;
    const q = citiesInput.value.trim();
    if (!q) {
      citiesAutocomplete.innerHTML = '';
      citiesAutocomplete.classList.remove('show');
      return;
    }
    const matches = CITIES.filter(c =>
      c.name.includes(q) && !state.ownedCityIds.includes(c.id)
    ).slice(0, LIMITS.maxAutocompleteItems);
    if (matches.length === 0) {
      citiesAutocomplete.innerHTML = '';
      citiesAutocomplete.classList.remove('show');
      return;
    }
    citiesAutocomplete.innerHTML = matches.map(c =>
      `<div class="autocomplete-item" data-id="${c.id}">
        <span>${c.name}</span>
        <span class="autocomplete-item__stats">${c.province} | 지역내정 ${c.regionSlots}</span>
      </div>`
    ).join('');
    citiesAutocomplete.classList.add('show');
  });

  citiesInput.addEventListener('compositionend', () => {
    citiesInput.dispatchEvent(new Event('input'));
  });

  citiesInput.addEventListener('keydown', (e) => {
    if (e.isComposing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      const items = citiesAutocomplete.querySelectorAll('.autocomplete-item');
      if (items.length) {
        const target = citiesAcIndex >= 0 ? items[citiesAcIndex] : items[0];
        if (target) { target.click(); flashInput(citiesInput, 'flash-success'); }
      } else if (citiesInput.value.trim()) {
        flashInput(citiesInput, 'flash-fail');
      }
      return;
    }
    const items = citiesAutocomplete.querySelectorAll('.autocomplete-item');
    if (!items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      citiesAcIndex = Math.min(citiesAcIndex + 1, items.length - 1);
      updateActiveItem(items, citiesAcIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      citiesAcIndex = Math.max(citiesAcIndex - 1, 0);
      updateActiveItem(items, citiesAcIndex);
    } else if (e.key === 'Escape') {
      citiesAutocomplete.classList.remove('show');
      citiesAcIndex = -1;
    }
  });

  citiesAutocomplete.addEventListener('click', (e) => {
    const item = e.target.closest('.autocomplete-item');
    if (!item) return;
    const id = parseInt(item.dataset.id);
    if (state.ownedCityIds.includes(id)) return;
    state.ownedCityIds.push(id);
    persistence.saveCities();
    citiesInput.value = '';
    citiesAutocomplete.innerHTML = '';
    citiesAutocomplete.classList.remove('show');
    renderer.renderCities();
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#tab-cities .compare-search-wrap')) {
      citiesAutocomplete.classList.remove('show');
    }
  });

  document.getElementById('cities-tbody').addEventListener('click', (e) => {
    const moveUp = e.target.closest('.city-move-up');
    const moveDown = e.target.closest('.city-move-down');
    const remove = e.target.closest('.row-remove');

    if (moveUp) {
      const id = parseInt(moveUp.dataset.id);
      const idx = state.ownedCityIds.indexOf(id);
      if (idx > 0) {
        [state.ownedCityIds[idx - 1], state.ownedCityIds[idx]] =
          [state.ownedCityIds[idx], state.ownedCityIds[idx - 1]];
        persistence.saveCities();
        renderer.renderCities();
      }
    } else if (moveDown) {
      const id = parseInt(moveDown.dataset.id);
      const idx = state.ownedCityIds.indexOf(id);
      if (idx < state.ownedCityIds.length - 1) {
        [state.ownedCityIds[idx], state.ownedCityIds[idx + 1]] =
          [state.ownedCityIds[idx + 1], state.ownedCityIds[idx]];
        persistence.saveCities();
        renderer.renderCities();
      }
    } else if (remove) {
      const id = parseInt(remove.dataset.id);
      state.ownedCityIds = state.ownedCityIds.filter(x => x !== id);
      persistence.saveCities();
      renderer.renderCities();
    }
  });

  document.getElementById('cities-clear').addEventListener('click', () => {
    if (state.ownedCityIds.length === 0) return;
    showConfirm('보유 도시를 모두 초기화하시겠습니까?', () => {
      state.ownedCityIds = [];
      persistence.saveCities();
      renderer.renderCities();
    });
  });

  // ===== Corps Tab =====

  function handleCorpsMemberDrop(evt) {
    const fromList = evt.from;
    const toList = evt.to;
    const fromCorpsId = parseInt(fromList.dataset.corpsId);
    const toCorpsId = parseInt(toList.dataset.corpsId);

    if (fromCorpsId !== toCorpsId) {
      renderCorpsListAndBind();
      return;
    }

    const fromRankId = parseInt(fromList.dataset.rankId);
    const toRankId = parseInt(toList.dataset.rankId);
    const officerId = parseInt(evt.item.dataset.officerId);
    const corps = state.corps.find(c => c.id === fromCorpsId);
    if (!corps) { renderCorpsListAndBind(); return; }
    const fromRank = corps.ranks.find(r => r.id === fromRankId);
    const toRank = corps.ranks.find(r => r.id === toRankId);
    if (!fromRank || !toRank) { renderCorpsListAndBind(); return; }

    const srcIdx = fromRank.memberIds.indexOf(officerId);
    if (srcIdx === -1) { renderCorpsListAndBind(); return; }
    fromRank.memberIds.splice(srcIdx, 1);
    toRank.memberIds.splice(evt.newIndex, 0, officerId);

    persistence.saveCorps();
    renderCorpsListAndBind();
  }

  function initCorpsSortables() {
    if (typeof Sortable === 'undefined') return;
    document.querySelectorAll('.corps-card__member-list').forEach(listEl => {
      new Sortable(listEl, {
        group: 'corps-members',
        handle: '.corps-member__drag-handle',
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        onEnd: handleCorpsMemberDrop,
      });
    });
  }

  function renderCorpsListAndBind(focusTarget) {
    renderer.renderCorpsList(focusTarget);
    initCorpsSortables();
  }

  const addCorps = () => {
    const nameInput = document.getElementById('corps-name-input');
    const name = nameInput.value.trim();
    if (!name) {
      flashInput(nameInput, 'flash-fail');
      return;
    }
    const role = document.getElementById('corps-role-select').value;
    state.corps.push({
      id: state.corpsNextId++,
      name,
      role,
      ranks: [],
      rankNextId: 1,
      sourceCity: null,
      targetCity: null
    });
    persistence.saveCorps();
    nameInput.value = '';
    renderCorpsListAndBind();
  };
  document.getElementById('corps-add-btn').addEventListener('click', addCorps);
  document.getElementById('corps-name-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCorps();
    }
  });

  const corpsList = document.getElementById('corps-list');

  corpsList.addEventListener('click', (e) => {
    // Delete corps
    const deleteBtn = e.target.closest('.corps-card__delete');
    if (deleteBtn) {
      const corpsId = parseInt(deleteBtn.dataset.corpsId);
      state.corps = state.corps.filter(c => c.id !== corpsId);
      persistence.saveCorps();
      renderCorpsListAndBind();
      return;
    }

    // Add rank
    const rankAddBtn = e.target.closest('.corps-rank-add-btn');
    if (rankAddBtn) {
      const corpsId = parseInt(rankAddBtn.dataset.corpsId);
      const corps = state.corps.find(c => c.id === corpsId);
      const input = rankAddBtn.parentElement.querySelector('.corps-rank-input');
      const name = input ? input.value.trim() : '';
      if (!name || !corps) {
        if (input) flashInput(input, 'flash-fail');
        return;
      }
      corps.ranks.push({ id: corps.rankNextId++, name, memberIds: [] });
      persistence.saveCorps();
      renderCorpsListAndBind();
      return;
    }

    // Delete rank
    const rankDeleteBtn = e.target.closest('.corps-rank__delete');
    if (rankDeleteBtn) {
      const corpsId = parseInt(rankDeleteBtn.dataset.corpsId);
      const rankId = parseInt(rankDeleteBtn.dataset.rankId);
      const corps = state.corps.find(c => c.id === corpsId);
      if (corps) {
        corps.ranks = corps.ranks.filter(r => r.id !== rankId);
        persistence.saveCorps();
        renderCorpsListAndBind();
      }
      return;
    }

    // Remove member
    const removeBtn = e.target.closest('.corps-member__remove');
    if (removeBtn) {
      const corpsId = parseInt(removeBtn.dataset.corpsId);
      const rankId = parseInt(removeBtn.dataset.rankId);
      const officerId = parseInt(removeBtn.dataset.officerId);
      const corps = state.corps.find(c => c.id === corpsId);
      const rank = corps && corps.ranks.find(r => r.id === rankId);
      if (rank) {
        rank.memberIds = rank.memberIds.filter(id => id !== officerId);
        persistence.saveCorps();
        renderCorpsListAndBind({ corpsId, rankId });
      }
      return;
    }

    // Autocomplete item click — add member to rank
    const acItem = e.target.closest('.corps-member-autocomplete .autocomplete-item');
    if (acItem) {
      const corpsId = parseInt(acItem.dataset.corpsId);
      const rankId = parseInt(acItem.dataset.rankId);
      const officerId = parseInt(acItem.dataset.officerId);
      const corps = state.corps.find(c => c.id === corpsId);
      const rank = corps && corps.ranks.find(r => r.id === rankId);
      if (rank && !rank.memberIds.includes(officerId)) {
        rank.memberIds.push(officerId);
        persistence.saveCorps();
        renderCorpsListAndBind({ corpsId, rankId });
      }
    }
  });

  // Enter key on rank-add input
  corpsList.addEventListener('keydown', (e) => {
    const rankInput = e.target.closest('.corps-rank-input');
    if (rankInput && !e.isComposing && e.key === 'Enter') {
      e.preventDefault();
      const addBtn = rankInput.parentElement.querySelector('.corps-rank-add-btn');
      if (addBtn) addBtn.click();
      return;
    }

    const input = e.target.closest('.corps-member-input');
    if (!input || e.isComposing) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      const acList = input.parentElement.querySelector('.corps-member-autocomplete');
      const items = acList.querySelectorAll('.autocomplete-item');
      if (items.length) {
        items[0].click();
      }
      return;
    }
    if (e.key === 'Escape') {
      const acList = input.parentElement.querySelector('.corps-member-autocomplete');
      acList.classList.remove('show');
    }
  });

  corpsList.addEventListener('input', (e) => {
    const input = e.target.closest('.corps-member-input');
    if (!input) return;

    const corpsId = parseInt(input.dataset.corpsId);
    const rankId = parseInt(input.dataset.rankId);
    const acList = input.parentElement.querySelector('.corps-member-autocomplete');
    const q = input.value.trim();

    if (!q) {
      acList.innerHTML = '';
      acList.classList.remove('show');
      return;
    }

    const assignedIds = state.getAssignedOfficerIds();
    const matches = OFFICERS.filter(o =>
      matchesName(o, q) &&
      state.rosterIds.includes(o.id) &&
      !assignedIds.has(o.id)
    ).slice(0, LIMITS.maxAutocompleteItems);

    if (matches.length === 0) {
      acList.innerHTML = '';
      acList.classList.remove('show');
      return;
    }

    acList.innerHTML = matches.map(o =>
      `<div class="autocomplete-item" data-corps-id="${corpsId}" data-rank-id="${rankId}" data-officer-id="${o.id}">
        <span>${o.name}</span>
        <span class="autocomplete-item__stats">${o.leadership} ${o.power} ${o.intelligence} ${o.politics}</span>
      </div>`
    ).join('');
    acList.classList.add('show');
  });

  corpsList.addEventListener('compositionend', (e) => {
    const input = e.target.closest('.corps-member-input');
    if (input) input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  corpsList.addEventListener('change', (e) => {
    const sourceSelect = e.target.closest('.corps-source-city');
    if (sourceSelect) {
      const corpsId = parseInt(sourceSelect.dataset.corpsId);
      const corps = state.corps.find(c => c.id === corpsId);
      if (corps) {
        corps.sourceCity = sourceSelect.value ? parseInt(sourceSelect.value) : null;
        persistence.saveCorps();
      }
      return;
    }
    const targetSelect = e.target.closest('.corps-target-city');
    if (targetSelect) {
      const corpsId = parseInt(targetSelect.dataset.corpsId);
      const corps = state.corps.find(c => c.id === corpsId);
      if (corps) {
        corps.targetCity = targetSelect.value ? parseInt(targetSelect.value) : null;
        persistence.saveCorps();
      }
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.corps-search-wrap')) {
      document.querySelectorAll('.corps-member-autocomplete').forEach(el => el.classList.remove('show'));
    }
  });

  // ===== Admin Tab =====

  ['trade-ansik', 'trade-cheonchuk', 'trade-daejin', 'trade-guisang'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('change', () => {
      const key = id.replace('trade-', '');
      state.tradeNations[key] = el.checked;
      persistence.saveTradeNations();
      renderer.renderTradeConfig();
    });
  });

  document.getElementById('admin-run-btn').addEventListener('click', () => {
    state.assignmentResult = assignment.run();
    renderer.renderAssignmentResults(state.assignmentResult);
    renderer.renderSummonTab();
    renderer.renderAppointmentTab();

    // Collapse config sections after execution
    document.querySelectorAll('#tab-admin .collapsible-section').forEach(el => {
      el.classList.add('collapsed');
    });
  });

  // Collapsible section toggle
  document.getElementById('tab-admin').addEventListener('click', (e) => {
    const title = e.target.closest('.collapsible-section > .admin-section__title');
    if (!title) return;
    if (e.target.closest('.btn-reset')) return;
    title.closest('.collapsible-section').classList.toggle('collapsed');
  });

  // City recruit checkboxes
  const adminCitySlots = document.getElementById('admin-city-slots');
  adminCitySlots.addEventListener('change', (e) => {
    const checkbox = e.target.closest('.city-recruit-checkbox');
    if (!checkbox) return;
    const cityId = parseInt(checkbox.dataset.cityId);
    if (checkbox.checked) {
      delete state.cityRecruitDisabled[cityId];
    } else {
      state.cityRecruitDisabled[cityId] = true;
    }
    persistence.saveCityRecruit();
  });

  // City slot overrides
  adminCitySlots.addEventListener('input', (e) => {
    const input = e.target.closest('.city-slot-input');
    if (!input) return;
    const cityId = parseInt(input.dataset.cityId);
    const val = parseInt(input.value);
    if (isNaN(val) || val < 0) return;
    const city = CITIES.find(c => c.id === cityId);
    if (!city) return;
    if (val === city.regionSlots) {
      delete state.citySlotOverrides[cityId];
    } else {
      state.citySlotOverrides[cityId] = val;
    }
    persistence.saveCitySlots();
    renderer.renderAdminCitySlots();
  });

  adminCitySlots.addEventListener('click', (e) => {
    const resetBtn = e.target.closest('.city-slot-reset');
    if (!resetBtn) return;
    const cityId = parseInt(resetBtn.dataset.cityId);
    delete state.citySlotOverrides[cityId];
    persistence.saveCitySlots();
    renderer.renderAdminCitySlots();
  });

  // ===== Manual trade events =====

  const tradeManualEl = document.getElementById('trade-manual-config');

  tradeManualEl.addEventListener('input', (e) => {
    const input = e.target.closest('.trade-manual__input');
    if (!input) return;

    const nation = input.dataset.nation;
    const acList = input.parentElement.querySelector('.trade-manual-autocomplete');
    const q = input.value.trim();

    if (!q) {
      acList.innerHTML = '';
      acList.classList.remove('show');
      return;
    }

    const assignedIds = state.getAssignedOfficerIds();
    const allManualIds = state.getManualTradeIds();

    const matches = OFFICERS.filter(o =>
      matchesName(o, q) &&
      state.rosterIds.includes(o.id) &&
      !assignedIds.has(o.id) &&
      !allManualIds.has(o.id)
    ).slice(0, LIMITS.maxAutocompleteItems);

    if (matches.length === 0) {
      acList.innerHTML = '';
      acList.classList.remove('show');
      return;
    }

    acList.innerHTML = matches.map(o =>
      `<div class="autocomplete-item" data-nation="${nation}" data-officer-id="${o.id}">
        <span>${o.name}</span>
        <span class="autocomplete-item__stats">지정${o.intelligence + o.politics}</span>
      </div>`
    ).join('');
    acList.classList.add('show');
  });

  tradeManualEl.addEventListener('compositionend', (e) => {
    const input = e.target.closest('.trade-manual__input');
    if (input) input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  tradeManualEl.addEventListener('click', (e) => {
    const acItem = e.target.closest('.autocomplete-item');
    if (acItem) {
      const nation = acItem.dataset.nation;
      const officerId = parseInt(acItem.dataset.officerId);
      if (!state.manualTrade[nation]) state.manualTrade[nation] = [];
      if (!state.manualTrade[nation].includes(officerId)) {
        state.manualTrade[nation].push(officerId);
        persistence.saveManualTrade();
        renderer.renderTradeConfig();
      }
      return;
    }

    const removeBtn = e.target.closest('.trade-manual__chip-remove');
    if (removeBtn) {
      const nation = removeBtn.dataset.nation;
      const officerId = parseInt(removeBtn.dataset.officerId);
      state.manualTrade[nation] = (state.manualTrade[nation] || []).filter(id => id !== officerId);
      persistence.saveManualTrade();
      renderer.renderTradeConfig();
      return;
    }
  });

  tradeManualEl.addEventListener('keydown', (e) => {
    const input = e.target.closest('.trade-manual__input');
    if (!input) return;
    if (e.key === 'Escape') {
      const acList = input.parentElement.querySelector('.trade-manual-autocomplete');
      acList.classList.remove('show');
    }
    if (e.key === 'Enter') {
      const acList = input.parentElement.querySelector('.trade-manual-autocomplete');
      const first = acList.querySelector('.autocomplete-item');
      if (first) first.click();
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.trade-manual__search')) {
      document.querySelectorAll('.trade-manual-autocomplete').forEach(el => el.classList.remove('show'));
    }
  });

  // ===== Summon tab events =====

  document.getElementById('summon-content').addEventListener('click', (e) => {
    const officerBtn = e.target.closest('.summon-officer');
    if (officerBtn) {
      const officerId = parseInt(officerBtn.dataset.officerId);
      if (state.summonedIds.has(officerId)) {
        state.summonedIds.delete(officerId);
      } else {
        state.summonedIds.add(officerId);
      }
      persistence.saveSummon();
      renderer.renderSummonTab();
      return;
    }

    if (e.target.closest('#summon-reset-btn')) {
      state.summonedIds.clear();
      persistence.saveSummon();
      renderer.renderSummonTab();
    }
  });

  // ===== Appointment tab events =====

  document.getElementById('appointment-content').addEventListener('click', (e) => {
    const officerBtn = e.target.closest('.summon-officer');
    if (officerBtn) {
      const officerId = parseInt(officerBtn.dataset.officerId);
      if (state.appointmentIds.has(officerId)) {
        state.appointmentIds.delete(officerId);
      } else {
        state.appointmentIds.add(officerId);
      }
      persistence.saveAppointment();
      renderer.renderAppointmentTab();
      return;
    }

    if (e.target.closest('#appointment-reset-btn')) {
      state.appointmentIds.clear();
      persistence.saveAppointment();
      renderer.renderAppointmentTab();
    }
  });

  // ===== Load all persistence & initial render =====

  persistence.loadAll();

  // Restore trade checkboxes
  document.getElementById('trade-ansik').checked = state.tradeNations.ansik;
  document.getElementById('trade-cheonchuk').checked = state.tradeNations.cheonchuk;
  document.getElementById('trade-daejin').checked = state.tradeNations.daejin;
  document.getElementById('trade-guisang').checked = state.tradeNations.guisang;

  renderer.renderOptimizeTable();
  renderer.renderSearchTable();
  renderer.renderRoster();
  renderer.renderCities();
  renderCorpsListAndBind();
  renderer.renderAdminCitySlots();
  renderer.renderTradeConfig();
  renderer.renderAssignmentConfig();

  // ===== Assignment config events =====

  const cfgSelectBindings = [
    ['cfg-admin-pool-stat', 'adminPoolStat'],
    ['cfg-recruit-trait', 'recruitTrait'],
    ['cfg-recruit-sort', 'recruitSortKey'],
    ['cfg-train-trait', 'trainTrait'],
    ['cfg-train-sort', 'trainSortKey'],
    ['cfg-trade-trait', 'tradeTrait'],
    ['cfg-trade-sort', 'tradeSortKey'],
    ['cfg-trade-overflow-mode', 'tradeOverflowMode'],
    ['cfg-governor-sort', 'governorSortKey'],
  ];
  for (const [elId, field] of cfgSelectBindings) {
    document.getElementById(elId).addEventListener('change', (e) => {
      state.assignmentConfig[field] = e.target.value;
      persistence.saveAssignmentConfig();
      if (field === 'tradeOverflowMode') {
        renderer.syncAssignmentConfigUI();
      }
    });
  }

  const cfgNumberBindings = [
    ['cfg-admin-pool-min', 'adminPoolMinValue'],
    ['cfg-trade-target-value', 'tradeTargetValue'],
    ['cfg-max-traders', 'maxTradersPerNation'],
  ];
  for (const [elId, field] of cfgNumberBindings) {
    document.getElementById(elId).addEventListener('change', (e) => {
      state.assignmentConfig[field] = parseInt(e.target.value) || 0;
      persistence.saveAssignmentConfig();
    });
  }

  document.getElementById('assignment-config-reset').addEventListener('click', () => {
    state.assignmentConfig = { ...DEFAULT_ASSIGNMENT_CONFIG };
    persistence.saveAssignmentConfig();
    renderer.syncAssignmentConfigUI();
  });
}

document.addEventListener('DOMContentLoaded', init);
