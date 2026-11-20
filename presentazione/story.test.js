import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { story } from './src/story.js';

test('the presentation preserves the PowerPoint order and links to existing sources', () => {
  assert.deepEqual(story.map(slide => slide.name), [
    'LiveArch', 'Problema', 'In 30 secondi', 'Steering', 'Specs', 'Skills', 'Hooks', 'Quattro livelli',
    'Pipeline', 'Demo', 'Output', 'Salvaguardie', 'Estensioni', 'Regressione', 'Criteri', 'Grazie',
  ]);
  for (const slide of story) {
    assert.ok(Number.isInteger(slide.scene) && slide.scene >= 0 && slide.scene <= 5, slide.name);
    for (const file of [slide.path, ...(slide.related ?? [])]) {
      assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), file);
    }
  }
  assert.equal(story[3].items.length, 8);
  assert.equal(story[6].items.length, 7);
  assert.match(story[10].snippet, /flowchart LR/);
  assert.match(story[15].commands, /stop_gate\.py/);
});