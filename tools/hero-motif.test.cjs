const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium, webkit} = require('playwright');

const html = fs.readFileSync(path.join(__dirname, '../plays/hero-maker.html'), 'utf8');

for (const engine of [chromium, webkit]) {
  test(`hero motifs follow the student's selection (${engine.name()})`, {timeout:60000}, async t => {
    const browser = await engine.launch({headless:true});
    t.after(() => browser.close());
    const page = await browser.newPage(), errors = [], remotePosts = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      if (route.request().method() === 'POST') remotePosts.push(route.request().url());
      return route.request().resourceType() === 'document'
        ? route.fulfill({contentType:'text/html; charset=utf-8', body:html}) : route.abort();
    });
    await page.goto('https://phase-motif.test/');

    await t.test('chips and direct input share one ordered selection, including deselection', async () => {
      await page.evaluate(() => {state.motifsFree = ''; go('identity');});
      const presets = await page.evaluate(() => MOTIF_PRESETS.slice(0, 3).map(p => stripEmoji(p.ko)));
      const snapshot = () => page.evaluate(() => ({selected:allMotifs(),
        active:[...document.querySelectorAll('[data-motif].on')].map(b => stripEmoji(b.dataset.motif))}));
      assert.deepEqual(await snapshot(), {selected:[], active:[]});
      const chips = page.locator('[data-motif]');
      await chips.nth(0).click();
      await chips.nth(1).click();
      assert.deepEqual(await snapshot(), {selected:presets.slice(0, 2), active:presets.slice(0, 2)});
      assert.equal(await chips.nth(2).isDisabled(), true, 'unselected suggestions do not join a full selection');
      await chips.nth(0).click();
      assert.deepEqual(await snapshot(), {selected:[presets[1]], active:[presets[1]]});
      assert.equal(await chips.nth(2).isDisabled(), false);
      await chips.nth(2).click();
      assert.deepEqual((await snapshot()).selected, [presets[1], presets[2]]);
      await page.locator('#motifsFree').fill(presets[0]);
      assert.deepEqual(await snapshot(), {selected:[presets[0]], active:[presets[0]]});
      await page.locator('#motifsFree').fill('');
      assert.deepEqual(await snapshot(), {selected:[], active:[]});
    });

    await t.test('zero, one and two selected motifs remain authoritative after reordered or extra AI names', async () => {
      const cases = await page.evaluate(async () => {
        Object.assign(state, {name:'Motif test', age:'15', gender:'neutral', level:'middle',
          photo:'', photoFace:'', glasses:'', loadout:[], palette:'', signature:'', shot:'poster'});
        const presets = MOTIF_PRESETS.slice(0, 2);
        const cases = [{selected:'', expected:[]},
          {selected:stripEmoji(presets[0].ko), expected:[presets[0].en]},
          {selected:`${stripEmoji(presets[0].ko)}, ${stripEmoji(presets[1].ko)}`, expected:presets.map(p => p.en)},
          {selected:`paper boat, ${stripEmoji(presets[0].ko)}`, expected:['paper boat', presets[0].en]},
          {selected:'푸른 종이배', expected:['푸른 종이배']}];
        const results = [];
        const originalFetch = orFetch;
        try {
          for (const {selected, expected} of cases) {
            state.motifsFree = selected;
            let directorInstruction = '', cinematographerInstruction = '';
            orFetch = async payload => {
              directorInstruction = payload.messages[0].content.find(p => p.type === 'text').text;
              return {choices:[{message:{content:JSON.stringify({heroName:'',
                motifsEn:`${presets[1].en}, UNSELECTED_MOTIF_TOKEN, ${presets[0].en}`,
                motifCues:'UNSELECTED_MOTIF_TOKEN|UNSELECTED_LOOK_TOKEN|UNSELECTED_POWER_TOKEN',
                artDirection:'A coherent costume with the selected shapes.'})}}]};
            };
            const response = await askDirector();
            state.motifsEn = response.motifsEn; state.motifCues = response.motifCues;
            const full = buildPrompt(response.artDirection), rule = motifSelectionRule();
            orFetch = async payload => {
              cinematographerInstruction = payload.messages[0].content.find(p => p.type === 'text').text;
              return {choices:[{message:{content:JSON.stringify({picture:'A standing hero.', person:'An ordinary student.',
                garment:'A fitted costume.', motif:'The selected shapes meet at shared seams.',
                head:'An open headpiece.'})}}]};
            };
            const brief = await askCinematographer(full);
            results.push({selected, expected, english:motifListEn(), cueNames:lastCueList.map(c => c.en),
              rule, full, lean:buildLeanPrompt(brief), headline:leanHeadline(), facts:motifFacts(),
              directorInstruction, cinematographerInstruction});
          }
        } finally {orFetch = originalFetch;}
        return results;
      });
      for (const entry of cases) {
        assert.deepEqual(entry.english, entry.expected, entry.selected + ': AI may not replace selected names');
        assert.deepEqual(entry.cueNames, entry.expected, entry.selected + ': cue order follows the user');
        assert.ok(entry.rule.length > 0, 'even zero selections must have a closed-list rule');
        for (const mode of ['full', 'lean', 'directorInstruction', 'cinematographerInstruction']) {
          assert.ok(entry[mode].includes(entry.rule), `${mode}: the same authoritative selection must reach every generation stage`);
        }
        for (const mode of ['full', 'lean', 'headline', 'facts']) {
          assert.doesNotMatch(entry[mode], /UNSELECTED_(?:MOTIF|LOOK|POWER)_TOKEN/, mode + ': unrelated response content must not become motif facts');
          for (const name of entry.expected) assert.ok(entry[mode].includes(name.toUpperCase()), `${mode}: ${name} remains present`);
        }
        if (!entry.expected.length) {
          assert.equal(entry.headline, ''); assert.equal(entry.facts, '');
        }
        assert.doesNotMatch(entry.full, /Worked examples of the level required|^- (?:CHEETAH|OWL|PUFFERFISH|TYPHOON|MAGNET|OLD BOOK) →/m,
          'unselected worked examples must not enter the prompt');
      }
    });

    await t.test('custom cues require the exact original name; preset facts cannot be replaced', async () => {
      const result = await page.evaluate(() => {
        state.motifsFree = 'paper boat'; state.motifsEn = 'UNSELECTED_MOTIF_TOKEN';
        state.motifCues = '  PaPeR   BoAt  |SELECTED_LOOK_TOKEN|SELECTED_POWER_TOKEN';
        const exact = buildPrompt('');
        const exactCue = structuredClone(lastCueList);
        state.motifCues = 'paper boat extra|FUZZY_LOOK_TOKEN|FUZZY_POWER_TOKEN\nUNSELECTED_MOTIF_TOKEN|UNSELECTED_LOOK_TOKEN|UNSELECTED_POWER_TOKEN';
        const fallback = buildPrompt(''), fallbackLean = buildLeanPrompt({});
        const fallbackCue = structuredClone(lastCueList);
        const preset = MOTIF_PRESETS[0]; state.motifsFree = stripEmoji(preset.ko);
        state.motifCues = `${stripEmoji(preset.ko)}|OVERRIDE_LOOK_TOKEN|OVERRIDE_POWER_TOKEN`;
        const fixed = buildPrompt('');
        return {exact, exactCue, fallback, fallbackLean, fallbackCue, fixed,
          fixedCue:structuredClone(lastCueList), preset:{en:preset.en, d:preset.d, f:preset.f}};
      });
      assert.deepEqual(result.exactCue, [{en:'paper boat', d:'SELECTED_LOOK_TOKEN', f:'SELECTED_POWER_TOKEN'}]);
      assert.match(result.exact, /SELECTED_LOOK_TOKEN/); assert.match(result.exact, /SELECTED_POWER_TOKEN/);
      assert.deepEqual(result.fallbackCue, [{en:'paper boat', d:'', f:''}]);
      for (const prompt of [result.fallback, result.fallbackLean]) {
        assert.ok(prompt.includes('PAPER BOAT'));
        assert.doesNotMatch(prompt, /FUZZY_(?:LOOK|POWER)_TOKEN|UNSELECTED_(?:MOTIF|LOOK|POWER)_TOKEN/);
      }
      assert.deepEqual(result.fixedCue, [result.preset]);
      assert.doesNotMatch(result.fixed, /OVERRIDE_(?:LOOK|POWER)_TOKEN/);
    });
    assert.deepEqual(errors, []);
    assert.deepEqual(remotePosts, [], 'all AI replies were local mocks; no generation requests are allowed');
  });
}
