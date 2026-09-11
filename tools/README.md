# 대표 장면 미리보기

실험실 목록은 `assets/previews/`에 저장된 **실제 실행 화면의 WebP 사진**을 사용합니다. 목록을 스크롤할 때 게임, 실험 스크립트, 애니메이션, 오디오를 실행하지 않습니다. 사진은 720 × 540이며 화면 근처에 오는 것부터 읽습니다.

## 새 실험을 추가하거나 수정할 때

1. 실험 HTML을 `experiments/` 또는 `plays/`에 저장하고 기존처럼 `data/experiments.json`과 `assets/js/experiments-data.js`에 등록합니다.
2. 필요하면 `tools/preview-scenes.json`에 촬영 전에 누를 버튼과 대기 시간을 적습니다. 예: `"newton-rush": { "steps": [{ "click": "#start" }, { "wait": 1000 }] }`. `select` + `value`, `press`, `target`(촬영할 요소), `viewport`도 지원합니다. 별도 설정이 없으면 첫 실험 화면을 촬영합니다.
3. `main`에 올리면 **Update activity previews** 작업이 새롭거나 바뀐 장면만 촬영하고, 사진·목록을 GitHub에 저장한 뒤 Pages 배포를 요청합니다. 이전 이미지가 준비돼 있으면 새 촬영에 실패해도 유지됩니다. 실행 오류나 빈 캡처는 작업 실패로 표시되니 Actions 결과를 확인하세요.

GitHub의 **Actions → Update activity previews → Run workflow**에서도 실행할 수 있습니다. `모든 대표 장면을 다시 촬영`을 선택하면 전부 갱신합니다. 변경 없는 사진은 다시 만들지 않으므로 매번 화면이 흔들리지 않습니다. 이미지 파일명에 내용 해시가 붙어 수정한 장면을 오래된 캐시로 보여주지 않습니다.

이 자동화는 GitHub 저장소에 등록한 실험·놀이가 대상입니다. Firebase에만 올린 외부 실험은 저장소에 가져와 등록해야 같은 방식으로 촬영됩니다.

## 컴퓨터에서 실행

Node.js 22 이상에서:

```sh
npm ci
npx playwright install chromium
npm run previews
npm run previews:check
npm test
```

전체 재촬영: `npm run previews -- --force`. 특정 장면: `npm run previews -- --only=physics-fighter,giants-shoulders --force`. Windows에 설치된 Edge로 촬영하려면 PowerShell에서 `$env:PREVIEW_BROWSER_CHANNEL='msedge'`를 먼저 지정할 수 있습니다.

촬영은 로그인·사용자 프로필이 없는 별도 브라우저에서 진행합니다. 외부 요청은 화면에 필요한 지정된 글꼴·스크립트 CDN의 읽기 요청만 허용하며 방문 통계나 게임 랭킹을 기록하지 않습니다. `index.json`과 브라우저용 `index.js`는 생성 결과이므로 직접 편집하지 않습니다. 이미지 선택을 바꾸려면 촬영 설정을 수정하세요.

## 폰·패드 전체화면

`assets/js/device.js`가 iPhone, iPad(데스크톱 웹사이트 모드 포함), Android 폰·태블릿을 구분합니다. 화면이 좁거나 터치가 된다는 이유만으로 컴퓨터를 모바일로 판단하지 않습니다. 폰·패드는 카드 터치 때 지원되는 전체화면을 요청하고 실험이 보이는 화면을 채웁니다. 컴퓨터는 일반 뷰어와 수동 전체화면 버튼을 사용합니다. 주소창 숨김 여부는 각 모바일 브라우저의 전체화면 지원에 따릅니다.
