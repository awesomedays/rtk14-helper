# 삼국지14 PK 내정도우미

삼국지14 PK(파워업키트)의 내정 운영을 효율적으로 관리하기 위한 웹 기반 도우미 앱입니다.

## 주요 기능

| 기능 | 설명 |
|------|------|
| **보유무장 관리** | 현재 보유 중인 무장 목록을 등록하고 능력치를 한눈에 확인 |
| **보유도시 관리** | 보유 도시 목록과 우선순위를 설정 |
| **군단관리** | 점령/전투/방어 군단을 편성하고 무장을 배치 |
| **내정관리** | 태수, 모병, 훈련, 지역내정, 교역 요원을 자동 배정 |
| **호출현황** | 배정 결과를 도시별로 정리하여 게임 내 호출 순서를 안내 |
| **임명현황** | 임명 진행 상태를 체크리스트로 추적 |
| **무장 검색** | 전체 1200명 무장 데이터베이스에서 조건별 검색 |
| **무장 비교** | 최대 4명의 무장을 나란히 비교 |
| **내정 최적화** | 직책별(농업, 상업, 치안 등) 최적 무장 랭킹 |

## 사용 방법

### 웹에서 바로 사용
GitHub Pages를 통해 접속할 수 있습니다:
> https://awesomedays.github.io/rtk14-helper/

### 로컬에서 사용
`index.html` 파일을 브라우저에서 직접 열면 됩니다. 별도의 서버나 빌드 과정이 필요 없습니다.

### 상태 동기화
- **상태 내보내기**: 현재 설정(보유무장, 도시, 군단 등)을 JSON 파일로 저장
- **상태 가져오기**: 다른 기기에서 JSON 파일을 불러와 동일한 상태 복원

## 기술 스택

- **Vanilla HTML / CSS / JavaScript** — 프레임워크 없는 단일 페이지 애플리케이션 (SPA)
- **localStorage** — 브라우저 내 데이터 영속화
- **정적 호스팅** — 서버사이드 로직 없이 순수 클라이언트 사이드로 동작

## 빌드

### 데이터 생성
무장/도시 데이터는 CSV 파일로부터 자동 생성됩니다:
```bash
node scripts/generate_data.js
```
- 입력: `data/RTK14_characters_PK.csv`, `data/RTK_cities.csv`
- 출력: `data.js` (OFFICERS, CITIES 배열 및 파생 목록)

### 앱 번들링
소스 모듈을 단일 번들 파일로 합칩니다:
```bash
node scripts/build.js
```
- 입력: `src/*.js` 모듈
- 출력: `app.bundle.js`

## 프로젝트 구조

```
RTK14Helper/
├── index.html              # 메인 HTML
├── style.css               # 스타일시트 (라이트/다크 테마)
├── app.bundle.js           # 빌드된 애플리케이션 번들 (자동 생성)
├── data.js                 # 자동 생성된 무장/도시 데이터
├── src/                    # 소스 모듈
│   ├── main.js             # 앱 진입점 및 이벤트 핸들러
│   ├── config.js           # 설정 상수 (내정 직책, 특성 보너스 등)
│   ├── state.js            # 애플리케이션 상태 관리
│   ├── persistence.js      # localStorage 영속화
│   ├── scoring.js          # 내정 점수 계산 엔진
│   ├── officers.js         # 무장 검색/필터 유틸리티
│   ├── assignment.js       # 내정 배정 알고리즘
│   └── renderers.js        # UI 렌더링 로직
├── scripts/
│   ├── build.js            # src/ 모듈 → app.bundle.js 번들링
│   └── generate_data.js    # CSV → data.js 변환 스크립트
├── data/                   # 원본 CSV 데이터
│   ├── RTK14_characters_PK.csv
│   ├── RTK14_characters.csv
│   └── RTK_cities.csv
└── docs/                   # 내부 문서
```

## 라이선스

이 프로젝트는 개인 용도로 제작되었습니다. 삼국지14는 코에이 테크모(Koei Tecmo)의 저작물입니다.
