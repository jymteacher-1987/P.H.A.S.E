# 패러데이: 스파크 항해

5스테이지 비행 슈팅. 코일·자석·축전기를 수집하며 전자기 유도의 작은 원리를 만납니다. 방향키/WASD 또는 상대 위치 드래그로 움직이고 자동으로 공격합니다. 스페이스나 오른쪽 아래 버튼으로 스파크 폭풍을 사용합니다. Esc는 일시정지입니다. 진행은 기기에 저장하며, 결과창에서 별명과 점수를 Firebase 공유 순위에 등록할 수 있습니다. 일반/여유롭게 순위는 각각 상위 10명입니다.

## 미술과 소리

- `hero.webp`: 위쪽으로 향하는 기체와 패러데이의 뒷모습, 8개 비행 동작. 머리·등·기체 방향을 같은 방향으로 수정했습니다.
- `enemies.webp`: 세 종류 기계 드론, 각각 4개 동작.
- `poverty.webp`, `gate.webp`, `symbols.webp`, `fog.webp`: 서로 다른 보스, 각각 4개 동작.
- `boss.webp`: 실패의 발전기, 8개 동작.
- `world.webp`: 독자 제작한 구름도시 배경.

캐릭터·배경은 이 프로젝트의 설명으로 새로 생성한 이미지입니다. 기존 게임의 캐릭터, 화면, 그림을 참조 이미지로 사용하지 않았습니다. 투명 알파를 유지한 WebP로 변환했으며 `sprites.json`은 각 동작의 실제 영역과 기준점을 담습니다. `art-prompts.json`에 제작 설명을 보관합니다. 제3자 캐릭터 라이선스에 의존하지 않지만, 이 기록이 모든 지역에서의 독점권이나 법적 무분쟁을 보증하는 것은 아닙니다.

`audio.js`는 Web Audio로 합성하는 자체 음표 배열과 효과음입니다. 외부 음원·샘플을 포함하지 않습니다. 글꼴은 Google Fonts의 Noto Sans KR / Black Han Sans를 CSS로 읽고, 연결할 수 없으면 시스템 글꼴을 사용합니다.

## 과학 모형과 게임 규칙

`physics.js`와 화면은 코일을 향해 자석을 넣고 빼는 축 방향 왕복 운동을 사용합니다. 무차원 거리 `d = 1.45 + 1.25 cos(phase)`, 정성적인 선속 모형 `Φ = B A / (1+d²)^(3/2)`, 전압 `emf = -N dΦ/dt`를 같은 상태에서 계산합니다. 실제 막대자석의 정확한 장 분포나 유한 길이 코일의 해는 아닙니다. N/B 비교에서는 기하와 운동을 고정합니다. 기존 회전 코일 식은 단위 검사용으로만 남습니다. 정지한 자석은 지속적으로 전기를 생산하지 않습니다. 자석은 N/S 쌍으로 표시하며 운동을 유지하는 외부의 일이 발전 에너지의 원천입니다.

`induction-diagram.js`는 코일의 두 단자를 끊김 없이 배선하고, 전구는 원 안의 X인 표준 회로 기호로 표시합니다. 축전기 탭은 AC 입력 두 단자, 다이오드 4개의 브리지 정류기, 같은 극성의 DC 출력, 축전기, 병렬 스위치와 전구를 실제 연결 관계로 그립니다. 교차하지만 연결되지 않는 배선은 점 대신 다리 모양으로 표시합니다. 입력 부호에 따라 도통하는 두 다이오드를 바꾸되 출력 극성은 유지합니다. `capacitorStep`은 유효한 직렬 저항을 통한 이상적인 충전이며, |emf|가 Vc보다 클 때만 충전하고 그 외에는 역방향 방전을 차단합니다. 사용 버튼은 발전을 멈추고 전구 회로를 닫아 RC 방전을 보여줍니다. 충전량 Q=CV, 저장 에너지 E=CV²/2에 대응하며 절연층을 통한 전하 이동을 그리지 않습니다. 다이오드 전압 강하, 누설, 자체 유도, 실제 전구의 비선형 저항과 열 관성은 생략합니다.

- 코일 아이템: 감은 수 증가를 나타냅니다. 피해 증가, 탄 수, 추적 미사일과 폭발 미사일은 게임을 위한 강화 규칙입니다.
- 충돌: 코일 한 겹이 실제로 풀려 유효한 감은 수가 줄었다는 설정입니다. 단순히 코일 간격이 넓어지면 언제나 전압이 감소한다는 뜻은 아닙니다.
- 자석: 동일한 움직임에서 더 큰 자기장 변화와 유도 전압을 표현합니다.
- 과열 파편: 일부 자석이 높은 온도에서 약해질 수 있다는 성질을 소재로 삼았습니다. 7초의 회복이나 냉각 즉시 복구는 게임 규칙이며, 자석의 실제 약화에 관한 온도·영구성·회복을 시뮬레이션하지 않습니다.
- 축전기: 발전기로 충전하거나 충전된 아이템을 수집합니다. 비행 중 게이지의 저장 한도, 충전율, 탄막을 지우는 효과는 게임 규칙이며 실제 J/V/C 측정값이 아닙니다. 발명 노트의 실제 충전 회로 모형과 비행 중 보상 게이지는 구분합니다.
- 초록 원 안의 번개 토큰은 오버드라이브를 위한 수집물이며 전하 하나나 실제 전지를 뜻하지 않습니다. 일반 토큰은 동시에 최대 6개, 보스 보상은 4개입니다. 모든 이로운 부품은 같은 원 테두리를 사용하고 과열 파편은 빨간 삼각형입니다. 구리 부품까지 끌어오는 수집 효과는 별도의 부품 회수 장치입니다.
- 오버드라이브는 7초간 연사·피해·조작 반응을 강화하는 게임 규칙입니다. 짧은 엔진 불꽃, 가속되는 배경, 화면 가장자리의 바람으로 표현하며 기체 아래 사각 빛 막대는 사용하지 않습니다.

패러데이가 이 비행기나 미사일을 발명하거나 사용했다는 역사적 주장을 하지 않습니다. 전자기 유도에서 착안한 가상 장비입니다. 보스들도 실제 인물이나 사건 그 자체가 아니라 삶의 어려움을 의인화한 창작입니다.

## 역사와 수업에 사용할 출처

1. [왕립연구소: 어린 패러데이의 노트](https://www.rigb.org/explore-science/explore/blog/notebooks-preview-note-taking-life-young-michael-faraday) — 가정 형편, 제본과 독학, 데이비 강연 기록.
2. [왕립연구소: 패러데이의 런던](https://www.rigb.org/explore-science/explore/collection/tour-michael-faraday-london) — 직업과 배움의 기회.
3. [IOP: 맥스웰 방정식](https://www.iop.org/explore-physics/big-ideas-physics/maxwells-equations) — 패러데이의 생각과 맥스웰의 수학적 발전.
4. [왕립연구소: 1831년 고리 코일 장치](https://www.rigb.org/explore-science/explore/collection/michael-faradays-ring-coil-apparatus) — 전자기 유도 발견의 역사적 장치.
5. [The Life and Letters of Faraday, 1841–1844](https://www.cambridge.org/core/services/aop-cambridge-core/content/view/3C9EF7202C54B7BF191BD225F425AA42/9780511709821c2_p126-192_CBO.pdf/18411844_to_aet_53.pdf) — 기억력과 어지럼증, 연구 중단과 휴식. 질병의 원인이나 치료에 관한 게임 내 주장은 하지 않습니다.
6. [OpenStax: 전자기 유도](https://openstax.org/books/physics/pages/20-3-electromagnetic-induction), [발전기](https://openstax.org/books/university-physics-volume-2/pages/13-6-electric-generators-and-back-emf), [축전기의 에너지](https://openstax.org/books/university-physics-volume-2/pages/8-3-energy-stored-in-a-capacitor), [자성 물질](https://openstax.org/books/university-physics-volume-2/pages/12-7-magnetism-in-matter).

## 수정과 검사

Firebase 프로젝트 `newton-rush`의 인프라를 재사용하되, 앱 이름·별명 저장 키와 데이터 경로를 분리합니다. 패러데이는 `faradayScores/normal/players/{uid}`와 `faradayScores/easy/players/{uid}`만 읽고 씁니다. 뉴턴 게임의 `newtonScores`는 수정하지 않습니다. 순위는 점수 내림차순, 등록 시각 오름차순이며 요청·표시 모두 10개로 제한합니다. 익명 인증한 UID의 기록만 등록·최고점 갱신·삭제가 가능하고, 필드·자료형·범위를 규칙으로 검사합니다. 클라이언트 게임이므로 서버에서 플레이를 재현하는 완전한 부정행위 방지는 아닙니다.

2026-09-13에 사용자 승인 후 게시한 전체 규칙은 `firebase/newton-rush.firestore.rules`, 추가한 색인은 `firebase/faraday.indexes.json`입니다. 루트 `firestore.rules`는 별도 사이트 프로젝트용이므로 혼용하지 않습니다. `faraday-firebase-check.cjs`는 새 익명 계정과 임시 패러데이 기록만 사용하고 마지막에 정리하며, 뉴턴 상위 기록의 변경 여부를 비교합니다. 자동 단위/브라우저 검사에서는 `?qa`로 외부 순위 등록을 차단합니다.

소스나 그림 수정 후 `node tools/faraday-register.cjs`를 실행합니다. HTML·이미지·스크립트 캐시와 두 등록 목록을 같이 갱신하고, 놀이 목록에서 잔광 바로 위의 위치를 유지합니다. 애니메이션 영역은 `sprites.json`을 수정한 뒤 등록 도구로 브라우저용 JS에 반영합니다.

`faraday-physics.test.cjs`는 독립적인 자기선속 수치 미분으로 패러데이 법칙을 확인합니다. `faraday-browser.test.cjs`는 Chromium과 WebKit에서 아이템, 실제 예고선 피격, 폭풍, 보스 등장 보호, 다섯 스테이지 전환과 엔딩, 저장 복원, 작은 화면, 입력, 저장·오디오 사용 불가 상황을 검사합니다. 스테이지 전환 검사는 명시적인 테스트 조건을 사용하며 실력이나 난이도 검증과 구분합니다.

`tools/faraday-playtest.cjs`의 이동 속도를 제한한 자동 조작은 실제 난이도에서 장비나 체력을 추가하지 않고 전투를 수행합니다. 먼저 별도 터미널에서 `node tools/faraday-preview.cjs`로 로컬 서버를 시작한 뒤 실행합니다. 결과는 `.preview-tmp/faraday/playtest.json`에 남습니다. `npm test`에는 공통 뷰어 안의 Safari 화면 검사도 포함됩니다. 실제 iPhone 하드웨어 검사는 아닙니다.

대표 이미지는 실제 게임 실행 장면을 `tools/generate-previews.cjs`로 촬영합니다. 수동으로 썸네일을 합성하지 않습니다.
