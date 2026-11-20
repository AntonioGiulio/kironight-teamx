import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/manrope';
import '@fontsource/ibm-plex-mono/latin-500.css';
import './style.css';
import { repo, sourceUrl, story } from './story.js';
import { createScene } from './scene.js';

const icons = {
  core: '<path d="M12 2.5 21 7.7v8.6l-9 5.2-9-5.2V7.7L12 2.5Z"/><path d="m3 7.7 9 5.1 9-5.1m-9 5.1v8.7M7.5 5.1l9 5.2v3.4"/>',
  spec: '<path d="M6 3h8l4 4v14H6zM14 3v5h4M9 11h6M9 15h6M9 18h4"/>',
  steer: '<circle cx="12" cy="12" r="9"/><path d="m15.8 8.2-2 5.6-5.6 2 2-5.6z"/>',
  skill: '<path d="M12 3 2.8 8 12 13l9.2-5L12 3ZM3 12l9 5 9-5M3 16l9 5 9-5"/>',
  hook: '<path d="m13 2-8 12h6l-1 8 9-12h-6l1-8z"/>',
  sync: '<path d="M20 8a8.5 8.5 0 0 0-14-2L3 9m0 0V3m0 6h6m-5 7a8.5 8.5 0 0 0 14 2l3-3m0 0v6m0-6h-6"/>',
  expand: '<path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5"/>',
  close: '<path d="m5 5 14 14M19 5 5 19"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  external: '<path d="M7 17 17 7M8 7h9v9"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const $ = selector => document.querySelector(selector);
const escapeCode = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const brief = $('#brief');
const route = $('#route');
const dialog = $('#evidence');
const fullscreen = $('#fullscreen');
let stage = 0;
let world;

for (const element of document.querySelectorAll('[data-icon]')) element.innerHTML = icon(element.dataset.icon);

function showSchematic() {
  $('#world').hidden = true;
  $('.schematic').removeAttribute('hidden');
}

try {
  const canvas = $('#world');
  world = createScene(canvas);
  canvas.addEventListener('webglcontextlost', showSchematic);
  canvas.addEventListener('webglcontextrestored', () => {
    $('.schematic').setAttribute('hidden', '');
    canvas.hidden = false;
    world.resize();
  });
  new ResizeObserver(() => world.resize()).observe($('.visual'));
} catch {
  showSchematic();
}

const lastStage = story.length - 1;
const number = index => String(index + 1).padStart(2, '0');
route.innerHTML = story.map((item, i) => `
  <button type="button" class="step" style="--step-color:${item.color}" data-stage="${i}" aria-label="${number(i)} · ${item.name}" title="${item.name}">
    ${icon(item.icon)}<span>${number(i)}</span>
  </button>`).join('');
$('#route-total').textContent = `${story.length} TAPPE`;

function render() {
  const page = story[stage];
  const finale = stage === lastStage;
  const next = stage === 0 ? 'Inizia il viaggio' : finale ? 'Torna all’inizio' : 'Avanti';
  document.documentElement.style.setProperty('--accent', page.color);
  document.body.dataset.stage = stage;
  document.body.classList.toggle('text-led', Boolean(page.items));
  brief.classList.toggle('brief-intro', stage === 0);
  brief.innerHTML = `
    <div class="eyebrow"><span></span>${page.eyebrow}</div>
    <h1 id="chapter-title" tabindex="-1">${page.title[0]}${page.title[1] ? `<br><em>${page.title[1]}</em>` : ''}</h1>
    ${page.description ? `<p class="description">${page.description}</p>` : ''}
    ${page.items ? `<dl class="slide-items ${page.items.length < 4 ? 'slide-items-short' : ''}">${page.items.map(([label, text]) => `<div><dt>${label}</dt><dd>${text}</dd></div>`).join('')}</dl>` : ''}
    ${page.takeaway ? `<p class="takeaway">${page.takeaway}</p>` : ''}
    ${page.commands ? `<pre class="commands"><code>${escapeCode(page.commands)}</code></pre>` : ''}
    <div class="actions">
      <button type="button" class="primary" data-action="next">${next}${icon(finale ? 'sync' : 'arrow')}</button>
      ${finale ? `<a class="text-button" href="${repo}" target="_blank" rel="noopener noreferrer">${icon('external')} Repository GitHub</a>` : ''}
      <button type="button" class="text-button" data-action="evidence">${icon('spec')} ${page.snippetLabel ? 'Mermaid e fonti' : 'Fonti dal repo'} ${icon('external')}</button>
    </div>`;
  $('#stage-title').textContent = page.stage;
  $('#stage-index').textContent = `${number(stage)} / ${number(lastStage)}`;
  $('#stage-model').textContent = page.model;
  route.querySelector('[aria-current]')?.removeAttribute('aria-current');
  route.children[stage].setAttribute('aria-current', 'step');
}

function go(index) {
  if (!Number.isInteger(index) || !story[index] || stage === index) return;
  stage = index;
  world?.setStage(story[stage].scene);
  render();
  $('#chapter-title').focus({ preventScroll: true });
  if (matchMedia('(max-width: 760px)').matches) brief.scrollIntoView({ block: 'start' });
}

function openEvidence() {
  const { name, snippet, snippetLabel, path, related = [] } = story[stage];
  $('#evidence-content').innerHTML = `
    <div class="dialog-head"><span class="eyebrow"><span></span> ${name} / APPROFONDIMENTO</span>
    <button class="icon-button" type="button" data-action="close" aria-label="Chiudi le fonti" autofocus>${icon('close')}</button></div>
    <h2 id="evidence-title">${snippetLabel ?? 'Fonti dal repo'}</h2>
    ${snippet ? `<pre><code>${escapeCode(snippet)}</code></pre>` : ''}
    <div class="source-links">${[path, ...related].map(file => `<a class="source-link" href="${sourceUrl(file)}" target="_blank" rel="noopener noreferrer">${icon('external')} <span>${file}</span></a>`).join('')}</div>`;
  dialog.showModal();
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    $('#browser-status').textContent = 'Schermo intero non disponibile in questo browser.';
  }
}

brief.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.action === 'next') go(stage === lastStage ? 0 : stage + 1);
  if (button.dataset.action === 'evidence') openEvidence();
});
route.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (button) go(Number(button.dataset.stage));
});
dialog.addEventListener('click', event => {
  if (event.target === dialog || event.target.closest('[data-action="close"]')) dialog.close();
});
fullscreen.hidden = !document.fullscreenEnabled;
fullscreen.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', () => {
  const active = !!document.fullscreenElement;
  const label = active ? 'Esci da schermo intero' : 'Schermo intero';
  fullscreen.title = label;
  fullscreen.setAttribute('aria-label', label);
  fullscreen.innerHTML = icon(active ? 'close' : 'expand');
});
window.addEventListener('keydown', event => {
  if (dialog.open || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    if (document.activeElement?.tagName === 'A') return;
    event.preventDefault();
    go(stage + (event.key === 'ArrowRight' ? 1 : -1));
  }
  if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault();
    go(event.key === 'Home' ? 0 : lastStage);
  }
  if (event.key.toLowerCase() === 'f' && document.fullscreenEnabled) toggleFullscreen();
});

render();
