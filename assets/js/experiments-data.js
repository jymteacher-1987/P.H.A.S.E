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
      "name": "상대성 이론",
      "icon": "🌌",
      "description": "특수 상대성 이론의 시간과 길이를 다룹니다"
    },
    {
      "id": "modern-physics",
      "name": "현대 물리",
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
        "question": "같은 양을 접두어가 다른 단위로 나타내면 수치는 어떻게 달라질까요?",
        "focus": "킬로와 밀리 등 크기가 다른 접두어로 단위를 변환하고, 나타내는 양은 그대로인지 확인해 보세요."
      },
      "path": "experiments/si-prefixes.html?v=992352a412",
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
        "question": "알짜힘에 따라 물체의 운동은 어떻게 달라지고, 두 물체가 주고받는 힘은 어떤 관계일까요?",
        "focus": "제1법칙에서는 알짜힘이 0일 때의 운동을, 제2법칙에서는 알짜힘과 질량을 하나씩 바꾸며 가속도를 살펴보세요. 제3법칙에서는 두 물체가 주고받는 힘의 크기와 방향을 비교해 보세요."
      },
      "path": "experiments/newton-laws.html?v=6743c2c5ae",
      "date": "2026-07-28",
      "tags": [
        "뉴턴",
        "운동 법칙",
        "힘"
      ]
    },
    {
      "id": "newton-prism",
      "title": "뉴턴의 프리즘 실험",
      "category": "waves-optics",
      "description": "프리즘을 통과한 흰빛이 여러 색으로 분산되는 과정을 관찰합니다.",
      "lessonNote": {
        "question": "흰빛을 프리즘으로 나누고, 나뉜 빛을 다시 굴절시키거나 모으면 어떤 색이 나타날까요?",
        "focus": "흰빛이 분산되는 모습을 본 뒤, 한 색으로 보이는 빛을 두 번째 프리즘에 통과시켜 보세요. ‘반원 유리로 모으기’에서는 스크린을 움직여 여러 색의 빛이 겹치는 모습도 확인해 보세요."
      },
      "path": "experiments/newton-prism.html?v=ef12ee3c89",
      "date": "2026-07-28",
      "tags": [
        "프리즘",
        "빛의 분산",
        "뉴턴"
      ]
    },
    {
      "id": "shm-circular-motion",
      "title": "등속 원운동과 단진동",
      "category": "mechanics",
      "description": "등속 원운동과 단진동의 관계를 시뮬레이션으로 비교합니다.",
      "lessonNote": {
        "question": "등속 원운동하는 공에 평행 광선을 비추면, 그림자는 어떻게 움직일까요?",
        "focus": "평행 광선을 켜고 ‘같이 출발’을 눌러, 공의 그림자와 용수철에 매단 추가 같은 주기로 함께 움직이는지 비교해 보세요."
      },
      "path": "experiments/shm-circular-motion.html?v=e49ae22f1d",
      "date": "2026-07-28",
      "tags": [
        "단진동",
        "원운동",
        "주기 운동"
      ]
    },
    {
      "id": "rocket-motion",
      "title": "로켓 운동 비교 — 질량 고정 vs 질량 변화",
      "category": "mechanics",
      "description": "실제 로켓처럼 연료 분사로 질량이 줄어드는 경우와, 질량을 일정하게 가정한 경우의 운동을 비교합니다.",
      "lessonNote": {
        "question": "같은 추력으로 추진할 때, 질량이 줄어드는 로켓의 가속도는 어떻게 달라질까요?",
        "focus": "두 로켓의 질량과 가속도를 비교하고, 속도–시간 그래프에서 속도 차이가 어떻게 달라지는지 살펴보세요."
      },
      "path": "experiments/rocket-motion.html?v=d37b71ad5b",
      "date": "2026-07-28",
      "tags": [
        "로켓",
        "운동량",
        "질량 변화"
      ]
    },
    {
      "id": "motion-analysis",
      "title": "물체 운동 분석 실험실",
      "category": "mechanics",
      "description": "물체의 위치를 기록하고 그래프로 속도와 가속도를 분석합니다.",
      "lessonNote": {
        "question": "같은 시간 간격으로 위치를 기록하면 운동의 차이가 어떻게 드러날까요?",
        "focus": "용수철에 밀려 나온 뒤 일정한 속도로 움직이는 구간과, 바닥에 닿기 전의 자유 낙하 구간을 골라 위치-시간 그래프를 비교해 보세요."
      },
      "path": "experiments/motion-analysis.html?v=02f5f6aeb2",
      "date": "2026-07-28",
      "tags": [
        "운동 분석",
        "그래프",
        "속도"
      ]
    },
    {
      "id": "generator-principle",
      "title": "발전기의 원리 — 교류 발전 시뮬레이션",
      "category": "electromagnetism",
      "description": "코일과 자석의 상대 운동으로 교류가 발생하는 원리를 코일의 회전 속도를 바꾸며 확인합니다.",
      "lessonNote": {
        "question": "코일을 더 빠르게 돌리면 유도 전류는 어떻게 달라질까요?",
        "focus": "회전 속도를 바꾸며 전구의 밝기와 검류계의 움직임을 비교해 보세요."
      },
      "path": "experiments/generator-principle.html?v=2e7a078941",
      "date": "2026-07-28",
      "tags": [
        "발전기",
        "교류",
        "전자기 유도"
      ]
    },
    {
      "id": "convex-lens-focus",
      "title": "볼록 렌즈 초점 거리 찾기",
      "category": "waves-optics",
      "description": "광원과 스크린을 움직이며 볼록 렌즈의 초점 거리를 찾습니다.",
      "lessonNote": {
        "question": "광원과 스크린의 위치를 재면 렌즈의 초점 거리를 알아낼 수 있을까요?",
        "focus": "먼 물체의 상으로 초점 거리를 어림해 보세요. 광원 위치를 고정하고 스크린만 움직여 선명한 상의 위치를 기록하세요. 여러 광원 위치에서 측정을 반복하고, 그래프로 초점 거리를 구해 보세요."
      },
      "path": "experiments/convex-lens-focus.html?v=da72e9ac7f",
      "date": "2026-07-28",
      "tags": [
        "볼록렌즈",
        "초점거리",
        "상"
      ]
    },
    {
      "id": "rgb-cmy-light",
      "title": "빛과 물감의 삼원색",
      "category": "waves-optics",
      "description": "빛의 삼원색(RGB)과 색의 삼원색(CMY)의 혼합 원리를 비교합니다.",
      "lessonNote": {
        "question": "여러 색을 섞을 때 빛과 물감은 왜 서로 다른 결과를 낼까요?",
        "focus": "RGB와 CMY 슬라이더를 각각 움직여, 색을 섞을수록 밝아지는지 어두워지는지 비교해 보세요."
      },
      "path": "experiments/rgb-cmy-light.html?v=f8e3ba79e3",
      "date": "2026-07-28",
      "tags": [
        "빛의 삼원색",
        "색의 삼원색",
        "RGB",
        "CMY"
      ]
    },
    {
      "id": "momentum-conservation",
      "title": "일차원 충돌과 운동량 보존",
      "category": "mechanics",
      "description": "일차원 충돌에서 두 물체의 전체 운동량이 보존되는지 확인합니다.",
      "lessonNote": {
        "question": "충돌 전과 후에 두 물체의 운동량을 더한 값은 어떻게 될까요?",
        "focus": "운동 방향(+, −)을 생각하며, 충돌 전후에 각 물체의 운동량과 두 물체의 전체 운동량을 비교해 보세요."
      },
      "path": "experiments/momentum-conservation.html?v=3cff73064e",
      "date": "2026-07-28",
      "tags": [
        "운동량 보존",
        "충돌",
        "역학"
      ]
    },
    {
      "id": "free-fall-projectile",
      "title": "자유 낙하 vs 수평으로 던진 물체 비교 실험",
      "category": "mechanics",
      "description": "자유 낙하와 수평으로 던진 물체의 운동을 비교합니다.",
      "lessonNote": {
        "question": "같은 높이에서 동시에 출발하면, 수평으로 던진 물체와 가만히 놓은 물체 중 어느 쪽이 먼저 바닥에 닿을까요?",
        "focus": "수평 방향의 운동이 달라도 연직 방향의 위치 변화는 같은지 살펴보세요."
      },
      "path": "experiments/free-fall-projectile.html?v=6c086715f6",
      "date": "2026-07-28",
      "tags": [
        "자유 낙하",
        "포물선 운동"
      ]
    },
    {
      "id": "resistor-series-parallel",
      "title": "저항의 직렬·병렬연결에서 전류와 전압 측정하기",
      "category": "electromagnetism",
      "description": "저항을 직렬·병렬로 연결하고 각 저항에 흐르는 전류와 양단의 전압을 측정합니다.",
      "lessonNote": {
        "question": "저항을 직렬과 병렬로 연결할 때, 각 저항의 전류와 전압은 어떻게 달라질까요?",
        "focus": "직렬에서는 전류가 같고 각 저항의 전압을 더하면 전체 전압이 되는지, 병렬에서는 전압이 같고 각 가지의 전류를 더하면 전체 전류가 되는지 확인해 보세요."
      },
      "path": "experiments/resistor-series-parallel.html?v=9a6603e886",
      "date": "2026-07-28",
      "tags": [
        "저항",
        "직렬",
        "병렬",
        "옴의 법칙"
      ]
    },
    {
      "id": "electromagnetic-induction",
      "title": "전자기 유도 탐구: 코일, 자석, 상대 운동",
      "category": "electromagnetism",
      "description": "코일과 자석의 상대 운동에 따른 전자기 유도 현상을 탐구합니다.",
      "lessonNote": {
        "question": "어떤 조건에서 유도 전류가 생기며, 전류의 방향과 세기는 어떻게 달라질까요?",
        "focus": "다른 조건은 일정하게 두고, 자석과 코일의 운동 방식·자석의 극·자석의 세기·코일의 길이·감은 수를 하나씩 바꿔 보세요. ‘둘 다 같은 방향’을 골라 간격을 유지한 채 함께 움직이는 경우도 비교해, 자기선속의 변화와 전류의 관계를 살펴보세요."
      },
      "path": "experiments/electromagnetic-induction.html?v=addcd78d61",
      "date": "2026-07-28",
      "tags": [
        "전자기 유도",
        "코일",
        "자석"
      ]
    },
    {
      "id": "pn-junction",
      "title": "p-n 접합 반도체 시뮬레이션",
      "category": "modern-physics",
      "description": "p형과 n형 반도체가 만나 만들어지는 공핍층을 관찰하고, 순방향·역방향 바이어스에서 전자와 양공의 움직임, 에너지띠와 전위 분포가 어떻게 달라지는지 확인합니다.",
      "lessonNote": {
        "question": "p-n 접합에 거는 전압의 방향을 바꾸면 전류의 흐름은 어떻게 달라질까요?",
        "focus": "‘p-n 접합’과 ‘p-n 접합 실행’을 차례로 선택한 뒤, 순방향과 역방향에서 공핍층과 전자·양공의 움직임을 비교해 보세요."
      },
      "path": "experiments/pn-junction.html?v=954b264876",
      "date": "2026-09-13",
      "tags": [
        "반도체",
        "p-n 접합",
        "다이오드",
        "공핍층"
      ]
    },
    {
      "id": "proper-time-length",
      "title": "특수 상대성 이론: 고유 시간과 고유 길이",
      "category": "relativity",
      "description": "행성 관찰자와 로켓 관찰자의 관점을 오가며 고유 시간·고유 길이·시간 팽창·길이 수축을 비교합니다.",
      "lessonNote": {
        "question": "로켓이 두 행성을 차례로 통과하는 시간 간격과 두 행성 사이의 거리는 관찰자에 따라 어떻게 달라질까요?",
        "focus": "각 기준틀에서 두 통과 사건 사이의 시간 간격, 그리고 같은 시각에 잰 두 행성 사이의 거리를 비교해 보세요."
      },
      "path": "experiments/proper-time-length.html?v=7ad53dd5a9",
      "date": "2026-07-31",
      "tags": [
        "특수 상대성",
        "고유 시간",
        "고유 길이",
        "길이 수축"
      ]
    },
    {
      "id": "ideal-gas-law",
      "title": "이상 기체 방정식",
      "category": "thermal",
      "description": "보일 법칙·샤를 법칙·아보가드로 법칙을 단계별 가상 실험으로 확인하고 이상 기체 방정식 PV = nRT로 종합합니다.",
      "lessonNote": {
        "question": "기체의 압력, 부피, 온도, 물질량 사이에는 어떤 관계가 있을까요?",
        "focus": "각 단계에서 일정하게 유지되는 변인을 확인하고, 나머지 두 변인 사이의 관계를 알아보세요. 세 실험의 기록을 모아 PV = nRT가 성립하는지 확인해 보세요."
      },
      "path": "experiments/ideal-gas-law.html?v=f33d93bb22",
      "date": "2026-08-01",
      "tags": [
        "이상 기체",
        "보일 법칙",
        "샤를 법칙",
        "기체 상수"
      ]
    },
    {
      "id": "simultaneity-relativity",
      "title": "동시성의 상대성 — 번개와 두 관찰자",
      "category": "relativity",
      "description": "달리는 기차 양 끝에 친 번개를 지면과 기차의 기준틀에서 비교하며 동시성이 상대적임을 확인합니다.",
      "lessonNote": {
        "question": "지면에서 동시에 친 두 번개는 기차에서도 동시에 친 것일까요?",
        "focus": "두 관점에서 번개가 친 시각과 빛이 관찰자에게 도착한 시각을 구분해 보세요."
      },
      "path": "experiments/simultaneity-relativity.html?v=138e3c08fa",
      "date": "2026-08-01",
      "tags": [
        "특수 상대성",
        "동시성",
        "관찰자",
        "사고 실험"
      ]
    },
    {
      "id": "pascal-hydraulic",
      "title": "유압 장치와 파스칼 법칙",
      "category": "mechanics",
      "description": "작은 피스톤을 눌러 무거운 물체를 들어 올리며, 압력이 그대로 전달되어 힘은 커지지만 일은 그대로임을 확인합니다.",
      "lessonNote": {
        "question": "작은 피스톤을 눌러 무거운 물체를 들어 올릴 수 있는 까닭은 무엇일까요?",
        "focus": "피스톤의 지름을 바꾸며 필요한 힘과 두 피스톤이 움직인 거리를 함께 비교해 보세요."
      },
      "path": "experiments/pascal-hydraulic.html?v=3435568476",
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
      "title": "러더퍼드 산란 실험 — 톰슨 원자 모형과의 비교",
      "category": "modern-physics",
      "description": "같은 알파 입자를 톰슨 원자 모형과 러더퍼드 원자 모형에 동시에 쏘아 궤적을 비교합니다. 핵을 겨눠 크게 튕겨 나오는 경우를 만들어 보고, 대부분의 알파 입자는 거의 휘지 않고 통과한다는 사실도 함께 확인합니다.",
      "lessonNote": {
        "question": "알파 입자 대부분은 거의 그대로 지나가는데, 일부는 왜 크게 휘어질까요?",
        "focus": "같은 조건으로 쏜 알파 입자의 궤적을 톰슨 원자 모형과 러더퍼드 원자 모형에서 비교해 보세요."
      },
      "path": "experiments/rutherford-scattering.html?v=b163c377ca",
      "date": "2026-08-20",
      "tags": [
        "러더퍼드",
        "원자 모형",
        "알파 입자",
        "원자핵"
      ]
    },
    {
      "id": "bernoulli-principle",
      "title": "베르누이 정리",
      "category": "mechanics",
      "description": "압력과 운동 에너지 항의 합(P + ½ρv²)이 일정할 때, 관을 따라 흐르는 공기의 속력이 커지면 압력이 낮아지는 베르누이 정리를 분자의 움직임과 함께 관찰합니다.",
      "lessonNote": {
        "question": "같은 관을 따라 흐르는 공기의 속력이 커지면, 압력은 어떻게 달라질까요?",
        "focus": "빨라진 정도를 바꾸며 속력과 압력 값을 읽고, 분자가 벽에 부딪히는 횟수와 세기가 어떻게 달라지는지도 살펴보세요."
      },
      "path": "experiments/bernoulli-principle.html?v=0e87d64ef0",
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
      "description": "빛의 파장과 세기, 전압을 바꾸며 광전자의 운동을 관찰합니다. 일함수와 한계 진동수, 최대 운동 에너지, 광전류와 정지 전압의 관계를 탐구합니다.",
      "lessonNote": {
        "question": "광전자는 어떤 조건에서 방출되며, 방출된 광전자의 에너지와 광전류는 무엇에 따라 달라질까요?",
        "focus": "빛의 파장을 일정하게 두고 빛의 세기만 바꿔 보세요. 이어서 빛의 세기 슬라이더는 그대로 두고 파장만 바꿔 보세요. 방출 여부·최대 운동 에너지·광전류를 비교하고, 금속별 한계 진동수(한계 파장)와 광전류가 0이 되는 정지 전압도 찾아보세요."
      },
      "path": "experiments/photoelectric-effect.html?v=c0af511cc8",
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
      "description": "실험실을 돌며 고른 물리 원리로 나만의 과학 히어로를 설계하고, 사진을 찍어 히어로 포스터까지 완성하는 활동입니다.",
      "path": "plays/hero-maker.html?v=55f9c27778",
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
      "description": "뉴턴과 함께 다섯 세계를 달리며 프리즘 보석을 모아보세요. 점프와 슬라이드로 장애물을 피하고, 배경 속 과학 이야기를 만나며 모두의 TOP10 기록에 도전하는 게임입니다.",
      "path": "plays/newton-rush.html?v=ae3db4ea28",
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
      "description": "뉴턴·아인슈타인·호킹·하위헌스 등 물리학자 8인의 공식 필살기 대전! 손발 콤보와 전용 기술로 평평 지구 교주를 이기고, 캐릭터별 논문 강의 엔딩을 만나보세요. 키보드와 모바일 조이스틱을 지원합니다.",
      "path": "plays/physics-fighter.html?v=114608d156",
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
      "description": "뉴턴과 함께 탐험하고 보스를 상대하며 갈릴레오·데카르트·하위헌스의 연구를 만나보세요. 네 가지 실험을 관찰하고 기록을 모아 세 운동 법칙을 정리하는 횡스크롤 액션 게임입니다.",
      "path": "plays/giants-shoulders.html?v=1c160c0045",
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
      "description": "코일과 자석으로 비행기를 강화하고, 축전기의 스파크 폭풍으로 돌파하세요. 패러데이의 삶에서 만난 다섯 어려움이 다섯 보스로 등장하는 비행 슈팅. 자동 공격, 모바일 드래그 조작, 이어하기와 작은 발명 노트를 지원합니다.",
      "path": "plays/faraday-flight.html?v=5241bca8a6",
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
      "description": "빛이 끊긴 도시의 마지막 신호를 복구하세요. 거울·편광판·간섭계를 직접 조작하는 4막 16개 구역의 SF 퍼즐 어드벤처. 자동 저장, 단계별 힌트, 별 기록과 오늘의 회선 도전을 지원합니다.",
      "path": "plays/afterlight.html?v=d22fbe62e2",
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
      "description": "도형을 직접 그리고 지우며 한붓그리기 가능 여부를 O/X로 예측하는 과학·수학 놀이입니다. 서로 다른 20문제를 마치면 채점과 홀수점 원리, 실제 한붓 경로를 확인할 수 있습니다.",
      "path": "plays/hanbut.html?v=f5768f4ade",
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
      "description": "뽁뽁이, 말랑이, 팝잇처럼 손으로 조물조물 만지는 장난감을 모아 둔 놀이터입니다. 누르고 당기고 터뜨리며 색 도감을 채워보세요.",
      "path": "plays/jjomuldak-factory.html?v=263c520870",
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
      "description": "학교·해적선·우주정거장·저택·신전·금지구역, 여섯 이야기 속 단서를 연결해 마지막 문을 여는 3D 방탈출 게임입니다. 테마별 힌트와 PC·모바일 조작을 지원합니다.",
      "path": "plays/bamti-escape.html?v=0cba343b14",
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
