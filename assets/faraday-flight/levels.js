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
      duration: 37,
      palette: 0,
      patterns: ["vee", "line", "sine"],
      speed: 0.85,
      rate: 2.7,
      beams: 0,
      boss: "가난의 고철 거인",
      bossArt: "poverty",
      bossHP: 580,
      obstacles: 0,
      intro: "첫 번째 하늘 · 책방 골목\n코일과 자석을 모아 날아보세요",
      tip: "공격은 자동. 코일은 미사일을, 자석은 피해를 강화해요. SPACE는 스파크 폭풍!",
      fact: "코일 속에서 자석을 돌리면 자기장이 변하면서 유도 전압이 생겨요.",
      story:
        "넉넉하지 않은 집안에서 자란 패러데이는 책 제본 일을 하며 과학을 배웠어요. 어려운 형편이 배움의 가능성까지 정한 것은 아니었어요.",
      source:
        "https://www.rigb.org/explore-science/explore/blog/notebooks-preview-note-taking-life-young-michael-faraday",
      lesson: "가난이 나의 가능성을 정하지는 않아요.",
    },
    {
      name: "연구소의 문",
      zone: "노트 한 권이 연 기회",
      duration: 42,
      palette: 1,
      patterns: ["sine", "gate", "turret"],
      speed: 0.98,
      rate: 2.55,
      beams: 1,
      boss: "닫힌 문의 파수꾼",
      bossArt: "gate",
      bossHP: 1250,
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
      duration: 45,
      palette: 2,
      patterns: ["spiral", "sine", "gate"],
      speed: 1.05,
      rate: 2.35,
      beams: 1,
      boss: "기호의 미궁",
      bossArt: "symbols",
      bossHP: 1850,
      obstacles: 0,
      intro: "세 번째 하늘 · 그림의 하늘\n탄막 사이의 모양을 읽어보세요",
      tip: "기호의 미궁은 나선과 부채꼴로 공격해요. 넓어지는 틈으로 이동하세요.",
      fact: "N극과 S극은 자석 하나에 함께 있어요. 더 강한 자석은 같은 발전기 회전에서 더 큰 유도 전압을 만들어요.",
      story:
        "고급 수학 교육을 받지 못했던 패러데이는 관찰·실험·그림으로 힘의 작용을 탐구했어요. 이후 맥스웰은 이런 생각을 수학으로 발전시켰어요. 그림과 수학은 서로 도울 수 있어요.",
      source:
        "https://www.iop.org/explore-physics/big-ideas-physics/maxwells-equations",
      lesson: "아직 어려운 것이 있어도, 다른 도구로 탐구를 시작해요.",
    },
    {
      name: "다시, 실험실",
      zone: "실패에서 발견으로",
      duration: 47,
      palette: 3,
      patterns: ["turret", "gate", "spiral"],
      speed: 1.12,
      rate: 2.3,
      beams: 2,
      boss: "실패의 발전기",
      bossArt: "boss",
      bossHP: 2500,
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
      duration: 50,
      palette: 4,
      patterns: ["spiral", "gate", "turret", "vee"],
      speed: 1.17,
      rate: 2.2,
      beams: 2,
      boss: "망각의 폭풍",
      bossArt: "fog",
      bossHP: 3300,
      obstacles: 0,
      intro: "마지막 하늘 · 기록의 등대\n남겨둔 기록이 길을 비춰줍니다",
      tip: "세 가지 패턴이 이어집니다. 안개 속에서도 밝은 탄환과 예고선은 또렷하게 보여요.",
      fact: "발전기는 운동 에너지를 전기 에너지로 바꿔요. 축전기는 그 전기를 잠시 모아둘 수 있어요.",
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
      name: "고속 회전날개",
      desc: "연사 속도 +14% · 발전기 회전 증가",
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
