// 친애 관계 MD -> CSV 변환 스크립트
// Usage: node scripts/convert_relationships.js

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INPUT = path.join(ROOT, 'data', 'RTK14_characters_relationships.md');
const PK_CSV = path.join(ROOT, 'data', 'RTK14_characters_PK.csv');
const OUTPUT = path.join(ROOT, 'data', 'RTK14_characters_relationships.csv');

// 제거 대상 캐릭터 (콜라보, 고대, 수호전, 특전 등)
const EXCLUDED = new Set([
  // 은하영웅전설
  '라인하르트','양','키르히아이스','키리히아이스','미터마이어','로이엔탈',
  '힐다','비텐펠트','안네로제','카젤느','쇤코프','프레데리카','아텐보로',
  '뷰코크','포플랭','트뤼니히트','오베르슈타인','포크','브라운슈바이크',
  '오프레서','영호우',
  // 라이자의 아틀리에
  '라이자1','라이자2','렌트1','렌트2','타오1','타오2',
  '클라우디아1','클라우디아2','엠펠','릴라','파트리샤','클리포드','세리',
  // DOA
  '아야네','카스미','마리','미사키',
  // 일본 역사
  '오다노부나가','다케다신겐','우에스기겐신','사카모토료마',
  '가쓰가이슈','사이고다카모리','다카스기신사쿠',
  // 기타 콜라보
  '라찌','쿠즈하','수녀 클레어','수녀','클레어','데비데비데비르','양옥환',
  '율리안',
  // 특전/커스텀
  '제갈양',
  // 고대 중국
  '악의','항적','유방','장량','소하','손빈','영정','한비','이사','이신',
  '몽염','소진','장의','이목','염파','인상여','추기','곽외','희평',
  '관이오','포숙아','항연','우희','여상','전문','위무기','전기','극신',
  '한신','조옹','조승','황헐','전인제','오기','웅의','왕전',
  // 수호전
  '화영','임충','호연작','오용','이규','연청',
  // 칭기즈칸
  '칭기즈칸','쿠빌라이','보르테','자무카','야율초재',
  // 당나라
  '이세민','장손무기','이정','울지공','진경',
  // 송나라
  '악비','공구',
  // 기타 역사
  '정성공','고장공','곽거병',
]);

// PK CSV 동명이인 → 원본 MD 태그로 정확한 번호 매핑
// key: MD 원본 표기(괄호 포함), value: PK 번호
const HOMONYM_ID = {
  // 우금
  '우금(于禁)': '16', '우금(牛金)': '197',
  // 왕상
  '왕상(王祥)': '61', '왕상(王商)': '63',
  // 주태
  '주태(周泰)': '373', '주태(州泰)': '374',
  // 순욱
  '순욱(荀彧)': '393', '순욱(荀勗)': '397',
  // 서상
  '서상(徐詳)': '448', '서상(徐商)': '447',
  // 조예
  '조예(曹叡)': '501',
  // 조앙
  '조앙(趙昂)': '621', '조앙(曹昻)': '510',
  // 조홍
  '조홍(曹洪)': '511', '조홍(趙弘)': '620',
  // 조표
  '조표(曹彪)': '528',
  // 손환
  '손환(孫桓)': '544',
  // 손분
  '손분(孫賁)': '572',
  // 장소
  '장소(張昭)': '631',
  // 장승
  '장승(張承)': '634',
  // 장선
  '장선(張先)': '641',
  // 장제
  '장제(蔣濟)': '418', '장제(張濟)': '638', '장제(張悌)': '648',
  // 장남
  '장남(원소)': '651', '장남(촉한)': '652',
  // 장포
  '장포(張苞)': '657', '장포(張布)': '658',
  // 진수
  '진수(陳壽)': '677',
  // 정봉
  '정봉(丁奉)': '706',
  // 마충
  '마충(촉)': '768',
  // 양홍
  '양홍(楊弘)': '861', '양홍(楊洪)': '863',
  // 뇌서
  '뇌서(雷敘)': '884', '뇌서(雷緖)': '885',
  // 이풍
  '이풍(위)': '918', '이풍(원술)': '919',
  // 유기
  '유기(劉琦)': '929', '유기(劉基)': '930',
  // 유선
  '유선(劉禪)': '945', '유선(劉先)': '944',
  // 유표
  '유표(劉表)': '953', '유표(劉豹)': '954',
  // 여건
  '여건(呂虔)': '980', '여건(呂建)': '981',
  // 노숙
  '노숙(魯肅)': '997', '노숙(魯淑)': '998',
  // 장양
  '장양': '661',
  // 양봉 (태그 없이 두 번 등장, 한섬과의 친애는 후한말 양봉)
  '양봉': '880',
  // 허정
  '허정(許靖)': '214',
  // 고승
  '고승(顧承)': '299',
  // 심영
  '심영(審榮)': '454',
  // 한충
  '한충(황건)': '173',
  // 왕기
  '왕기(王基)': '46',
  // 왕사
  '왕사(王思)': '55',
  // 관통
  '관통(管統)': '177',
  // 한기
  '한기(韓起)': '151',
  // 장포 (태그 없이 등장하는 경우 — 장비의 아들 張苞)
  '장포': '657',
};

// 동명이인 한글 이름 Set — PK CSV 기준으로 런타임에 구성 (main에서 설정)
const HOMONYM_NAMES = new Set();

const SECTION_HEADERS = new Set(['군주', '일반무장', '고대무장, 특전무장']);

function stripZWS(s) {
  return s.replace(/[\u200B\u200C\u200D\uFEFF]/g, '');
}

function cleanName(raw) {
  return raw.replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '').replace(/[\u200B\u200C\u200D\uFEFF]/g, '').trim();
}

// 원본 태그를 보존한 채 이름 추출 (괄호 포함)
function preserveTag(raw) {
  return raw.replace(/\[.*?\]/g, '').replace(/[\u200B\u200C\u200D\uFEFF]/g, '').trim();
}

// 친애 목록 파싱: 각 토큰을 {tagged, clean} 형태로 반환
function parseFriendsLine(line) {
  const results = [];
  const tokens = line.replace(/\//g, ',').split(',');
  for (const token of tokens) {
    const tagged = preserveTag(token);
    const clean = cleanName(token);
    if (!clean) continue;
    if (clean.includes(' ')) {
      for (const part of clean.split(/\s+/)) {
        if (part) results.push({ tagged: part, clean: part });
      }
    } else {
      results.push({ tagged, clean });
    }
  }
  return results;
}

// 이름에 #번호를 붙여 반환
function displayName(tagged, clean, nameToId) {
  // 동명이인은 HOMONYM_ID에서 번호 조회
  if (HOMONYM_NAMES.has(clean)) {
    const id = HOMONYM_ID[tagged];
    if (id) return `${clean}#${id}`;
  }
  // 일반 무장은 nameToId에서 조회
  if (nameToId) {
    const id = nameToId.get(clean);
    if (id) return `${clean}#${id}`;
  }
  return clean;
}

function main() {
  const content = fs.readFileSync(INPUT, 'utf-8');
  const lines = content.split(/\r?\n/);

  // 1. PK CSV에서 번호 매핑 로드
  const pkLines = fs.readFileSync(PK_CSV, 'utf-8').split(/\r?\n/).slice(2);
  const nameToId = new Map(); // 단일 이름 → 번호 (동명이인이 아닌 경우)
  const idByName = new Map(); // name -> [id, id, ...]
  for (const line of pkLines) {
    if (!line.trim()) continue;
    const cols = line.split(',');
    const id = cols[0], name = cols[1];
    if (!idByName.has(name)) idByName.set(name, []);
    idByName.get(name).push(id);
  }
  // 동명이인 판별 + 단일 이름만 nameToId에 등록
  for (const [name, ids] of idByName) {
    if (ids.length === 1) {
      nameToId.set(name, ids[0]);
    } else {
      HOMONYM_NAMES.add(name);
    }
  }

  // 2. 상태머신 파싱 (원본 태그 보존)
  const entries = [];
  let state = 'HEADER';
  let currentTagged = null;
  let currentClean = null;

  for (const rawLine of lines) {
    const line = stripZWS(rawLine).trim();
    if (!line) continue;
    if (SECTION_HEADERS.has(line)) continue;

    if (state === 'HEADER') {
      const match = line.match(/^(.+?)\s*(?:←|-)\s*$/);
      if (match) {
        currentTagged = preserveTag(match[1]);
        currentClean = cleanName(match[1]);
        state = 'FRIENDS';
      }
    } else if (state === 'FRIENDS') {
      entries.push({ tagged: currentTagged, clean: currentClean, friendsRaw: line });
      state = 'HEADER';
    }
  }

  console.log(`파싱 완료: ${entries.length}개 항목`);

  // 3. 정제 + 필터 + 동명이인 분리
  // key: displayName (동명이인은 "주태#373"), value: { id, friends: Set }
  const map = new Map();
  let excludedCount = 0;

  for (const { tagged, clean, friendsRaw } of entries) {
    if (EXCLUDED.has(clean)) { excludedCount++; continue; }

    const dName = displayName(tagged, clean, nameToId);
    const id = HOMONYM_ID[tagged] || nameToId.get(clean) || '';

    const friends = parseFriendsLine(friendsRaw)
      .filter(f => !EXCLUDED.has(f.clean))
      .map(f => displayName(f.tagged, f.clean, nameToId))
      .filter(f => f !== dName); // 자기 자신 제거

    if (map.has(dName)) {
      const existing = map.get(dName);
      for (const f of friends) existing.friends.add(f);
    } else {
      map.set(dName, { id, friends: new Set(friends) });
    }
  }

  // 빈 친애 목록 제거
  for (const [name, data] of map) {
    if (data.friends.size === 0) map.delete(name);
  }

  console.log(`제거: ${excludedCount}개, 최종: ${map.size}개`);

  // 4. CSV 출력 (번호순)
  const sorted = [...map.entries()].sort((a, b) => {
    const idA = a[1].id, idB = b[1].id;
    if (idA && idB) return Number(idA) - Number(idB);
    if (idA) return -1;
    if (idB) return 1;
    return a[0].localeCompare(b[0], 'ko');
  });

  const csvLines = ['번호,대상,인원수,무장'];
  let unmatchedCount = 0;
  for (const [name, { id, friends }] of sorted) {
    if (!id) unmatchedCount++;
    const list = [...friends].join(', ');
    csvLines.push(`${id},${name},${friends.size},"${list}"`);
  }

  fs.writeFileSync(OUTPUT, csvLines.join('\n'), 'utf-8');
  if (unmatchedCount) console.log(`PK 번호 미매칭: ${unmatchedCount}개`);
  console.log(`출력: ${OUTPUT}`);
}

main();
