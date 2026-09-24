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
    assert.deepEqual(errors, []);
  });
}
