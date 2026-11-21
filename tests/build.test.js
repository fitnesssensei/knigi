/* ============================================================
   Автотесты сборки: node --test tests/
   Проверяют cli-модуль scripts/lib/build.js: склейку partials,
   встраивание CSS/JS/шрифтов, состав dist и архива, детерминизм.
   ============================================================ */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { build, inlineAssets, expandIncludes, PAGES } = require('../scripts/lib/build');

const ROOT = path.join(__dirname, '..');
const EXTERNAL_ASSETS = /(?:href|src)="assets\//;

// Отдельная временная папка на каждый тест — тесты не мешают друг другу
function makeTmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('build: собирает три страницы и архив, убирает временную папку', (t) => {
  const dist = makeTmpDir('knigi-build-');
  t.after(() => fs.rmSync(dist, { recursive: true, force: true }));

  const result = build({ root: ROOT, dist, quiet: true });

  assert.deepStrictEqual(Object.keys(result.pages).sort(), PAGES.slice().sort());
  for (const page of PAGES) {
    assert.ok(fs.existsSync(path.join(dist, page)), 'не собрана страница ' + page);
  }
  assert.ok(fs.existsSync(result.zipPath), 'не собран архив');
  assert.ok(!fs.existsSync(path.join(dist, '.stage')), 'временная папка .stage осталась');
});

test('build: страницы автономные — нет ссылок на assets/, include раскрыты', (t) => {
  const dist = makeTmpDir('knigi-autonomy-');
  t.after(() => fs.rmSync(dist, { recursive: true, force: true }));
  build({ root: ROOT, dist, makeArchive: false, quiet: true });

  for (const page of PAGES) {
    const html = fs.readFileSync(path.join(dist, page), 'utf8');
    assert.ok(!EXTERNAL_ASSETS.test(html), page + ': остались внешние ссылки на assets/');
    assert.ok(!html.includes('<!-- include:'), page + ': остались нераскрытые include');
    assert.ok(html.includes('<style data-inlined="assets/css/fonts.css">'), page + ': нет встроенных шрифтов');
    assert.match(html, /data:font\/woff2;base64,[A-Za-z0-9+/=]+/, page + ': шрифты не в base64');
    assert.ok(!html.includes("url('../fonts/"), page + ': остались относительные url шрифтов');
  }
});

test('build: повторная сборка даёт те же HTML (детерминизм)', (t) => {
  const first = makeTmpDir('knigi-det-1-');
  const second = makeTmpDir('knigi-det-2-');
  t.after(() => {
    fs.rmSync(first, { recursive: true, force: true });
    fs.rmSync(second, { recursive: true, force: true });
  });

  build({ root: ROOT, dist: first, makeArchive: false, quiet: true });
  build({ root: ROOT, dist: second, makeArchive: false, quiet: true });

  for (const page of PAGES) {
    const a = fs.readFileSync(path.join(first, page), 'utf8');
    const b = fs.readFileSync(path.join(second, page), 'utf8');
    assert.strictEqual(a, b, page + ': сборка не воспроизводима');
  }
});

test('build: в архиве две автономные страницы и лицензии шрифтов', (t) => {
  const dist = makeTmpDir('knigi-zip-');
  t.after(() => fs.rmSync(dist, { recursive: true, force: true }));
  const { zipPath } = build({ root: ROOT, dist, quiet: true });

  // Читаем оглавление zip как текст: имена файлов лежат в заголовках без сжатия
  const listing = fs.readFileSync(zipPath).toString('latin1');
  for (const entry of [
    'gory-knig/desktop.html',
    'gory-knig/mobile.html',
    'gory-knig/licenses/LICENSE-Inter.txt',
    'gory-knig/licenses/LICENSE-Cormorant-Garamond.txt',
  ]) {
    assert.ok(listing.includes(entry), 'в архиве нет ' + entry);
  }
  assert.ok(!listing.includes('gory-knig/index.html'), 'в архиве лишний index.html');
});

test('inlineAssets: встраивает CSS и JS, подменяет шрифты на base64', () => {
  const css = inlineAssets('<link rel="stylesheet" href="assets/css/fonts.css">', ROOT);
  assert.ok(css.startsWith('<style data-inlined="assets/css/fonts.css">'));
  assert.ok(css.includes("url('data:font/woff2;base64,"), 'шрифты не встроены');
  assert.ok(!css.includes("url('../fonts/"), 'остались относительные url');

  const js = inlineAssets('<script src="assets/js/data.js"></script>', ROOT);
  assert.ok(js.startsWith('<script data-inlined="assets/js/data.js">'), 'скрипт не встроен');
  assert.ok(js.includes('GORY_KNIG_BOOKS'), 'содержимое скрипта потерялось');
});

test('expandIncludes: падает с понятной ошибкой на отсутствующий partial', (t) => {
  const dir = makeTmpDir('knigi-missing-');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const page = path.join(dir, 'page.html');
  fs.writeFileSync(page, '<!-- include: partials/nope.html -->\n');

  assert.throws(() => expandIncludes(page, dir), /не найден partial: partials\/nope\.html/);
});

