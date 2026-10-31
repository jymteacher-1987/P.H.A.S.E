const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium, webkit} = require('playwright');

const html = fs.readFileSync(path.join(__dirname, '../plays/hero-maker.html'), 'utf8');

for (const engine of [chromium, webkit]) {
  test(`hero appearance instructions (${engine.name()})`, {timeout:60000}, async t => {
    const browser = await engine.launch({headless:true});
    t.after(() => browser.close());
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().resourceType() === 'document'
      ? route.fulfill({contentType:'text/html; charset=utf-8', body:html}) : route.abort());
    await page.goto('https://phase-appearance.test/');

    await t.test('full and lean prompts preserve the face without freezing hair or replacing eyewear rules', async () => {
      const cases = await page.evaluate(() => {
        const results = [];
        for (const age of ['12', '15']) for (const gender of ['boy', 'girl', 'neutral']) {
          for (const glasses of ['yes', 'no']) {
            Object.assign(state, {age, gender, glasses, level:'middle', photo:'data:image/png;base64,AA==',
              photoFace:'', faceTreatment:'retouch', name:'Appearance test', shot:'poster', motifsFree:'거미', motifsEn:'spider',
              motifCues:'', palette:'', signature:'', loadout:[]});
            const full = buildPrompt('');
            const lean = buildLeanPrompt({picture:'A standing hero.', garment:'A fitted costume.',
              head:'A crown piece behind the natural hairline.',
              hair:'Distinct braided hair swept back into a high ponytail.',
              person:'UNUSED_PERSON_FACE_DESCRIPTION'});
            results.push({age, gender, glasses, full, lean});
          }
        }
        return results;
      });
      for (const entry of cases) for (const mode of ['full', 'lean']) {
        const prompt = entry[mode], context = `${mode}, age ${entry.age}, ${entry.gender}, glasses ${entry.glasses}`;
        assert.ok(prompt.includes('photographed') && /expression|facial features/.test(prompt), context);
        assert.match(prompt, /head (?:pose|angle)|yaw, pitch and roll/, context + ': head pose is preserved');
        assert.match(prompt, /hair.*(?:restyl|styled|redesign)|(?:Restyle|restyle).*hair/i, context + ': hair can be styled');
        assert.doesNotMatch(prompt, /Keep their head exactly as it is|Take the photographed head exactly as it is|put the photographed head back|EVERYTHING FROM THE NECK UP COMES FROM THE PHOTOGRAPH|THE FACE AND THE HAIR ARE NOT PART OF THIS SECTION|frames are the single object on this head that is REBUILT/, context);
        if (entry.glasses === 'yes') {
          assert.match(prompt, /EYEWEAR — REDESIGNED FOR THIS HERO, NOT COPIED FROM THE PHOTOGRAPH/, context);
          assert.match(prompt, /shape may change completely/, context + ': original frame shape is not locked');
          assert.match(prompt, /CLEAR and OPTICALLY NEUTRAL/, context + ': eyes remain visible');
          assert.match(prompt, /face stays uncovered except for the redesigned hero eyewear/, context + ': helmet exception');
          assert.doesNotMatch(prompt, /Everything from the eyebrows down is bare face|everything from the brow down bare|no mask, visor or optical band across the face/, context);
        } else {
          assert.match(prompt, /NOTHING NEW.*OVER THEM|NOTHING NEW IS PUT THERE|NOTHING ADDED OVER THE EYES/, context);
          assert.doesNotMatch(prompt, /EYEWEAR — REDESIGNED FOR THIS HERO, NOT COPIED FROM THE PHOTOGRAPH/,
            context + ': bare eyes must not receive the wearer-only design rule');
        }
        if (mode === 'lean') {
          assert.ok(prompt.includes('Distinct braided hair swept back into a high ponytail.'), context + ': hairstyle survives assembly');
          assert.ok(!prompt.includes('UNUSED_PERSON_FACE_DESCRIPTION'), context + ': person must not reintroduce facial inventions');
        }
      }
    });

    await t.test('cinematographer hair field reaches the final prompt independently of person', async () => {
      const result = await page.evaluate(async () => {
        Object.assign(state, {photo:'data:image/png;base64,AA==', photoFace:'', glasses:'yes', age:'15',
          gender:'girl', level:'middle', faceTreatment:'retouch', loadout:[]});
        const originalFetch = orFetch;
        let instruction = '';
        const hair = 'A crisp side part leads into swept-back separated strands with a matte finish.';
        orFetch = async payload => {
          instruction = payload.messages[0].content.find(part => part.type === 'text').text;
          return {choices:[{message:{content:JSON.stringify({picture:'A standing hero.',
            person:'UNUSED_PERSON_FACE_DESCRIPTION', garment:'A tailored costume.', hair,
            head:'Transparent hero goggles in a purpose-built frame.'})}}]};
        };
        try {
          const brief = await askCinematographer(buildPrompt(''));
          return {instruction, brief, prompt:buildLeanPrompt(brief), hair};
        } finally { orFetch = originalFetch; }
      });
      assert.equal(result.brief.hair, result.hair, 'the structured response parser must retain hair');
      const personSpec = result.instruction.match(/"person": "([^\n]+)"/)[1];
      const hairSpec = result.instruction.match(/"hair": "([^\n]+)"/)[1];
      assert.match(personSpec, /separate hair field/);
      assert.doesNotMatch(personSpec, /DESIGN A HAIRSTYLE/);
      assert.match(hairSpec, /DESIGN A HAIRSTYLE/);
      assert.match(hairSpec, /Do not describe facial features, expression, head pose, eyewear or body build/);
      assert.ok(result.prompt.includes('THE HAIRSTYLE: ' + result.hair));
      assert.ok(!result.prompt.includes('UNUSED_PERSON_FACE_DESCRIPTION'));
    });

    await t.test('no-photo age and original-face rules remain active without importing photo hair', async () => {
      const result = await page.evaluate(() => {
        Object.assign(state, {photo:'', photoFace:'', glasses:'', age:'12', gender:'neutral',
          level:'elementary', loadout:[]});
        return {full:buildPrompt(''), lean:buildLeanPrompt({picture:'A standing hero.', garment:'A costume.',
          hair:'PHOTO_HAIR_MUST_NOT_LEAK'}), identity:identityRule(), body:figureRule()};
      });
      assert.match(result.identity, /Invent an ORIGINAL face/);
      assert.match(result.identity, /ordinary everyday haircut/);
      assert.match(result.body, /THE FACE IS A CHILD'S FACE/);
      assert.match(result.body, /school haircut, slightly untidy, soft rather than styled/);
      assert.match(result.lean, /FACE: an original believable Korean/);
      assert.ok(!result.lean.includes('PHOTO_HAIR_MUST_NOT_LEAK'));
      assert.ok(!result.full.includes('THE ATTACHED PHOTOGRAPH IS THE PERSON'));
    });
    await t.test('original-head and hair-eyewear styling modes reach every prompt without facial retouch', async () => {
      const cases = await page.evaluate(async () => {
        const originalFetch = orFetch, results = [];
        let instruction = '';
        orFetch = async payload => {
          instruction = payload.messages[0].content.find(part => part.type === 'text').text;
          return {choices:[{message:{content:JSON.stringify({heroName:'거미 수호자',
            picture:'A standing hero.', person:'UNUSED_PERSON_FACE_DESCRIPTION', garment:'A tailored costume.',
            hair:'A swept-back side part with separated strands.', head:'A distinctive scalloped crown behind the hairline.'})}}]};
        };
        try {
          for (const age of ['12', '15']) for (const gender of ['boy', 'girl', 'neutral']) {
          for (const glasses of ['yes', 'no']) for (const faceTreatment of ['original', 'retouch']) {
            Object.assign(state, {photo:'data:image/png;base64,AA==', photoFace:'', glasses, faceTreatment,
              age, gender, level:'middle', name:'Appearance test', shot:'poster',
              motifsFree:'거미', motifsEn:'spider', motifCues:'', palette:'', signature:'', loadout:[]});
            const full = buildPrompt('');
            const brief = await askCinematographer(full);
            const cinematographer = instruction, lean = buildLeanPrompt(brief);
            await askDirector();
            results.push({age, gender, glasses, faceTreatment, full, lean, cinematographer, director:instruction,
              contract:typeof sourceFaceEditRule === 'function' ? sourceFaceEditRule() : '',
              surface:typeof faceSurfaceRule === 'function' ? faceSurfaceRule() : '',
              stylingAllowed:typeof headStylingAllowed === 'function' ? headStylingAllowed() : null,
              allowed:typeof faceRetouchAllowed === 'function' ? faceRetouchAllowed() : null});
          }
          }
        } finally { orFetch = originalFetch; }
        return results;
      });
      const oldPermissions = /temporary (?:spot|blemish)(?: or shine)? (?:may be tidied|may go)|WHAT MAY BE IMPROVED — better light|Match the scene by changing only photographic properties|re-lit by this scene|locked face, re-lit|a clean catchlight in each eye|LIMITED SURFACE RETOUCH ONLY|gently reduce temporary blemishes|small exposure and white[- ]balance adjustments/i;
      const hairAndEyewearRedesign = /EYEWEAR — REDESIGNED FOR THIS HERO, NOT COPIED FROM THE PHOTOGRAPH|THIS HERO GETS A PROPER HAIRSTYLE|THE FACE BOUNDARY IS LOCKED, THE HAIRSTYLE IS NOT|THE GLASSES BECOME HERO EYEWEAR|The eyewear over those eyes is redesigned as hero eyewear|spend most of them on designing the eyewear itself|if it still looks like the ordinary glasses in the photograph, it has not been designed yet/i;
      for (const entry of cases) {
        assert.equal(entry.allowed, false, 'neither photo mode permits facial retouching');
        assert.equal(entry.stylingAllowed, entry.faceTreatment === 'retouch');
        assert.ok(entry.contract.length > 0, 'photo modes need an explicit face-treatment contract');
        assert.ok(entry.surface.length > 0 && entry.contract.includes(entry.surface), 'both modes use the same strict face-surface rule');
        for (const path of ['full', 'lean', 'director', 'cinematographer']) {
          const prompt = entry[path], context = `${entry.faceTreatment}, age ${entry.age}, ${entry.gender}, glasses ${entry.glasses}, ${path}`;
          assert.ok(prompt.includes(entry.contract), `${context}: selected contract must reach the model`);
          if (path === 'full' || path === 'lean') {
            assert.ok(prompt.startsWith(entry.contract), `${context}: face treatment must come before styling`);
          }
          assert.match(prompt, /expression/i, context + ': expression remains protected');
          assert.match(prompt, /skin(?:,\s*|\s+)(?:texture|tone)/i, context + ': skin is covered by the identity constraint');
          assert.doesNotMatch(prompt, oldPermissions, context + ': neither mode may alter photographed skin or lighting');
          if (entry.faceTreatment === 'original') {
            assert.match(entry.contract, /ENTIRE ORIGINAL HEAD IS READ-ONLY/i, context);
            assert.doesNotMatch(prompt, hairAndEyewearRedesign, context + ': original hair and glasses cannot be redesigned');
          } else {
            assert.match(entry.contract, /ORIGINAL FACE UNCHANGED/i, context);
            assert.match(entry.contract, /HAIRSTYLE AND EXISTING EYEWEAR ONLY MAY BE STYLED/i, context);
          }
        }
        for (const field of ['A swept-back side part with separated strands.', 'A distinctive scalloped crown behind the hairline.']) {
          assert.equal(entry.lean.includes(field), entry.faceTreatment === 'retouch',
            'cinematographer hair/head instructions are used only when head styling was selected');
        }
        assert.ok(!entry.lean.includes('UNUSED_PERSON_FACE_DESCRIPTION'));
        if (entry.glasses === 'yes' && entry.faceTreatment === 'retouch') {
          assert.match(entry.lean, /EYEWEAR — REDESIGNED FOR THIS HERO, NOT COPIED FROM THE PHOTOGRAPH/);
        }
      }
      for (const age of ['12', '15']) for (const gender of ['boy', 'girl', 'neutral']) for (const glasses of ['yes', 'no']) {
        const original = cases.find(x => x.age === age && x.gender === gender && x.glasses === glasses && x.faceTreatment === 'original');
        const retouch = cases.find(x => x.age === age && x.gender === gender && x.glasses === glasses && x.faceTreatment === 'retouch');
        assert.equal(original.surface, retouch.surface, 'hair/eyewear styling cannot relax the face-surface restriction');
        for (const path of ['full', 'lean', 'director', 'cinematographer']) {
          assert.notEqual(original[path], retouch[path], `${path}: switching face treatment must change the actual prompt`);
        }
      }
    });

    await t.test('both face treatments survive every shot, including activated equipment', async () => {
      const cases = await page.evaluate(() => {
        const results = [];
        Object.assign(state, {photo:'data:image/png;base64,AA==', photoFace:'', glasses:'yes',
          faceTreatment:'original', age:'15', gender:'neutral', level:'middle', name:'Appearance test',
          motifsFree:'거미', motifsEn:'spider', motifCues:'', palette:'', signature:''});
        // Use actual experiment equipment so the activation branch contains its action moment.
        const selected = ['oobleck', 'fruitcell', 'spectrum', 'resonance'];
        state.loadout = LABS.middle.map((station, index) => ({
          ...(station.experiments.find(e => e.id === selected[index]) || station.experiments[0]),
          slot:station.slot, slotEn:station.slotEn, ok:true, grade:'ok'
        }));
        for (const faceTreatment of ['original', 'retouch']) for (const shot of SHOTS.filter(x => !x.free)) {
          state.faceTreatment = faceTreatment;
          state.shot = shot.id;
          const full = buildPrompt(''), lean = buildLeanPrompt({picture:'A hero in the chosen scene.',
            garment:'A tailored costume.', hair:'A swept-back side part.'});
          results.push({shot:shot.id, faceTreatment, full, lean});
        }
        return results;
      });
      assert.ok(cases.some(entry => entry.shot === 'activate'));
      const relighting = /It lights the face, chest and ground|light it makes falls on the hero's suit and face|soft cool bounce filling the face|soft frontal fill keeps the face|warm practical light catching one side of the face|rendered at portrait focal length|render its perspective as if it were photographed on a portrait lens/i;
      for (const entry of cases) for (const path of ['full', 'lean']) {
        const context = `${entry.faceTreatment}, ${entry.shot}, ${path}`;
        assert.doesNotMatch(entry[path], relighting, `${context}: the scene must not relight or reproject the original face`);
        if (entry.faceTreatment === 'original') {
          assert.doesNotMatch(entry[path], /cape and hair are blown hard|cape and hair move with the discharge/i,
            `${context}: scene action cannot restyle original hair`);
        }
      }
    });

    await t.test('without a photo both treatment choices produce the same prompts', async () => {
      const result = await page.evaluate(async () => {
        const originalFetch = orFetch, results = [];
        let instruction = '';
        orFetch = async payload => {
          instruction = payload.messages[0].content.find(part => part.type === 'text').text;
          return {choices:[{message:{content:JSON.stringify({heroName:'거미 수호자',
            picture:'An original student hero.', person:'An ordinary student.', garment:'A costume.', hair:''})}}]};
        };
        try {
          for (const faceTreatment of ['original', 'retouch']) {
            Object.assign(state, {photo:'', photoFace:'', glasses:'', faceTreatment, age:'12', gender:'neutral',
              level:'elementary', name:'Appearance test', shot:'poster', motifsFree:'거미', motifsEn:'spider',
              motifCues:'', palette:'', signature:'', loadout:[]});
            const full = buildPrompt('');
            const brief = await askCinematographer(full);
            const cinematographer = instruction, lean = buildLeanPrompt(brief);
            await askDirector();
            results.push({full, lean, cinematographer, director:instruction,
              contract:typeof sourceFaceEditRule === 'function' ? sourceFaceEditRule() : '',
              allowed:typeof faceRetouchAllowed === 'function' ? faceRetouchAllowed() : false});
          }
        } finally { orFetch = originalFetch; }
        return results;
      });
      assert.deepEqual(result[0], result[1], 'face treatment must have no effect when no photo is attached');
      assert.equal(result[0].contract, '');
      assert.equal(result[0].allowed, false);
      assert.match(result[0].full, /Invent an ORIGINAL face/);
      assert.match(result[0].lean, /FACE: an original believable Korean/);
    });
    await t.test('the chosen shot sets the pose and the time of day; only standing shots keep the standing rules', async () => {
      const cases = await page.evaluate(async () => {
        const originalFetch = orFetch, results = [];
        let director = '';
        orFetch = async payload => {
          director = payload.messages[0].content.find(part => part.type === 'text').text;
          return {choices:[{message:{content:'{}'}}]};
        };
        const photo = 'data:image/png;base64,AA==';
        const equip = (level, ids, grades) => LABS[level].map((station, index) => ({
          ...(station.experiments.find(e => e.id === ids[index]) || station.experiments[0]),
          slot:station.slot, slotEn:station.slotEn, ok:grades[index] !== 'miss', grade:grades[index]
        }));
        const run = (profile, shot, shotFree) => {
          Object.assign(state, {photoFace:'', faceTreatment:'original', role:'재난 현장 구조대원', motifsFree:'거미', motifsEn:'spider',
            motifCues:'', palette:'', signature:'', shotEn:'', ...profile, shot, shotFree});
          const full = buildPrompt(''), lean = buildLeanPrompt({picture:'A hero in the chosen scene.', garment:'A costume.'});
          return {full, lean};
        };
        try {
          const ok4 = ['ok', 'ok', 'ok', 'ok'];
          const shots = [...SHOTS.filter(s => !s.free).map(s => [s.id, '']), ['custom', '도서관 창가에 앉아 책을 읽고 있다']];
          const profiles = [
            {photo, glasses:'no', age:'15', gender:'boy', name:'Pose test', level:'middle'},
            {photo:'', glasses:'', age:'8', gender:'girl', name:'-Pose test-', level:'middle'},
            {photo, glasses:'no', age:'8', gender:'boy', name:'-Pose test-', level:'elementary'}
          ];
          for (const profile of profiles) for (const traits of ['조용하지만 강한', '느긋하고 침착한', '']) for (const [shot, shotFree] of shots) {
            state.loadout = equip(profile.level, ['oobleck', 'fruitcell', profile.level === 'middle' ? 'spectrum' : 'rainbow', 'hydrophobic'], ok4);
            const out = run({...profile, traits}, shot, shotFree);
            director = '';
            await askDirector();
            results.push({...out, shot, free:shotFree, traits, photo:!!profile.photo, age:profile.age, gender:profile.gender,
              legend:isLegend(), pose:shotPose(), director});
          }
          // 추진 장비: 점수가 높으면 몸이 떠오르고, 낮으면 앞으로 기울기만 한다
          const thrust = {};
          for (const [key, level, ids, grades] of [
            ['gasStrong', 'middle', ['oobleck', 'gas', 'spectrum', 'hydrophobic'], ok4],
            ['gasWeak', 'middle', ['oobleck', 'gas', 'spectrum', 'hydrophobic'], ['miss', 'ok', 'miss', 'miss']],
            ['gasTwo', 'middle', ['oobleck', 'gas', 'spectrum', 'hydrophobic'], ['ok', 'ok', 'miss', 'miss']],
            ['gasThree', 'middle', ['oobleck', 'gas', 'spectrum', 'hydrophobic'], ['ok', 'ok', 'ok', 'miss']],
            ['balloonStrong', 'elementary', ['oobleck', 'balloon', 'rainbow', 'hydrophobic'], ok4]
          ]) {
            state.loadout = equip(level, ids, grades);
            thrust[key] = run({photo:'', glasses:'', age:'14', gender:'neutral', name:'Thrust test', level, traits:'조용하지만 강한'}, 'activate', '');
          }
          // 전설 등급이 아닌 여자 히어로: 낮은 점수(1)와 높은 점수(4)의 조명 줄이 모두 푸른 하늘을 지켜야 한다
          const rooftopGirls = [['miss', 'ok', 'miss', 'miss'], ok4].map(grades => {
            state.loadout = equip('middle', ['oobleck', 'fruitcell', 'spectrum', 'hydrophobic'], grades);
            return run({photo:'', glasses:'', age:'15', gender:'girl', name:'Rooftop test', level:'middle', traits:'조용하지만 강한'}, 'rooftop', '');
          });
          return {results, thrust, rooftopGirls};
        } finally { orFetch = originalFetch; }
      });
      // 예전에는 '히어로 랜딩'을 골라도 이 문장들이 착지 자세를 덮어 서 있는 그림이 나왔다.
      const daylightLine = /no night scene|outdoors under a bright sky|pale sky, sunlit haze|clean directional daylight|Daylight, golden hour|light airy background/;
      const standing = /standing action pose about capability, and the camera|full-length standing shot|soles on the ground|standing as tall as|both feet flat|low planted stance with the feet apart|bouncing on the toes|HOW THIS PERSON STANDS|TEMPERAMENT pose is followed exactly|weight planted|temperament's stance/;
      for (const entry of cases.results) {
        const context = `${entry.shot} ${entry.gender} ${entry.age}${entry.photo ? ' photo' : ''} trait '${entry.traits}'`;
        if (['poster', 'rooftop'].includes(entry.shot)) {
          assert.equal(entry.pose, '', context + ': a standing shot sets no pose of its own');
          assert.match(entry.full, /The pose is a standing action pose about capability/, context);
          assert.doesNotMatch(entry.lean, /★ THE BODY/, context);
        } else {
          assert.ok(entry.pose, context + ': this shot sets the pose');
          for (const part of ['full', 'lean']) {
            assert.doesNotMatch(entry[part], standing, `${context} ${part}: no standing rule overrides the chosen pose`);
          }
          assert.ok(entry.lean.includes(entry.pose), context + ': the image prompt states the pose');
          assert.ok(entry.full.split('crown to hip joint, hip joint to sole').length - 1 >= 2, context + ': age is measured along a posed body');
          assert.match(entry.full, /FOR THIS PICTURE THE CHOSEN SHOT SETS THE POSE/, context + ': the temperament is carried inside the pose');
          if (entry.age === '8') assert.match(entry.full, /midpoint of the body measured along it/, context);
          if (entry.traits === '조용하지만 강한') assert.match(entry.director, /단, 이번 촬영 컷\(.+\)은 몸의 자세까지 정한다\. 성격은 그 자세 안에서 어깨, 손, 무게 중심으로 드러내고/, context + ': the designer is told the shot sets the pose');
          if (entry.shot !== 'activate') {
            assert.ok(entry.lean.includes('★ THE BODY: ' + entry.pose), context);
            assert.ok(entry.full.includes('THE BODY IN THIS SHOT: ' + entry.pose), context);
            assert.match(entry.full, /4a-POSE\. THE BODY\./, context);
            assert.ok(entry.full.includes('This student chose a shot that sets what the body is doing: ' + entry.pose),
              context + ': the modesty section, which wins conflicts, hands the pose to the shot');
            if (entry.legend) assert.match(entry.full, /THE BEARING LINE ABOVE IS ADJUSTED/, context);
            assert.match(entry.full, /none of them is a reason to stand the hero up/, context);
          }
        }
        if (entry.shot === 'landing') {
          assert.match(entry.lean, /ONE KNEE ON THE GROUND/);
          assert.match(entry.lean, /ONE FIST pressed onto the ground/);
          assert.match(entry.lean, /bottom two-fifths below them is open, plain wet ground/, context + ': the crouch stays above the poster title band');
          assert.match(entry.full, /camera down near the ground, because the crouched head is down there/);
          assert.match(entry.full, /lower two-fifths of the frame, below the knee and the fist on the ground/, context);
          assert.ok(entry.full.includes('stays inside the frame (for a landing: the top of the head'), context + ': the framing aside is closed');
          for (const part of ['full', 'lean']) {
            assert.ok(entry[part].includes('the camera close to the ground at the height of the crouched head'), `${context} ${part}: the camera is level with the crouched head`);
            assert.doesNotMatch(entry[part], /low-angle/, `${context} ${part}: no camera looking up at the child`);
          }
          assert.match(entry.director, /낮게 찍은 컷/, context + ': the card text the director reads');
          assert.doesNotMatch(entry.director, /올려다/, context + ': the director is not told to look up at the child');
          if (entry.legend) assert.match(entry.full, /CAMERA line is measured from the crouched head/, context);
        }
        if (entry.shot === 'backlit') assert.match(entry.full, /wide full-length shot/, context);
        if (entry.shot === 'custom') {
          assert.match(entry.full, /Do not overrule it with a different pose/, context);
          assert.ok(entry.lean.includes('no other line on this page changes it'), context + ': a student-written standing scene is not argued with');
          assert.doesNotMatch(entry.lean, /turns it back into a still standing pose/, context);
        }
        if (entry.shot === 'bench' && !entry.photo) assert.doesNotMatch(entry.full + entry.lean, /photographed head pose/, context);
        if (entry.shot === 'rooftop') {
          assert.match(entry.lean, /★ THE TIME OF DAY: blue hour/, context);
          assert.match(entry.full, /THE TIME OF DAY IS PART OF WHAT THEY CHOSE/, context);
          if (entry.gender === 'girl') for (const part of ['full', 'lean']) {
            assert.doesNotMatch(entry[part], daylightLine,
              `${context} ${part}: the bright girl-hero light keeps the chosen blue hour`);
          }
        }
        if (entry.age === '8') {
          const keepsScene = entry.shot === 'rooftop' || entry.shot === 'custom';
          assert.equal(/put bright warm light on the whole scene/.test(entry.full), !keepsScene, context + ': the young-child warm light respects a chosen time of day');
          if (keepsScene) assert.match(entry.full, /never brightens dusk or night into day/, context);
        }
        if (entry.age === '8') {
          assert.match(entry.full, /it must land ABOVE the hip joint, on the lower belly/, context + ': a child has the midpoint above the hip');
          assert.doesNotMatch(entry.full, /must land BELOW the hip/, context);
        }
        assert.match(entry.full, /So the hip line sits BELOW the midpoint of this figure/, context + ': short legs put the hip below the midpoint');
        if (entry.gender === 'boy' && entry.age === '8') assert.doesNotMatch(entry.full + entry.lean, /low planted stance/, context + ': a primary-school boy keeps the child stance');
        if (entry.gender === 'boy' && entry.age === '15' && entry.shot === 'poster') assert.match(entry.lean, /low planted stance with the feet apart/, context);
        if (entry.legend) {
          assert.equal(/THE HEAD IS THE EXCEPTION/.test(entry.full), entry.photo, context + ': the legend camera line follows the photo');
          assert.equal(/Chin level, looking straight down the lens/.test(entry.full), !entry.photo, context + ': the legend bearing line follows the photo');
        }
        if (entry.shot === 'custom' && entry.traits === '조용하지만 강한') assert.match(entry.director, /학생이 적은 장면과 다른 자세를 쓰지 마라/, context);
      }
      const {gasStrong, gasWeak, gasTwo, gasThree, balloonStrong} = cases.thrust;
      assert.match(gasStrong.lean, /both boots just off the ground/);
      assert.match(gasStrong.full, /The hero is already off the ground/);
      assert.match(gasWeak.lean, /weak push of the thrust/);
      assert.doesNotMatch(gasWeak.full + gasWeak.lean, /already off the ground/, 'a weak thruster cannot lift the hero');
      assert.match(balloonStrong.lean, /slightly up by the thrust/);
      for (const entry of [gasStrong, gasWeak, balloonStrong]) assert.doesNotMatch(entry.lean, /weight on one foot/, 'a thruster pushes the hero instead of planting them');
      assert.doesNotMatch(gasTwo.full + gasTwo.lean, /already off the ground|both boots just off the ground/, 'score 2 still cannot lift the hero');
      assert.match(gasThree.lean, /both boots just off the ground/, 'score 3 lifts the hero');
      assert.match(gasThree.full, /The hero is already off the ground/, 'score 3 lifts the hero');
      for (const entry of [gasStrong, gasWeak, gasTwo, gasThree, balloonStrong]) {
        assert.ok(entry.full.includes('for this thruster that is the push itself'), 'the rulebook body follows the thruster');
        assert.doesNotMatch(entry.full, /weight thrown onto one foot|braced legs against a recoil/, 'the rulebook does not plant a thruster');
      }
      for (const entry of cases.rooftopGirls) for (const part of ['full', 'lean']) {
        assert.match(entry[part], /LIGHT: bright and clean INSIDE the chosen scene/, part + ': a non-legend girl keeps the blue hour');
        assert.doesNotMatch(entry[part], daylightLine, part);
      }
    });

    assert.deepEqual(errors, []);
  });
}
