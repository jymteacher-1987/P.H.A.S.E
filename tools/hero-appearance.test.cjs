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
              photoFace:'', name:'Appearance test', shot:'poster', motifsFree:'거미', motifsEn:'spider',
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
          gender:'girl', level:'middle', loadout:[]});
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
    assert.deepEqual(errors, []);
  });
}
