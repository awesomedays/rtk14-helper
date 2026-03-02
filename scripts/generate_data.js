// PK CSV + Cities CSV -> data.js 변환 스크립트
// Usage: node scripts/generate_data.js

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PK_CSV = path.join(ROOT, 'data', 'RTK14_characters_PK.csv');
const CITIES_CSV = path.join(ROOT, 'data', 'RTK_cities.csv');
const OUTPUT = path.join(ROOT, 'data.js');

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

  console.log(`Parsed ${officers.length} officers, ${cities.length} cities`);
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

  fs.writeFileSync(OUTPUT, output, 'utf-8');
  console.log(`Written to ${OUTPUT}`);
}

generate();
