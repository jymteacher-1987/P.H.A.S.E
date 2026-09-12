# 잔광: 마지막 신호

P.H.A.S.E의 오리지널 SF 광학 퍼즐 게임. 4막 16개 구역, 마지막 3단계 전송, 엔딩, 구역 재도전, 일일 회선, 로컬 저장, 단계별 힌트, 별 기록을 제공합니다.

## 실행

- 웹: `../../plays/afterlight.html`
- 공개 뷰어: https://jymteacher-1987.github.io/P.H.A.S.E/view.html?id=afterlight&src=play
- 외부 CDN, 외부 게임 엔진, 계정, 서버 저장소가 필요 없습니다. 파일 배치를 유지하면 로컬 HTML로 실행할 수 있습니다.
- 배경 이미지는 장식용 허구의 도시이며 물리 설명 그림이 아닙니다. 실제 물리 장치는 캔버스에서 수치 모형에 맞춰 그립니다.

## 물리 모형

`physics.js`는 렌더러와 분리된 순수 계산 모듈입니다.

1. 반사: `r = d - 2(d·n)n`. 45° 거울의 법선에서 입사각·반사각을 비교합니다.
2. 경로 분할: 이상적인 50:50 분할기의 파워를 두 갈래로 나눕니다. 모든 캠페인 배치를 열거해 동일 방향의 결맞는 빔 재합성과 닫힌 경로가 생기지 않음을 검사합니다.
3. 편광: 선편광의 투과 파워는 `P cos²θ`. 비편광의 첫 판은 `P/2`. 이후 투과축을 다음 판의 입사 편광으로 사용합니다. 미투과분은 이상적 흡수형 편광판의 흡수로 계산합니다.
4. 간섭: 두 무손실 50:50 분할기의 복소 진폭을 합한 값의 절댓값 제곱. 두 팔 모두 열리면 위쪽 A는 `sin²(φ/2)`, 오른쪽 B는 `cos²(φ/2)`. 셔터 하나가 닫히면 각각 25%, 셔터 흡수 50%입니다.
5. 간섭계의 `phase`는 고정 광학 소자의 반사 위상을 포함한 장치 기준에서의 상대 위상 제어값입니다. 두 팔의 주파수·편광이 같고 결맞는 이상 모형입니다.

광학 파워는 광원 입력에 대한 비율로 표시합니다. 이동하는 빛무늬는 길 읽기용 연출이고 광자나 실제 광속을 나타내지 않습니다. 표시색은 파장 변경을 의미하지 않습니다. 광신호는 각 구역의 비상 전력망에 제어 명령을 전달하며, 레이저가 도시의 전력을 공급하지 않습니다. 회절·실제 손실·불완전한 편광판·양자 측정은 구현 범위에 포함하지 않습니다.

## 근거 자료

- OpenStax, College Physics 2e, 25.2 The Law of Reflection: https://openstax.org/books/college-physics-2e/pages/25-2-the-law-of-reflection
- OpenStax, University Physics Volume 3, 1.7 Polarization: https://openstax.org/books/university-physics-volume-3/pages/1-7-polarization
- Dietrich von der Linde, Applied Physics B 127, 133 (2021), Optical beam splitter, Mach–Zehnder interferometer and the delayed choice issue: https://doi.org/10.1007/s00340-021-07680-z

검증에서는 출구의 이름이나 식을 암기해 복사하는 대신, 반사·투과 위상을 포함한 복소 전기장 전파를 독립적으로 계산해 두 출구의 파워와 비교합니다. 특히 한 출구의 상쇄를 에너지 소멸로 표현하지 않습니다.

## 제작 이미지

- 방식: 내장 `image_gen` 도구, 새 이미지 생성.
- 최종 게임 파일: `assets/afterlight/city.webp` (1536×1024, 약 169 KiB).
- 생성 원본: `C:/Users/user/.codex/generated_images/01a093eb-feda-7ad2-a4a6-68e9869e3287/exec-e2cb92f5-0900-46e0-9b8f-234d2424f07c.png`.
- 원본은 유지하고, 게임에는 용량을 줄인 WebP를 사용했습니다.

최종 프롬프트:

> Use case: stylized-concept. Asset type: original background key art for a Korean browser optical puzzle adventure called Afterlight. A young signal courier in a dark technical jacket seen from behind on a rain-slick rooftop on the RIGHT third, carrying a tiny cyan glowing signal device, looks across a vast silent futuristic coastal city during blackout, dim windows, one distant enormous ring-shaped optical communications tower, the first amber dawn on the horizon, rich midnight indigo and vivid cyan with restrained warm amber. Sophisticated painterly 2.5D game concept art, evocative, atmospheric, striking silhouettes, filmic depth, beautiful architectural detail. Wide cinematic 1536x1024 composition; left half especially dark, uncluttered sky/buildings allowing game title overlay. No words, no logos, no UI, no borders, no watermarks, no formulas, no visible laser trajectories. This is fictional story artwork, not a physics diagram. Original IP, no resemblance to existing game characters.

## 유지보수

- 수정 후 `node tools/afterlight-register.cjs`로 내부 리소스·게임·목록의 캐시 버전을 갱신합니다.
- `node tools/generate-previews.cjs --only=afterlight`로 첫 시작 화면을 실제 캡처합니다.
- `npm test`에 물리 검증, 두 브라우저의 전체 플레이, 작은 화면 및 공통 뷰어 검사가 포함됩니다.
- 저장 키는 `phase-afterlight-v1`. 개인 정보나 외부 랭킹을 저장하지 않습니다.
- 새 저장 구조는 마이그레이션 또는 명시적 버전 변경을 적용하세요. 기존 캠페인 순서 변경 시 체크포인트와 별 기록도 검토해야 합니다.
