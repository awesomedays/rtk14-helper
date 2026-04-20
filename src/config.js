// ===== CONFIGURATION =====

export const AFFAIRS_CONFIG = {
  agriculture: {
    name: '농업',
    icon: '🌾',
    description: '기본: 정치 | 핵심 개성: 농정, 둔전',
    baseCalc: (o) => o.politics,
    baseStat: '정치',
    traitBonuses: { '농정': 15, '둔전': 10, '능리': 5, '진흥': 5 }
  },
  commerce: {
    name: '상업',
    icon: '💰',
    description: '기본: 정치 | 핵심 개성: 징세, 조달',
    baseCalc: (o) => o.politics,
    baseStat: '정치',
    traitBonuses: { '징세': 15, '조달': 10, '능리': 5, '진흥': 5 }
  },
  security: {
    name: '치안',
    icon: '🛡️',
    description: '기본: 정치×0.4 + 통솔×0.3 + 매력×0.3 | 핵심 개성: 교화, 법률',
    baseCalc: (o) => Math.round(o.politics * 0.4 + o.leadership * 0.3 + o.charm * 0.3),
    baseStat: '혼합',
    traitBonuses: { '교화': 12, '법률': 10, '명성': 8, '능리': 5 }
  },
  training: {
    name: '훈련',
    icon: '⚔️',
    description: '기본: 통솔 | 핵심 개성: 교련, 규율',
    baseCalc: (o) => o.leadership,
    baseStat: '통솔',
    traitBonuses: { '교련': 15, '규율': 10, '위무': 8, '독려': 5 }
  },
  walls: {
    name: '성벽',
    icon: '🏯',
    description: '기본: 정치 | 핵심 개성: 축성, 발명',
    baseCalc: (o) => o.politics,
    baseStat: '정치',
    traitBonuses: { '축성': 15, '발명': 10, '능리': 5 }
  },
  development: {
    name: '개발',
    icon: '🔨',
    description: '기본: 정치 | 핵심 개성: 개수, 진흥',
    baseCalc: (o) => o.politics,
    baseStat: '정치',
    traitBonuses: { '개수': 15, '진흥': 10, '능리': 8, '발명': 5 }
  }
};

export const PAGE_SIZE = 50;

export const TAB_CATEGORIES = {
  current: [
    { id: 'roster', label: '보유무장', group: '보유' },
    { id: 'cities', label: '보유도시', group: '보유' },
    { id: 'corps', label: '군단관리', group: '관리' },
    { id: 'admin', label: '내정관리', group: '관리' },
    { id: 'summon', label: '호출현황', group: '현황' },
    { id: 'appointment', label: '임명현황', group: '현황' }
  ],
  all: [
    { id: 'search', label: '무장 검색' },
    { id: 'compare', label: '무장 비교' },
    { id: 'optimize', label: '내정 최적화' }
  ]
};

// 2단계 준비: 하드코딩 임계값 추출
export const THRESHOLDS = {
  adminPoolMinIP: 145,
  tradeTargetIP: 100,
  scoreExceptional: 100,
  scoreHigh: 80,
  scoreGood: 60,
  scoreMid: 40,
  statHigh: 80,
  statMid: 50,
  corpsStatHigh: 90,
  corpsStatMid: 80,
};

export const LIMITS = {
  maxTradersPerNation: 5,
  maxCompareOfficers: 4,
  maxAutocompleteItems: 8,
};

export const TRADE_NATION_NAMES = {
  ansik: '안식국',
  cheonchuk: '천축국',
  daejin: '대진국',
  guisang: '귀상국'
};

export const POOL_TRAITS = {
  recruit: '모집',
  train: '교련',
  trade: '특사',
};

// ===== 2단계: 배정 설정 추상화 =====

export const SORT_KEYS = {
  power:        { label: '무력',       calc: o => o.power },
  leadership:   { label: '통솔',       calc: o => o.leadership },
  intelligence: { label: '지력',       calc: o => o.intelligence },
  politics:     { label: '정치',       calc: o => o.politics },
  charm:        { label: '매력',       calc: o => o.charm },
  lp:           { label: '통솔+무력',   calc: o => o.leadership + o.power },
  ip:           { label: '지력+정치',   calc: o => o.intelligence + o.politics },
  total:        { label: '총합',       calc: o => o.leadership + o.power + o.intelligence + o.politics + o.charm },
};

export const TRADE_OVERFLOW_MODES = {
  closest: '목표값 근접',
  desc: '내림차순',
};

export const LIFESPAN_MODES = {
  realistic: '사실',
  longLived: '장수',
  none: '수명없음',
};

export const DEFAULT_ASSIGNMENT_CONFIG = {
  adminPoolStat: 'ip',
  adminPoolMinValue: 145,
  recruitTrait: '모집',
  recruitSortKey: 'power',
  trainTrait: '교련',
  trainSortKey: 'lp',
  tradeTrait: '특사',
  tradeSortKey: 'ip',
  tradeOverflowMode: 'closest',
  tradeTargetValue: 100,
  maxTradersPerNation: 5,
  governorSortKey: 'ip',
};
