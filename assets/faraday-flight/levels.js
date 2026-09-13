(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FaradayLevels = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const levels = [
    {
      name: "책방 골목",
      zone: "배움의 첫 페이지",
      chapter: [
        "런던의 작은 책방. 어린 패러데이는 넉넉하지 않은 집안에서 자라 책을 묶는 제본 일을 배웠어요.",
        "손에 들어온 과학책을 읽고, 직접 작은 실험도 해 보았지요.",
        "책장을 넘길 때마다 세상을 향한 궁금증이 자라났어요.",
      ],
      enemyArt: "foes-books",
      duration: 37,
      palette: 0,
      patterns: ["vee", "line", "sine", "turret"],
      speed: 0.85,
      rate: 3.8,
      beams: 0,
      boss: "가난의 고철 거인",
      bossArt: "poverty",
      bossHP: 420,
      obstacles: 0,
      intro: "첫 번째 하늘 · 책방 골목\n코일과 자석을 모아 날아보세요",
      tip: "공격은 자동. 코일은 미사일을, 자석은 피해를 강화해요. SPACE는 스파크 폭풍!",
      fact: "코일에 자석을 넣고 빼면 자기장이 변하면서 유도 전압이 생겨요.",
      story:
        "넉넉하지 않은 집안에서 자란 패러데이는 책 제본 일을 하며 과학을 배웠어요. 어려운 형편이 배움의 가능성까지 정한 것은 아니었어요.",
      source:
        "https://www.rigb.org/explore-science/explore/blog/notebooks-preview-note-taking-life-young-michael-faraday",
      lesson: "가난이 나의 가능성을 정하지는 않아요.",
    },
    {
      name: "연구소의 문",
      zone: "노트 한 권이 연 기회",
      chapter: [
        "책으로 과학을 만나던 패러데이에게, 과학자 험프리 데이비의 강연을 들을 기회가 생겼어요.",
        "그는 강연 내용을 글과 그림으로 정성껏 기록해 데이비에게 보냈어요.",
        "그 노트는 왕립연구소에서 일할 기회로 이어졌어요. 책방에서 시작된 배움이 실험실로 향했지요.",
      ],
      enemyArt: "foes-gates",
      duration: 42,
      palette: 1,
      patterns: ["sine", "gate", "turret"],
      speed: 0.98,
      rate: 3.5,
      beams: 1,
      boss: "닫힌 문의 파수꾼",
      bossArt: "gate",
      bossHP: 950,
      obstacles: 0,
      intro: "두 번째 하늘 · 연구소의 문\n문이 열리는 순간을 노려요",
      tip: "파수꾼의 문이 열리면 약점이 드러나요. 펄스는 문을 강제로 열어요!",
      fact: "구리 코일을 더 감으면 같은 자기장 변화에서 유도 전압이 커져요. 충돌로 풀린 코일은 다시 주울 수 있어요.",
      story:
        "과학자가 되는 문이 처음부터 열려 있지는 않았어요. 패러데이는 데이비의 강연을 듣고 그림과 글로 노트를 만들었고, 그 노트는 연구소에서 일할 기회로 이어졌어요.",
      source:
        "https://www.rigb.org/explore-science/explore/blog/notebooks-preview-note-taking-life-young-michael-faraday",
      lesson: "관심을 기록하고, 도움을 받아 문을 열어요.",
    },
    {
      name: "그림의 하늘",
      zone: "기호 너머에서 찾은 길",
      chapter: [
        "실험실에 들어왔다고 모든 것이 쉬워진 것은 아니었어요. 고급 수학 교육을 받지 못한 패러데이에게는 낯선 기호가 많았지요.",
        "그는 관찰과 실험, 그림을 도구로 삼아 보이지 않는 힘의 작용을 탐구했어요.",
        "훗날 맥스웰은 이런 생각을 수학으로 발전시켰어요. 그림과 수학은 서로를 도왔지요.",
      ],
      enemyArt: "foes-symbols",
      duration: 45,
      palette: 2,
      patterns: ["spiral", "turret", "sine", "gate"],
      speed: 1.05,
      rate: 3.2,
      beams: 1,
      boss: "기호의 미궁",
      bossArt: "symbols",
      bossHP: 1950,
      obstacles: 0,
      intro: "세 번째 하늘 · 그림의 하늘\n탄막 사이의 모양을 읽어보세요",
      tip: "기호의 미궁은 나선과 부채꼴로 공격해요. 넓어지는 틈으로 이동하세요.",
      fact: "N극과 S극은 자석 하나에 함께 있어요. 더 강한 자석은 같은 움직임에서 더 큰 유도 전압을 만들어요.",
      story:
        "고급 수학 교육을 받지 못했던 패러데이는 관찰·실험·그림으로 힘의 작용을 탐구했어요. 이후 맥스웰은 이런 생각을 수학으로 발전시켰어요. 그림과 수학은 서로 도울 수 있어요.",
      source:
        "https://www.iop.org/explore-physics/big-ideas-physics/maxwells-equations",
      lesson: "아직 어려운 것이 있어도, 다른 도구로 탐구를 시작해요.",
    },
    {
      name: "다시, 실험실",
      zone: "실패에서 발견으로",
      chapter: [
        "전기와 자기는 어떻게 이어져 있을까요? 패러데이는 장치와 조건을 바꾸며 실험을 거듭했어요.",
        "원하는 결과가 나오지 않아도 관찰한 내용을 노트에 남겼지요.",
        "1831년, 그는 자기장의 변화로 전기가 생기는 전자기 유도를 발견했어요. 수많은 기록이 새로운 발견으로 이어졌어요.",
      ],
      enemyArt: "foes-lab",
      duration: 47,
      palette: 3,
      patterns: ["turret", "gate", "spiral"],
      speed: 1.12,
      rate: 3.0,
      beams: 2,
      boss: "실패의 발전기",
      bossArt: "boss",
      bossHP: 2550,
      obstacles: 0,
      intro: "네 번째 하늘 · 다시, 실험실\n실패도 다음 시도의 단서가 됩니다",
      tip: "발전기의 충전 공격을 발사 직전 펄스로 끊으면 PERFECT!",
      fact: "멈춘 자석만으로 계속 발전하지는 않아요. 코일을 지나는 자기장이 변해야 해요. 뜨거운 파편은 자석을 약하게 할 수 있어요.",
      story:
        "패러데이는 여러 장치와 조건을 바꾸며 실험했어요. 원하는 결과가 나오지 않은 시도도 기록했고, 1831년 전자기 유도를 발견했어요.",
      source:
        "https://www.rigb.org/explore-science/explore/collection/michael-faradays-ring-coil-apparatus",
      lesson: "실패한 결과도 다음 실험을 위한 정보예요.",
    },
    {
      name: "기록의 등대",
      zone: "발견은 우리에게 남아",
      chapter: [
        "발견을 이어 가던 패러데이는 기억력 저하와 어지럼증 때문에 연구를 쉬어야 했어요.",
        "휴식이 필요하다고 해서, 그가 쌓아 온 발견의 가치까지 사라지지는 않았어요.",
        "그가 남긴 기록과 실험은 다른 사람들에게 이어졌어요. 이제 항해의 끝에서, 배움을 나누는 패러데이를 만나러 가요.",
      ],
      enemyArt: "foes-records",
      duration: 50,
      palette: 4,
      patterns: ["spiral", "gate", "turret", "vee"],
      speed: 1.17,
      rate: 2.8,
      beams: 2,
      boss: "망각의 폭풍",
      bossArt: "fog",
      bossHP: 3200,
      obstacles: 0,
      intro: "마지막 하늘 · 기록의 등대\n남겨둔 기록이 길을 비춰줍니다",
      tip: "세 가지 패턴이 이어집니다. 안개 속에서도 밝은 탄환과 예고선은 또렷하게 보여요.",
      fact: "발전기는 운동 에너지를 전기 에너지로 바꿔요. 방향이 바뀌는 전기는 정류기를 거쳐 축전기에 일정한 극성으로 저장할 수 있어요.",
      story:
        "패러데이는 기억력 저하와 어지럼증 때문에 연구를 쉬어야 했어요. 쉬어야 하는 시간이 발견의 가치를 없애지는 않았어요. 그가 남긴 기록과 실험은 다른 사람들에게 이어졌어요.",
      source:
        "https://www.cambridge.org/core/services/aop-cambridge-core/content/view/3C9EF7202C54B7BF191BD225F425AA42/9780511709821c2_p126-192_CBO.pdf/18411844_to_aet_53.pdf",
      lesson: "쉬어도 괜찮아요. 기록과 배움은 함께 이어갈 수 있어요.",
    },
  ];
  const upgrades = [
    {
      id: "spread",
      icon: "◎",
      name: "구리 코일",
      desc: "탄환 한 줄 추가 (최대 5줄) · 유도 전압 증가",
      max: 4,
    },
    {
      id: "rapid",
      icon: "✣",
      name: "왕복 가속기",
      desc: "연사 속도 +14% · 자석 왕복 속도 증가",
      max: 4,
    },
    {
      id: "resonance",
      icon: "ϟ",
      name: "펄스 증폭기",
      desc: "스파크 폭풍 피해 +35%",
      max: 4,
    },
    {
      id: "friend",
      icon: "✧",
      name: "조수 드론",
      desc: "함께 공격하는 작은 드론 추가",
      max: 2,
    },
    {
      id: "heart",
      icon: "♡",
      name: "안전 캐빈",
      desc: "최대 체력 +1 · 다음 하늘에서 회복",
      max: 3,
    },
    {
      id: "cooldown",
      icon: "▥",
      name: "충전 회로",
      desc: "게임 속 펄스 충전 효율 +20%",
      max: 4,
    },
    {
      id: "magnet",
      icon: "⌁",
      name: "부품 회수 장치",
      desc: "수집 범위 +35 · 점수 +10%",
      max: 3,
    },
    {
      id: "power",
      icon: "↟",
      name: "강한 자석",
      desc: "탄환 피해 +25% · 유도 전압 증가",
      max: 4,
    },
  ];
  function choices(build, stage) {
    const available = upgrades.filter((u) => (build[u.id] || 0) < u.max),
      order = [
        "spread",
        "resonance",
        "heart",
        "friend",
        "rapid",
        "cooldown",
        "power",
        "magnet",
      ],
      offset = (stage * 3) % order.length;
    return order
      .slice(offset)
      .concat(order.slice(0, offset))
      .map((id) => available.find((u) => u.id === id))
      .filter(Boolean)
      .slice(0, 3);
  }
  return { levels, upgrades, choices };
});
