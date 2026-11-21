/* ============================================================
   Автотест страницы выбора версии (src/pages/index.html):
   по ширине экрана подсвечивается нужная карточка и текст подсказки.
   ============================================================ */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const { makeElement } = require('./helpers/dom');

const ROOT = path.join(__dirname, '..');
const INDEX_HTML = path.join(ROOT, 'src/pages/index.html');

// Встроенный скрипт страницы выбора версии
function indexScript() {
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(match, 'в index.html нет встроенного скрипта');
  return match[1];
}

// Прогоняем скрипт с заданной шириной экрана
function runWithWidth(isWide) {
  const desktop = makeElement();
  const mobile = makeElement();
  const hint = makeElement();
  const document = {
    querySelector: (sel) => (sel === '[data-entry="desktop"]' ? desktop : sel === '[data-entry="mobile"]' ? mobile : null),
    getElementById: (id) => (id === 'entry-hint' ? hint : null),
  };
  const window = { matchMedia: () => ({ matches: isWide }), innerWidth: isWide ? 1280 : 390 };

  vm.runInNewContext(indexScript(), { window, document }, { filename: 'index-inline.js' });
  return { desktop, mobile, hint };
}

test('index: на широком экране подсвечивается настольная версия', () => {
  const { desktop, mobile, hint } = runWithWidth(true);
  assert.strictEqual(desktop.attrs['data-current'], 'true');
  assert.strictEqual(mobile.attrs['data-current'], undefined);
  assert.ok(hint.textContent.includes('больше 900'), 'подсказка не про настольную версию');
});

test('index: на узком экране подсвечивается мобильная версия', () => {
  const { desktop, mobile, hint } = runWithWidth(false);
  assert.strictEqual(mobile.attrs['data-current'], 'true');
  assert.strictEqual(desktop.attrs['data-current'], undefined);
  assert.ok(hint.textContent.includes('меньше 900'), 'подсказка не про мобильную версию');
});
