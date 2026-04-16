// PK CSV 관계 데이터를 친애 CSV에 병합하는 스크립트
// Usage: node scripts/merge_relationships.js

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PK_CSV = path.join(ROOT, 'data', 'RTK14_characters_PK.csv');
const REL_CSV = path.join(ROOT, 'data', 'RTK14_characters_relationships.csv');

// ===== PK CSV 파싱 =====
const pkRaw = fs.readFileSync(PK_CSV, 'utf-8').split(/\r?\n/);
const pkData = pkRaw.slice(2).filter(l => l.trim()).map(l => {
  const c = l.split(',');
  return {
    id: parseInt(c[0]) || 0,
    name: (c[1] || '').trim(),
    spouse: (c[30] || '').trim(),
    sworn: (c[31] || '').trim(),
    blood: (c[32] || '').trim(),
    father: (c[33] || '').trim(),
    mother: (c[34] || '').trim(),
  };
}).filter(o => o.id && o.name);

// 이름 → ID 매핑 (중복 이름 주의: 첫 번째만 매핑)
const nameToId = {};
const idToName = {};
pkData.forEach(o => {
  if (!nameToId[o.name]) nameToId[o.name] = o.id;
  idToName[o.id] = o.name;
});
const validIds = new Set(pkData.map(o => o.id));

console.log(`PK CSV: ${pkData.length} officers parsed`);

// ===== 기존 친애 CSV 파싱 =====
const relRaw = fs.readFileSync(REL_CSV, 'utf-8').split(/\r?\n/);
const relMap = {}; // { officerId: Set<friendId> }

relRaw.slice(1).filter(l => l.trim()).forEach(l => {
  const m = l.match(/^(\d+),/);
  if (!m) return;
  const id = parseInt(m[1]);
  const quoteStart = l.indexOf('"');
  const quoteEnd = l.lastIndexOf('"');
  if (quoteStart < 0 || quoteEnd <= quoteStart) {
    relMap[id] = new Set();
    return;
  }
  const rest = l.substring(quoteStart + 1, quoteEnd);
  const friends = rest.split(',').map(s => {
    const match = s.trim().match(/^(.+)#(\d+)$/);
    return match ? parseInt(match[2]) : null;
  }).filter(Boolean);
  relMap[id] = new Set(friends);
});

console.log(`Relationships CSV: ${Object.keys(relMap).length} officers loaded`);

// ===== 기존 친애 CSV 양방향 보정 =====
let existingFixed = 0;
Object.entries(relMap).forEach(([id, friends]) => {
  const numId = parseInt(id);
  friends.forEach(friendId => {
    if (!relMap[friendId]) relMap[friendId] = new Set();
    if (!relMap[friendId].has(numId)) {
      relMap[friendId].add(numId);
      existingFixed++;
    }
  });
});
console.log(`기존 친애 양방향 보정: ${existingFixed} relations added`);

// ===== 양방향 관계 추가 헬퍼 =====
function addBidirectional(idA, idB) {
  if (!idA || !idB || idA === idB) return;
  if (!validIds.has(idA) || !validIds.has(idB)) return;
  if (!relMap[idA]) relMap[idA] = new Set();
  if (!relMap[idB]) relMap[idB] = new Set();
  relMap[idA].add(idB);
  relMap[idB].add(idA);
}

// ===== 배우자 병합 =====
let spouseAdded = 0;
pkData.forEach(o => {
  if (!o.spouse) return;
  const spouseId = nameToId[o.spouse];
  if (spouseId) {
    const before = (relMap[o.id] ? relMap[o.id].size : 0) + (relMap[spouseId] ? relMap[spouseId].size : 0);
    addBidirectional(o.id, spouseId);
    const after = (relMap[o.id].size) + (relMap[spouseId].size);
    spouseAdded += (after - before);
  }
});
console.log(`배우자: ${spouseAdded} relations added`);

// ===== 의형제 병합 (그룹 기반) =====
const swornGroups = {};
pkData.forEach(o => {
  if (!o.sworn) return;
  if (!swornGroups[o.sworn]) swornGroups[o.sworn] = [];
  swornGroups[o.sworn].push(o.id);
});

let swornAdded = 0;
Object.values(swornGroups).forEach(group => {
  if (group.length < 2) return;
  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      const before = (relMap[group[i]] ? relMap[group[i]].size : 0) + (relMap[group[j]] ? relMap[group[j]].size : 0);
      addBidirectional(group[i], group[j]);
      const after = relMap[group[i]].size + relMap[group[j]].size;
      swornAdded += (after - before);
    }
  }
});
console.log(`의형제: ${swornAdded} relations added (${Object.keys(swornGroups).length} groups)`);

// ===== 혈연 병합 (그룹 기반) =====
const bloodGroups = {};
pkData.forEach(o => {
  if (!o.blood) return;
  if (!bloodGroups[o.blood]) bloodGroups[o.blood] = [];
  bloodGroups[o.blood].push(o.id);
});

let bloodAdded = 0;
Object.values(bloodGroups).forEach(group => {
  if (group.length < 2) return;
  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      const before = (relMap[group[i]] ? relMap[group[i]].size : 0) + (relMap[group[j]] ? relMap[group[j]].size : 0);
      addBidirectional(group[i], group[j]);
      const after = relMap[group[i]].size + relMap[group[j]].size;
      bloodAdded += (after - before);
    }
  }
});
console.log(`혈연: ${bloodAdded} relations added (${Object.keys(bloodGroups).length} groups)`);

// ===== 부친 병합 =====
let fatherAdded = 0;
pkData.forEach(o => {
  if (!o.father) return;
  const fatherId = nameToId[o.father];
  if (fatherId && fatherId !== o.id) {
    const before = (relMap[o.id] ? relMap[o.id].size : 0) + (relMap[fatherId] ? relMap[fatherId].size : 0);
    addBidirectional(o.id, fatherId);
    const after = relMap[o.id].size + relMap[fatherId].size;
    fatherAdded += (after - before);
  }
});
console.log(`부친: ${fatherAdded} relations added`);

// ===== 모친 병합 =====
let motherAdded = 0;
pkData.forEach(o => {
  if (!o.mother) return;
  const motherId = nameToId[o.mother];
  if (motherId && motherId !== o.id) {
    const before = (relMap[o.id] ? relMap[o.id].size : 0) + (relMap[motherId] ? relMap[motherId].size : 0);
    addBidirectional(o.id, motherId);
    const after = relMap[o.id].size + relMap[motherId].size;
    motherAdded += (after - before);
  }
});
console.log(`모친: ${motherAdded} relations added`);

// ===== Phase 1.5: 데이터 무결성 검증 =====
console.log('\n===== 무결성 검증 =====');
let errors = 0;

// 검증 1: 누락 재검사
let missingCount = { spouse: 0, sworn: 0, father: 0, mother: 0 };
pkData.forEach(o => {
  const friends = relMap[o.id] || new Set();

  if (o.spouse) {
    const spouseId = nameToId[o.spouse];
    if (spouseId && !friends.has(spouseId)) missingCount.spouse++;
  }

  if (o.sworn) {
    const group = swornGroups[o.sworn] || [];
    group.forEach(gid => {
      if (gid !== o.id && !friends.has(gid)) missingCount.sworn++;
    });
  }

  if (o.father) {
    const fatherId = nameToId[o.father];
    if (fatherId && fatherId !== o.id && !friends.has(fatherId)) missingCount.father++;
  }

  if (o.mother) {
    const motherId = nameToId[o.mother];
    if (motherId && motherId !== o.id && !friends.has(motherId)) missingCount.mother++;
  }
});
console.log(`검증1 — 누락: 배우자 ${missingCount.spouse}, 의형제 ${missingCount.sworn}, 부친 ${missingCount.father}, 모친 ${missingCount.mother}`);
if (missingCount.spouse + missingCount.sworn + missingCount.father + missingCount.mother > 0) {
  console.error('ERROR: 누락이 남아있습니다!');
  errors++;
}

// 검증 2: 자기참조 검사
let selfRef = 0;
Object.entries(relMap).forEach(([id, friends]) => {
  if (friends.has(parseInt(id))) {
    selfRef++;
    console.error(`  자기참조: ID ${id} (${idToName[id]})`);
  }
});
console.log(`검증2 — 자기참조: ${selfRef}건`);
if (selfRef > 0) errors++;

// 검증 3: 양방향 일관성 검사
let asymmetric = 0;
Object.entries(relMap).forEach(([id, friends]) => {
  const numId = parseInt(id);
  friends.forEach(friendId => {
    const friendSet = relMap[friendId];
    if (!friendSet || !friendSet.has(numId)) {
      asymmetric++;
    }
  });
});
console.log(`검증3 — 양방향 불일치: ${asymmetric}건`);
if (asymmetric > 0) errors++;

// 검증 4: ID 유효성 검사
let invalidIds = 0;
Object.entries(relMap).forEach(([id, friends]) => {
  if (!validIds.has(parseInt(id))) { invalidIds++; return; }
  friends.forEach(fid => {
    if (!validIds.has(fid)) invalidIds++;
  });
});
console.log(`검증4 — 유효하지 않은 ID: ${invalidIds}건`);
if (invalidIds > 0) errors++;

if (errors > 0) {
  console.error(`\n검증 실패 (${errors}건). CSV를 저장하지 않습니다.`);
  process.exit(1);
}
console.log('\n모든 검증 통과!');

// ===== CSV 재작성 =====
const lines = ['번호,대상,인원수,무장'];
const sortedIds = Object.keys(relMap).map(Number).sort((a, b) => a - b);

sortedIds.forEach(id => {
  const friends = [...relMap[id]].sort((a, b) => a - b);
  if (friends.length === 0) return;
  const name = idToName[id] || '?';
  const friendStrs = friends.map(fid => `${idToName[fid] || '?'}#${fid}`).join(', ');
  lines.push(`${id},${name}#${id},${friends.length},"${friendStrs}"`);
});

fs.writeFileSync(REL_CSV, lines.join('\n') + '\n', 'utf-8');
console.log(`\nCSV 저장 완료: ${sortedIds.length} officers, ${REL_CSV}`);
