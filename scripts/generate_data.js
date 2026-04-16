// PK CSV + Cities CSV -> data.js 변환 스크립트
// Usage: node scripts/generate_data.js

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PK_CSV = path.join(ROOT, 'data', 'RTK14_characters_PK.csv');
const CITIES_CSV = path.join(ROOT, 'data', 'RTK_cities.csv');
const TRAITS_CSV = path.join(ROOT, 'data', 'RTK14_characters_trait.csv');
const FORMATIONS_CSV = path.join(ROOT, 'data', 'RTK14_characters_PK_formation.csv');
const TACTICS_CSV = path.join(ROOT, 'data', 'RTK14_characters_tactics.csv');
const REL_CSV = path.join(ROOT, 'data', 'RTK14_characters_relationships.csv');
const OUTPUT = path.join(ROOT, 'data.js');

const FORMATION_NAMES = ['어린','봉시','안행','방원','학익','장사','추행','정란','충차','투석','사이'];
const COL_FORMATION_START = 47;

// ===== PK CSV 컬럼 인덱스 =====
const COL = {
  id: 0,           // 무장번호
  name: 1,         // 무장
  gender: 3,       // 성별
  birthYear: 4,    // 생년
  appearYear: 5,   // 등장년
  serviceYear: 6,  // 사관년
  deathYear: 7,    // 사망년
  affinity: 9,     // 상성
  corps: 11,       // 군단
  faction: 12,     // 소속
  location: 13,    // 소재
  leadership: 18,  // 통솔
  power: 19,       // 무력
  intelligence: 20,// 지력
  politics: 21,    // 정치
  charm: 22,       // 매력
  ideology: 24,    // 주의
  tactic1: 36,     // 전법1
  tactic6: 41,     // 전법6
  trait1: 42,      // 개성1
  trait5: 46,      // 개성5
};

function parseCsvLine(line) {
  // Simple CSV parser (no quoted fields with commas expected in this data)
  return line.split(',');
}

// ===== Parse PK Characters =====
function parseCharacters() {
  const raw = fs.readFileSync(PK_CSV, 'utf-8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim());

  // Skip 2 header rows (category row + column name row)
  const dataLines = lines.slice(2);

  const officers = [];
  const corpsSet = new Set();
  const locationSet = new Set();
  const ideologySet = new Set();
  const traitSet = new Set();

  for (const line of dataLines) {
    const cols = parseCsvLine(line);
    if (!cols[COL.id] || !cols[COL.name]) continue;

    const tactics = [];
    for (let i = COL.tactic1; i <= COL.tactic6; i++) {
      if (cols[i] && cols[i].trim()) tactics.push(cols[i].trim());
    }

    const traits = [];
    for (let i = COL.trait1; i <= COL.trait5; i++) {
      if (cols[i] && cols[i].trim()) traits.push(cols[i].trim());
    }

    const formations = [];
    for (let i = 0; i < FORMATION_NAMES.length; i++) {
      if (cols[COL_FORMATION_START + i] && cols[COL_FORMATION_START + i].trim() === '1') {
        formations.push(FORMATION_NAMES[i]);
      }
    }

    const officer = {
      id: parseInt(cols[COL.id]) || 0,
      name: (cols[COL.name] || '').trim(),
      ideology: (cols[COL.ideology] || '').trim(),
      leadership: parseInt(cols[COL.leadership]) || 0,
      power: parseInt(cols[COL.power]) || 0,
      intelligence: parseInt(cols[COL.intelligence]) || 0,
      politics: parseInt(cols[COL.politics]) || 0,
      charm: parseInt(cols[COL.charm]) || 0,
      gender: (cols[COL.gender] || '').trim(),
      birthYear: parseInt(cols[COL.birthYear]) || 0,
      appearYear: parseInt(cols[COL.appearYear]) || 0,
      serviceYear: parseInt(cols[COL.serviceYear]) || 0,
      deathYear: parseInt(cols[COL.deathYear]) || 0,
      affinity: parseInt(cols[COL.affinity]) || 0,
      corps: (cols[COL.corps] || '').trim(),
      faction: (cols[COL.faction] || '').trim(),
      location: (cols[COL.location] || '').trim(),
      tacticCount: tactics.length,
      tactics,
      traitCount: traits.length,
      traits,
      formations,
    };

    officers.push(officer);

    if (officer.corps) corpsSet.add(officer.corps);
    if (officer.location) locationSet.add(officer.location);
    if (officer.ideology) ideologySet.add(officer.ideology);
    for (const t of traits) traitSet.add(t);
  }

  return {
    officers,
    corpsList: [...corpsSet].sort(),
    locationsList: [...locationSet].sort(),
    ideologiesList: [...ideologySet].sort(),
    allTraits: [...traitSet].sort(),
  };
}

// ===== Parse Trait Metadata =====
function parseTraitsMeta() {
  const raw = fs.readFileSync(TRAITS_CSV, 'utf-8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  const map = {};

  for (const line of lines.slice(1)) {
    // 쌍따옴표 내 쉼표를 처리하는 파싱
    const cols = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { cols.push(current); current = ''; continue; }
      current += ch;
    }
    cols.push(current);

    const name = (cols[0] || '').trim();
    if (!name) continue;
    map[name] = {
      tier: (cols[1] || '').trim(),
      desc: (cols[2] || '').trim(),
    };
  }

  return map;
}

// ===== Parse Formations Metadata =====
function parseFormationsMeta() {
  const raw = fs.readFileSync(FORMATIONS_CSV, 'utf-8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  const map = {};

  for (const line of lines.slice(1)) {
    const cols = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { cols.push(current); current = ''; continue; }
      current += ch;
    }
    cols.push(current);

    const name = (cols[0] || '').trim();
    if (!name || !FORMATION_NAMES.includes(name)) continue;
    map[name] = {
      type: (cols[1] || '').trim(),
      desc: (cols[2] || '').trim(),
      cost: parseInt(cols[3]) || 0,
      range: (cols[4] || '').trim() === 'TRUE',
      mobility: (cols[5] || '').trim(),
      attack: (cols[6] || '').trim(),
      siege: (cols[7] || '').trim(),
      breach: (cols[8] || '').trim(),
      defense: (cols[9] || '').trim(),
    };
  }

  return map;
}

// ===== Parse Tactics Metadata =====
function parseTacticsMeta() {
  const raw = fs.readFileSync(TACTICS_CSV, 'utf-8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  const map = {};

  function parseQuotedLine(line) {
    const cols = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { cols.push(current); current = ''; continue; }
      current += ch;
    }
    cols.push(current);
    return cols;
  }

  function formatEffect(name, range, value, duration) {
    if (!name) return '';
    const parts = [name.trim()];
    if (range && range.trim()) parts.push('범위' + range.trim());
    if (value && value.trim()) parts.push(value.trim());
    if (duration && duration.trim()) parts.push(duration.trim());
    return parts.join(' ');
  }

  for (const line of lines.slice(1)) {
    const c = parseQuotedLine(line);
    const name = (c[0] || '').trim();
    if (!name) continue;
    const effect1 = (c[7] || '').trim();
    const effect2 = (c[11] || '').trim();
    map[name] = {
      unique: (c[1] || '').trim() === 'TRUE',
      owner: (c[2] || '').trim(),
      system: (c[3] || '').trim(),
      stat: (c[4] || '').trim(),
      siege: (c[5] || '').trim() === 'TRUE',
      cooldown: (c[6] || '').trim(),
      effect1,
      effect2,
    };
  }

  return map;
}

// ===== Parse Relationships =====
function parseRelationships() {
  const raw = fs.readFileSync(REL_CSV, 'utf-8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  const map = {};

  for (const line of lines.slice(1)) {
    const m = line.match(/^(\d+),/);
    if (!m) continue;
    const id = parseInt(m[1]);
    const quoteStart = line.indexOf('"');
    const quoteEnd = line.lastIndexOf('"');
    if (quoteStart < 0 || quoteEnd <= quoteStart) continue;
    const rest = line.substring(quoteStart + 1, quoteEnd);
    const friends = rest.split(',').map(s => {
      const match = s.trim().match(/^(.+)#(\d+)$/);
      return match ? parseInt(match[2]) : null;
    }).filter(Boolean);
    if (friends.length > 0) map[id] = friends;
  }

  return map;
}

// ===== Parse Cities =====
function parseCities() {
  const raw = fs.readFileSync(CITIES_CSV, 'utf-8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim());

  // Skip header row
  const dataLines = lines.slice(1);
  const cities = [];

  for (let i = 0; i < dataLines.length; i++) {
    const cols = parseCsvLine(dataLines[i]);
    if (cols.length < 3) continue;
    cities.push({
      id: i + 1,
      province: cols[0].trim(),
      name: cols[1].trim(),
      regionSlots: parseInt(cols[2]) || 0,
    });
  }

  return cities;
}

// ===== Generate data.js =====
function generate() {
  const { officers, corpsList, locationsList, ideologiesList, allTraits } = parseCharacters();
  const cities = parseCities();
  const traitsMeta = parseTraitsMeta();
  const formationsMeta = parseFormationsMeta();
  const tacticsMeta = parseTacticsMeta();
  const relationships = parseRelationships();

  console.log(`Parsed ${officers.length} officers, ${cities.length} cities, ${Object.keys(traitsMeta).length} trait metadata`);
  console.log(`Corps: ${corpsList.length}, Locations: ${locationsList.length}, Ideologies: ${ideologiesList.length}, Traits: ${allTraits.length}`);

  let output = '// Auto-generated from RTK14_characters_PK.csv + RTK_cities.csv\n';
  output += '// Do not edit manually\n\n';

  // OFFICERS array
  output += 'export const OFFICERS = ' + JSON.stringify(officers, null, 2) + ';\n\n';

  // CITIES array
  output += 'export const CITIES = ' + JSON.stringify(cities, null, 2) + ';\n\n';

  // Derived lists
  output += 'export const CORPS_LIST = ' + JSON.stringify(corpsList) + ';\n';
  output += 'export const LOCATIONS_LIST = ' + JSON.stringify(locationsList) + ';\n';
  output += 'export const IDEOLOGIES_LIST = ' + JSON.stringify(ideologiesList) + ';\n';
  output += 'export const ALL_TRAITS = ' + JSON.stringify(allTraits) + ';\n';
  output += 'export const TRAITS_META = ' + JSON.stringify(traitsMeta, null, 2) + ';\n';
  output += 'export const FORMATIONS_META = ' + JSON.stringify(formationsMeta, null, 2) + ';\n';
  output += 'export const TACTICS_META = ' + JSON.stringify(tacticsMeta) + ';\n';
  output += 'export const ALL_TACTICS_LIST = ' + JSON.stringify(Object.keys(tacticsMeta).sort()) + ';\n';
  output += 'export const RELATIONSHIPS = ' + JSON.stringify(relationships) + ';\n';

  fs.writeFileSync(OUTPUT, output, 'utf-8');
  console.log(`Written to ${OUTPUT}`);
}

generate();
