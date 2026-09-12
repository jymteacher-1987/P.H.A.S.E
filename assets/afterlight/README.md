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
2. 경로 분할: 한쪽에서 입사한 빛의 광출력을 이상적인 무손실 50:50 분할기가 두 갈래로 나눕니다. 모든 캠페인 배치를 열거해 동일 방향의 결맞는 빔 재합성과 닫힌 경로가 생기지 않음을 검사합니다. 장치 없는 교차점에서 발생하는 국소 간섭무늬는 이 광선 화면에서 계산하지 않습니다.
3. 편광: 각 판에 들어오는 선편광의 투과 광출력은 `P cos²θ`입니다. θ는 그 판의 입사광 진동축과 투과축 사이 각도입니다. 완전한 비편광 입력의 첫 이상적인 선형 편광판은 평균 `P/2`를 투과합니다. 통과한 빛이 있을 때 이후 투과축을 다음 판의 입사 편광으로 사용합니다. 게임은 흡수형 판을 가정하므로 미투과분을 흡수로 계산합니다. 반사형 편광 장치까지 일반화하지 않습니다.
4. 간섭: 두 무손실 50:50 분할기를 지나는 복소 전기장 성분을 출구별로 합한 후 절댓값 제곱으로 광출력을 구합니다. 두 경로가 모두 열리면 위쪽 A의 광원 대비 비율은 `sin²(δ/2)`, 오른쪽 B의 비율은 `cos²(δ/2)`입니다. 셔터 하나가 닫히면 각각 25%, 셔터 흡수 50%입니다. 두 셔터가 닫히면 100%가 흡수됩니다.
5. `phase`는 두 경로를 지나며 누적되는 위상의 차이 `δ = 2π(L위 − L아래)/λ₀`입니다. L은 광학적 경로 길이(균일한 매질에서 nℓ), λ₀는 진공 파장입니다. 식은 라디안, 조절값은 도 단위이며 2π rad = 360°입니다. 분할기의 고정 반사·투과 위상은 별도로 출력식에 포함합니다. δ를 출구에서 합쳐지는 두 전기장의 최종 위상차라고 부르지 않습니다.

그림과 같은 배치에서 분할기의 진폭 투과계수는 `t=1/√2`, 반사계수는 `r=i/√2`입니다. 첫 분할기 후 위쪽 전기장은 `r exp(iδ)`, 아래쪽은 `t`이며, A에서는 위쪽의 반사 성분과 아래쪽의 투과 성분이 합쳐져 `(1−exp(iδ))/2`, B에서는 `i(1+exp(iδ))/2`가 됩니다. 각 경로에 공통인 거울의 위상은 광출력에 영향을 주지 않습니다. 따라서 δ=0°에서 A가 어둡고 B가 밝습니다. 두 빛은 같은 주파수·편광을 가지며 같은 공간 모드에 완전히 겹치고 결맞음이 유지된다고 가정합니다. 각 위상 설정의 정상상태를 계산하며 조절 중의 과도 현상은 모형 범위 밖입니다.

표시한 광출력 P는 시간 평균값이며 모든 백분율의 기준은 광원 출력 P₀입니다. 광출력의 단위는 W = J/s이고, 빛의 세기 I의 단위는 W/m²입니다. 균일한 빔 단면에서 I=P/S이며 둘은 다른 물리량입니다. 편광 그림의 화살표는 입사광의 진동축과 판의 투과축을 구분해 표시하고, 실제 틈이나 분자 배열을 뜻하지 않습니다. 이동하는 빛무늬는 길 읽기용 연출이며 광자나 실제 광속을 나타내지 않습니다. 선 굵기·화면 밝기는 정량 축척이 아닙니다. 표시색은 파장 변경을 의미하지 않습니다. 빛은 에너지를 전달하지만 이야기 속 도시 전력은 별도의 비상 전력망에서 공급하고 광신호는 복구 명령을 전합니다. 회절·실제 반사 손실·불완전한 편광판·양자 측정은 구현 범위에 포함하지 않습니다.

## 근거 자료

- OpenStax, College Physics 2e, 25.2 The Law of Reflection: https://openstax.org/books/college-physics-2e/pages/25-2-the-law-of-reflection
- OpenStax, University Physics Volume 3, 1.7 Polarization: https://openstax.org/books/university-physics-volume-3/pages/1-7-polarization
- OpenStax, University Physics Volume 2, 16.3 Energy Carried by Electromagnetic Waves: https://openstax.org/books/university-physics-volume-2/pages/16-3-energy-carried-by-electromagnetic-waves
- OpenStax, University Physics Volume 3, 3.1 Young’s Double-Slit Interference: https://openstax.org/books/university-physics-volume-3/pages/3-1-youngs-double-slit-interference
- Dietrich von der Linde, Applied Physics B 127, 133 (2021), Optical beam splitter, Mach–Zehnder interferometer and the delayed choice issue: https://doi.org/10.1007/s00340-021-07680-z

검증에서는 반사·투과 위상을 포함한 복소 전기장 전파를 독립적으로 계산해 두 출구의 광출력과 비교합니다. 편광은 각도 차이 공식을 반복하는 대신 직교 좌표의 Jones 투영 행렬로 20,736개의 네 판 배치를 따로 계산하며, 비편광은 서로 직교하는 두 입력 상태의 비결맞는 혼합으로 대조합니다. 한 출구의 상쇄를 에너지 소멸로 표현하지 않습니다.

## 음악

- `music.js`: 외부 음원이 없는 오리지널 32마디 악곡. 저음, 16분음표 스트링·아르페지오, 브라스·패드 화음, 선율, 킥·스네어·탐·심벌·하이햇을 Web Audio로 합성합니다.
- 막에 따라 138 → 146 → 156 → 168 BPM으로 긴박감을 높입니다. 스테레오 배치, 짧은 홀 잔향과 에코를 더했습니다. 일시 정지·기록 창에서는 새 음표 재생을 멈추고 잔향을 짧게 감쇠시킵니다.
- 기본값은 켜짐이며 사용자의 첫 시작/이어하기 조작 후 재생합니다. 브라우저 자동 재생 정책을 우회하지 않습니다.
- 이전 버전에서 저장된 기본 무음은 새 기본값으로 한 번 이행합니다. 이후 직접 끈 설정은 `audioVersion:2`와 함께 저장해 유지합니다. 캠페인 진행 기록은 유지합니다.
- Chromium에서 실제 재생·정지를, 두 브라우저에서 기본 설정·음소거 유지·이전 저장 이행을 확인하고, 각 막의 전체 악곡을 OfflineAudioContext로 렌더링해 비정상 수치·클리핑·무음 마디를 검사합니다. 이 Windows용 WebKit 검사 엔진은 Web Audio API를 제공하지 않아 해당 환경에서는 오류 없이 게임이 계속되는 대체 동작을 확인합니다.

## 제작 이미지

- 방식: 내장 `image_gen` 도구, 새 이미지 생성.
- 최종 게임 파일: `assets/afterlight/city.webp` (1536×1024, 약 169 KiB).
- 생성 원본: `C:/Users/user/.codex/generated_images/01a093eb-feda-7ad2-a4a6-68e9869e3287/exec-e2cb92f5-0900-46e0-9b8f-234d2424f07c.png`.
- 원본은 유지하고, 게임에는 용량을 줄인 WebP를 사용했습니다.

최종 프롬프트:

> Use case: stylized-concept. Asset type: original background key art for a Korean browser optical puzzle adventure called Afterlight. A young signal courier in a dark technical jacket seen from behind on a rain-slick rooftop on the RIGHT third, carrying a tiny cyan glowing signal device, looks across a vast silent futuristic coastal city during blackout, dim windows, one distant enormous ring-shaped optical communications tower, the first amber dawn on the horizon, rich midnight indigo and vivid cyan with restrained warm amber. Sophisticated painterly 2.5D game concept art, evocative, atmospheric, striking silhouettes, filmic depth, beautiful architectural detail. Wide cinematic 1536x1024 composition; left half especially dark, uncluttered sky/buildings allowing game title overlay. No words, no logos, no UI, no borders, no watermarks, no formulas, no visible laser trajectories. This is fictional story artwork, not a physics diagram. Original IP, no resemblance to existing game characters.

## 유지보수

- 수정 후 `node tools/afterlight-register.cjs`로 내부 리소스·게임·목록의 캐시 버전을 갱신합니다.
- 2026-09-13 사용자 요청에 따라 게임 목록에서 `hanbut`(한붓 실험실) 바로 앞에 등록합니다.
- `node tools/generate-previews.cjs --only=afterlight`로 첫 시작 화면을 실제 캡처합니다.
- `npm test`에 물리 검증, 두 브라우저의 전체 플레이, 작은 화면 및 공통 뷰어 검사가 포함됩니다.
- 저장 키는 `phase-afterlight-v1`. 개인 정보나 외부 랭킹을 저장하지 않습니다.
- 새 저장 구조는 마이그레이션 또는 명시적 버전 변경을 적용하세요. 기존 캠페인 순서 변경 시 체크포인트와 별 기록도 검토해야 합니다.
