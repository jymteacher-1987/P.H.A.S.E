window.EXPERIMENTS_DATA = {
  "categories": [
    {
      "id": "fundamentals",
      "name": "과학의 기초",
      "icon": "📐",
      "description": "단위와 측정 등 통합과학 기초 개념"
    },
    {
      "id": "mechanics",
      "name": "역학과 에너지",
      "icon": "🚀",
      "description": "물체의 운동과 힘을 다룹니다"
    },
    {
      "id": "thermal",
      "name": "열",
      "icon": "🌡️",
      "description": "열과 에너지 전환을 다룹니다"
    },
    {
      "id": "waves-optics",
      "name": "파동 및 광학",
      "icon": "🌈",
      "description": "빛의 파동성, 렌즈, 색을 다룹니다"
    },
    {
      "id": "electromagnetism",
      "name": "전자기학",
      "icon": "⚡",
      "description": "전류, 저항, 전자기 유도를 다룹니다"
    },
    {
      "id": "relativity",
      "name": "상대성이론",
      "icon": "🌌",
      "description": "특수·일반 상대성이론"
    },
    {
      "id": "modern-physics",
      "name": "현대물리",
      "icon": "⚛️",
      "description": "양자역학 등 현대물리 개념"
    }
  ],
  "experiments": [
    {
      "id": "si-prefixes",
      "title": "SI 단위 접두어 탐험",
      "category": "fundamentals",
      "description": "SI 단위와 접두어의 크기를 비교하고 단위 변환을 연습합니다.",
      "lessonNote": {
        "question": "같은 양을 다른 SI 접두어로 나타내면 숫자는 어떻게 달라질까요?",
        "focus": "킬로와 밀리 등 크기가 다른 접두어로 단위를 변환하고, 나타내는 양은 그대로인지 확인해 보세요."
      },
      "path": "experiments/si-prefixes.html?v=4605f35aa8",
      "date": "2026-07-28",
      "tags": [
        "단위",
        "측정",
        "통합과학"
      ]
    },
    {
      "id": "newton-laws",
      "title": "뉴턴 운동 법칙 시뮬레이터",
      "category": "mechanics",
      "description": "힘과 질량, 마찰 조건을 바꾸며 뉴턴의 세 운동 법칙을 확인합니다.",
      "lessonNote": {
        "question": "같은 힘으로 밀어도 물체의 질량이 다르면 움직임은 어떻게 달라질까요?",
        "focus": "제2법칙에서 힘은 그대로 두고 질량만 바꿔, 가속도의 변화를 살펴보세요."
      },
      "path": "experiments/newton-laws.html?v=802cd7b806",
      "date": "2026-07-28",
      "tags": [
        "뉴턴",
        "운동법칙",
        "힘"
      ]
    },
    {
      "id": "newton-prism",
      "title": "뉴턴의 프리즘 실험",
      "category": "waves-optics",
      "description": "프리즘을 통과한 빛이 분산되는 과정을 가상 실험실에서 재현합니다.",
      "lessonNote": {
        "question": "흰빛이 프리즘을 지나면 왜 여러 색으로 나뉠까요?",
        "focus": "색에 따라 빛이 꺾이는 정도가 어떻게 다른지 살펴보세요."
      },
      "path": "experiments/newton-prism.html?v=51324ce1cf",
      "date": "2026-07-28",
      "tags": [
        "프리즘",
        "빛의 분산",
        "뉴턴"
      ]
    },
    {
      "id": "shm-circular-motion",
      "title": "원운동과 단진동",
      "category": "mechanics",
      "description": "원운동과 단진동의 관계를 시뮬레이션으로 비교합니다.",
      "lessonNote": {
        "question": "원운동하는 공의 그림자는 어떤 움직임을 할까요?",
        "focus": "평행광선을 켜고 그림자와 용수철 추를 함께 출발시켜, 두 움직임의 주기를 비교해 보세요."
      },
      "path": "experiments/shm-circular-motion.html?v=0b9c5753bc",
      "date": "2026-07-28",
      "tags": [
        "단진동",
        "원운동",
        "주기운동"
      ]
    },
    {
      "id": "rocket-motion",
      "title": "로켓 운동 비교 — 질량 고정 vs 질량 변화",
      "category": "mechanics",
      "description": "연료 소모로 가벼워지는 로켓과 질량이 일정한 로켓의 운동을 비교합니다.",
      "lessonNote": {
        "question": "같은 추력으로 날아갈 때, 연료를 쓰며 가벼워지는 로켓의 가속도는 어떻게 달라질까요?",
        "focus": "연료가 줄어드는 동안 두 로켓의 질량과 가속도, 속도 그래프를 함께 비교해 보세요."
      },
      "path": "experiments/rocket-motion.html?v=fc3d55283a",
      "date": "2026-07-28",
      "tags": [
        "로켓",
        "운동량",
        "질량변화"
      ]
    },
    {
      "id": "motion-analysis",
      "title": "물체 운동 분석 실험실",
      "category": "mechanics",
      "description": "물체의 위치를 기록하고 그래프로 속도와 가속도를 분석합니다.",
      "lessonNote": {
        "question": "같은 시간 간격으로 위치를 기록하면 운동의 차이가 어떻게 드러날까요?",
        "focus": "등속 운동과 자유 낙하를 추적하고, 두 운동의 위치-시간 그래프 모양을 비교해 보세요."
      },
      "path": "experiments/motion-analysis.html?v=8cdf2df379",
      "date": "2026-07-28",
      "tags": [
        "운동분석",
        "그래프",
        "속도"
      ]
    },
    {
      "id": "generator-principle",
      "title": "발전기의 원리 — 교류 발전 시뮬레이션",
      "category": "electromagnetism",
      "description": "코일의 회전 속도를 바꾸며 교류가 생기는 원리를 확인합니다.",
      "lessonNote": {
        "question": "코일을 더 빠르게 돌리면 유도 전류는 어떻게 달라질까요?",
        "focus": "회전 속도를 바꾸며 전구의 밝기와 검류계의 움직임을 비교해 보세요."
      },
      "path": "experiments/generator-principle.html?v=047f1fb9f4",
      "date": "2026-07-28",
      "tags": [
        "발전기",
        "교류",
        "전자기유도"
      ]
    },
    {
      "id": "convex-lens-focus",
      "title": "볼록 렌즈 초점 거리 찾기 실험",
      "category": "waves-optics",
      "description": "광원과 스크린을 움직이며 볼록 렌즈의 초점 거리를 찾습니다.",
      "lessonNote": {
        "question": "광원과 스크린의 위치를 재면 렌즈의 초점 거리를 알아낼 수 있을까요?",
        "focus": "광원을 옮겨 선명한 상이 맺히는 위치를 기록하고, 그래프에서 초점 거리를 찾아보세요."
      },
      "path": "experiments/convex-lens-focus.html?v=92bf9be22f",
      "date": "2026-07-28",
      "tags": [
        "볼록렌즈",
        "초점거리",
        "상"
      ]
    },
    {
      "id": "rgb-cmy-light",
      "title": "빛의 3원색 vs 색의 3원색(물감)",
      "category": "waves-optics",
      "description": "빛의 3원색(RGB)과 색의 3원색(CMY)의 혼합 원리를 비교합니다.",
      "lessonNote": {
        "question": "여러 색을 섞을 때 빛과 물감은 왜 서로 다른 결과를 낼까요?",
        "focus": "RGB와 CMY 슬라이더를 각각 움직여, 색을 섞을수록 밝아지는지 어두워지는지 비교해 보세요."
      },
      "path": "experiments/rgb-cmy-light.html?v=0d74b4cdad",
      "date": "2026-07-28",
      "tags": [
        "빛의 3원색",
        "색의 3원색",
        "RGB",
        "CMY"
      ]
    },
    {
      "id": "momentum-conservation",
      "title": "일차원 충돌에서 운동량 보존 확인하기",
      "category": "mechanics",
      "description": "1차원 충돌 상황을 통해 운동량 보존 법칙을 확인합니다.",
      "lessonNote": {
        "question": "충돌 전후에 두 물체의 운동량을 더하면 값이 어떻게 달라질까요?",
        "focus": "각 물체의 운동량과 전체 운동량을 나누어 비교해 보세요."
      },
      "path": "experiments/momentum-conservation.html?v=48a223459b",
      "date": "2026-07-28",
      "tags": [
        "운동량 보존",
        "충돌",
        "역학"
      ]
    },
    {
      "id": "free-fall-projectile",
      "title": "자유낙하 vs 수평 투사 비교 실험",
      "category": "mechanics",
      "description": "자유낙하와 수평으로 던진 물체의 운동을 비교합니다.",
      "lessonNote": {
        "question": "같은 높이에서 동시에 출발하면, 수평으로 던진 물체와 놓아준 물체 중 어느 쪽이 먼저 바닥에 닿을까요?",
        "focus": "가로 방향의 움직임이 달라도 세로 방향의 위치 변화는 같은지 살펴보세요."
      },
      "path": "experiments/free-fall-projectile.html?v=bea5d1ffdb",
      "date": "2026-07-28",
      "tags": [
        "자유낙하",
        "수평투사",
        "포물선운동"
      ]
    },
    {
      "id": "resistor-series-parallel",
      "title": "저항의 직렬·병렬연결에서 전류와 전압 측정하기",
      "category": "electromagnetism",
      "description": "저항을 직렬·병렬로 연결하고 각 지점의 전류와 전압을 측정합니다.",
      "lessonNote": {
        "question": "저항을 직렬과 병렬로 연결할 때, 각 저항의 전류와 전압은 어떻게 달라질까요?",
        "focus": "직렬에서 전류가 어디서나 같은지, 병렬에서 각 가지에 걸리는 전압이 같은지 확인해 보세요."
      },
      "path": "experiments/resistor-series-parallel.html?v=b8bb272762",
      "date": "2026-07-28",
      "tags": [
        "저항",
        "직렬",
        "병렬",
        "옴의법칙"
      ]
    },
    {
      "id": "electromagnetic-induction",
      "title": "전자기 유도 탐구: 코일, 자석, 상대운동",
      "category": "electromagnetism",
      "description": "코일과 자석의 상대 운동에 따른 전자기 유도 현상을 탐구합니다.",
      "lessonNote": {
        "question": "자석과 코일을 같은 방향·같은 속력으로 움직이면 전구는 켜질까요?",
        "focus": "자석만 움직일 때와 둘을 같은 속력으로 움직일 때를 비교해 보세요."
      },
      "path": "experiments/electromagnetic-induction.html?v=701a8f86ef",
      "date": "2026-07-28",
      "tags": [
        "전자기유도",
        "코일",
        "자석"
      ]
    },
    {
      "id": "pn-junction",
      "title": "PN 접합 반도체 시뮬레이션",
      "category": "modern-physics",
      "description": "전압 방향에 따라 PN 접합의 공핍층과 전자·양공의 움직임이 어떻게 달라지는지 확인합니다.",
      "lessonNote": {
        "question": "PN 접합에 거는 전압의 방향을 바꾸면 전류의 흐름은 어떻게 달라질까요?",
        "focus": "순방향과 역방향을 번갈아 살펴보며 공핍층과 전자·양공의 움직임을 비교해 보세요."
      },
      "path": "experiments/pn-junction.html?v=44466e2951",
      "date": "2026-09-13",
      "tags": [
        "반도체",
        "PN 접합",
        "다이오드",
        "공핍층"
      ]
    },
    {
      "id": "proper-time-length",
      "title": "특수 상대성 이론: 고유시간과 고유길이",
      "category": "relativity",
      "description": "행성 관찰자와 로켓 관찰자의 관점을 오가며 고유시간·고유길이·시간 팽창·길이 수축을 비교합니다.",
      "lessonNote": {
        "question": "행성 기준과 로켓 기준에서 두 사건 사이의 시간과 거리는 같을까요?",
        "focus": "관찰자를 바꾸고 로켓의 속도를 높이며, 두 기준에서 측정한 시간과 길이를 비교해 보세요."
      },
      "path": "experiments/proper-time-length.html?v=660bd1c486",
      "date": "2026-07-31",
      "tags": [
        "특수상대성",
        "고유시간",
        "고유길이",
        "길이수축"
      ]
    },
    {
      "id": "ideal-gas-law",
      "title": "이상 기체 상태방정식",
      "category": "thermal",
      "description": "압력·부피·온도·기체의 양을 바꾸며 기체 법칙과 상태방정식을 확인합니다.",
      "lessonNote": {
        "question": "기체의 양과 온도를 그대로 두고 부피를 줄이면 압력은 어떻게 될까요?",
        "focus": "한 번에 한 조건만 바꾸며 압력과 부피의 관계를 확인해 보세요."
      },
      "path": "experiments/ideal-gas-law.html?v=ae6ee73812",
      "date": "2026-08-01",
      "tags": [
        "이상기체",
        "보일 법칙",
        "샤를 법칙",
        "기체 상수"
      ]
    },
    {
      "id": "simultaneity-relativity",
      "title": "동시성의 상대성 — 번개와 두 관찰자",
      "category": "relativity",
      "description": "달리는 기차 양 끝에 친 번개를 지면 관찰자와 기차 관찰자의 눈으로 비교하며 동시성이 상대적임을 확인합니다.",
      "lessonNote": {
        "question": "지면에서 동시에 친 두 번개는 기차에서도 동시에 친 것일까요?",
        "focus": "두 관점에서 번개가 친 시각과 빛이 관찰자에게 도착한 시각을 구분해 보세요."
      },
      "path": "experiments/simultaneity-relativity.html?v=bf7fc1cb57",
      "date": "2026-08-01",
      "tags": [
        "특수상대성",
        "동시성",
        "관찰자",
        "사고실험"
      ]
    },
    {
      "id": "pascal-hydraulic",
      "title": "유압 장치와 파스칼 법칙",
      "category": "mechanics",
      "description": "작은 피스톤으로 무거운 물체를 들어 올리며 힘과 이동 거리의 관계를 확인합니다.",
      "lessonNote": {
        "question": "작은 피스톤을 눌러 무거운 물체를 들어 올릴 수 있는 까닭은 무엇일까요?",
        "focus": "피스톤의 지름을 바꾸며 필요한 힘과 두 피스톤이 움직인 거리를 함께 비교해 보세요."
      },
      "path": "experiments/pascal-hydraulic.html?v=4adbb69e2a",
      "date": "2026-08-07",
      "tags": [
        "파스칼 법칙",
        "압력",
        "유압 장치",
        "일의 원리"
      ]
    },
    {
      "id": "rutherford-scattering",
      "title": "러더퍼드 산란 실험 — 톰슨 모형과의 비교",
      "category": "modern-physics",
      "description": "톰슨 모형과 원자핵 모형에서 알파입자의 궤적을 비교하고 큰 각도 산란을 확인합니다.",
      "lessonNote": {
        "question": "알파입자 대부분은 지나가는데, 일부는 왜 크게 꺾일까요?",
        "focus": "같은 입자의 궤적을 톰슨 모형과 원자핵 모형에서 비교해 보세요."
      },
      "path": "experiments/rutherford-scattering.html?v=c08f80d75a",
      "date": "2026-08-20",
      "tags": [
        "러더퍼드",
        "원자 모형",
        "알파입자",
        "원자핵"
      ]
    },
    {
      "id": "bernoulli-principle",
      "title": "베르누이의 원리",
      "category": "mechanics",
      "description": "전체압력이 일정할 때 속력이 커지면 압력이 낮아지는 베르누이 원리를 관찰합니다.",
      "lessonNote": {
        "question": "전체 압력이 일정할 때, 공기가 빨라지면 압력은 어떻게 변할까요?",
        "focus": "빨라진 정도를 바꾸며 속력과 압력 값을 읽고, 두 값의 관계를 확인해 보세요."
      },
      "path": "experiments/bernoulli-principle.html?v=e9803bf220",
      "date": "2026-09-09",
      "tags": [
        "베르누이",
        "유체",
        "압력",
        "에너지 보존"
      ]
    },
    {
      "id": "photoelectric-effect",
      "title": "광전효과 원리 이해하기",
      "category": "modern-physics",
      "description": "빛의 파장과 광자 수, 전압을 바꾸며 광전자의 방출과 에너지 변화를 관찰합니다.",
      "lessonNote": {
        "question": "빛을 더 강하게 하는 것과 파장을 짧게 하는 것은 광전자에 어떤 차이를 만들까요?",
        "focus": "전자 방출 여부를 먼저 확인한 뒤, 광전자의 수와 최대 운동 에너지를 따로 비교해 보세요."
      },
      "path": "experiments/photoelectric-effect.html?v=89c3adc29d",
      "date": "2026-09-13",
      "tags": [
        "광전효과",
        "광자",
        "일함수",
        "정지 전압",
        "빛의 입자성"
      ]
    }
  ],
  "plays": [
    {
      "id": "hero-maker",
      "title": "히어로 만들기",
      "icon": "🛡️",
      "description": "물리 원리로 나만의 히어로를 만들고 포스터를 완성합니다.",
      "path": "plays/hero-maker.html?v=82b0122034",
      "date": "2026-09-02",
      "tags": [
        "히어로",
        "과학 놀이",
        "설계",
        "포스터"
      ]
    },
    {
      "id": "newton-rush",
      "title": "뉴턴 러시",
      "icon": "💎",
      "description": "뉴턴과 다섯 세계를 달리며 과학 이야기를 만나고 기록에 도전합니다.",
      "path": "plays/newton-rush.html?v=07c82a7179",
      "date": "2026-09-08",
      "tags": [
        "뉴턴",
        "달리기",
        "프리즘",
        "과학 놀이",
        "랭킹"
      ]
    },
    {
      "id": "physics-fighter",
      "title": "물리학자 대전",
      "icon": "🥊",
      "description": "물리학자 8인의 기술로 대전하고 캐릭터별 이야기를 만납니다.",
      "path": "plays/physics-fighter.html?v=36c86d4102",
      "date": "2026-09-09",
      "tags": [
        "물리학자",
        "격투",
        "공식",
        "하위헌스",
        "과학 놀이"
      ]
    },
    {
      "id": "giants-shoulders",
      "title": "거인의 어깨: 프린키피아의 탄생",
      "icon": "🍎",
      "description": "과학자들의 연구를 만나고 네 가지 실험으로 운동 법칙을 탐험합니다.",
      "path": "plays/giants-shoulders.html?v=a11ed2bd6d",
      "date": "2026-09-11",
      "tags": [
        "뉴턴",
        "과학사",
        "갈릴레오",
        "데카르트",
        "하위헌스",
        "운동 법칙",
        "과학 놀이"
      ]
    },
    {
      "id": "faraday-flight",
      "title": "패러데이: 스파크 항해",
      "icon": "⚡",
      "description": "패러데이의 이야기를 따라 비행하며 코일·자석·축전기로 비행기를 강화합니다.",
      "path": "plays/faraday-flight.html?v=4d36319a44",
      "date": "2026-09-13",
      "tags": [
        "전자기 유도",
        "패러데이",
        "슈팅",
        "보스전",
        "과학 놀이"
      ]
    },
    {
      "id": "afterlight",
      "title": "잔광: 마지막 신호",
      "icon": "🌌",
      "description": "거울·편광판·간섭계를 조작해 빛이 끊긴 도시의 신호를 복구합니다.",
      "path": "plays/afterlight.html?v=327baf9834",
      "date": "2026-09-12",
      "tags": [
        "빛",
        "반사",
        "편광",
        "간섭",
        "퍼즐",
        "스토리",
        "과학 놀이"
      ]
    },
    {
      "id": "hanbut",
      "title": "한붓 실험실",
      "icon": "✏️",
      "description": "도형을 그려 한붓그리기 가능 여부를 예측하고 원리를 확인합니다.",
      "path": "plays/hanbut.html?v=5e0a29bcda",
      "date": "2026-09-09",
      "tags": [
        "한붓그리기",
        "과학 놀이",
        "수학",
        "오일러 경로",
        "규칙 찾기"
      ]
    },
    {
      "id": "jjomuldak-factory",
      "title": "쪼물딱 공장",
      "icon": "🫧",
      "description": "말랑이와 팝잇을 누르고 당기며 색 도감을 채웁니다.",
      "path": "plays/jjomuldak-factory.html?v=379cb557ea",
      "date": "2026-09-05",
      "tags": [
        "뽁뽁이",
        "말랑이",
        "팝잇",
        "과학 놀이",
        "촉각"
      ]
    },
    {
      "id": "bamti-escape",
      "title": "밤티 방탈출 게임",
      "icon": "🔓",
      "description": "여섯 이야기 속 단서를 연결해 마지막 문을 여는 3D 방탈출을 즐깁니다.",
      "path": "plays/bamti-escape.html?v=73ef4110bd",
      "date": "2026-09-12",
      "tags": [
        "밤티",
        "방탈출",
        "퍼즐",
        "추리",
        "탐험"
      ]
    }
  ]
};
