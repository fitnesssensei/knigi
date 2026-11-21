/* ============================================================
   Автотесты разметки: node --test tests/
   Проверяют partials (все ли на месте, нет ли лишних) и собранные
   страницы: уникальность id, обязательные блоки, отсутствие
   удалённых элементов (панель поиска, сортировка в тулбаре).
   ============================================================ */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { expandIncludes, PAGES } = require('../scripts/lib/build');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const PARTIALS = path.join(SRC, 'partials');
const INCLUDE_RE = /^<!-- include: (.+?) -->$/gm;

// Собранный HTML страницы (без инлайна ассетов)
function pageHtml(name) {
  return expandIncludes(path.join(SRC, 'pages', name), SRC);
}

// Все файлы partials в проекте
function listPartials(dir = PARTIALS) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listPartials(full));
    else out.push(full);
  }
  return out;
}

function ids(html) {
  return Array.from(html.matchAll(/\sid="([^"]+)"/g), (m) => m[1]);
}

test('partials: все include существуют и не пустые', () => {
  for (const page of PAGES) {
    const template = fs.readFileSync(path.join(SRC, 'pages', page), 'utf8');
    const includes = Array.from(template.matchAll(INCLUDE_RE), (m) => m[1]);
    if (page !== 'index.html') {
      assert.ok(includes.length > 0, page + ': нет ни одного include');
    }

    for (const rel of includes) {
      const partial = path.join(SRC, rel);
      assert.ok(fs.existsSync(partial), page + ': нет файла ' + rel);
      assert.ok(fs.readFileSync(partial, 'utf8').trim().length > 0, rel + ': пустой partial');
    }
  }
});

test('partials: нет неиспользуемых файлов', () => {
  const used = new Set();
  for (const page of PAGES) {
    const template = fs.readFileSync(path.join(SRC, 'pages', page), 'utf8');
    for (const m of template.matchAll(INCLUDE_RE)) used.add(path.join(SRC, m[1]));
  }
  const orphans = listPartials().filter((file) => !used.has(file));
  assert.deepStrictEqual(orphans, [], 'не подключены к страницам: ' + orphans.join(', '));
});

test('страницы: include раскрыты, id уникальны', () => {
  for (const page of PAGES) {
    const html = pageHtml(page);
    assert.ok(!html.includes('<!-- include:'), page + ': остались include');
    const all = ids(html);
    const dupes = all.filter((id, i) => all.indexOf(id) !== i);
    assert.deepStrictEqual(Array.from(new Set(dupes)), [], page + ': повторяются id');
  }
});

test('мобильная: поиск в шапке, панели поиска нет', () => {
  const html = pageHtml('mobile.html');
  assert.ok(html.includes('<div class="shell header__search">'), 'нет строки поиска в шапке');
  assert.ok(html.includes('class="search-field"'), 'нет поля поиска');
  assert.ok(html.includes('data-search'), 'у поля поиска нет data-search');
  assert.ok(!html.includes('data-panel="search"'), 'осталась панель поиска');
  assert.ok(!html.includes('data-open-panel="search"'), 'осталась иконка поиска');
});

test('мобильная: бургер-меню с жанрами и сортировкой в фильтрах', () => {
  const html = pageHtml('mobile.html');
  assert.ok(html.includes('data-open-panel="menu"'), 'нет кнопки меню');
  assert.ok(html.includes('data-panel="menu"'), 'нет панели меню');
  assert.ok(html.includes('data-menu-categories'), 'нет кнопки «Категории»');
  assert.ok(html.includes('aria-controls="menu-categories"'), 'нет связи кнопки и списка');
  assert.ok(html.includes('id="menu-categories"'), 'нет списка жанров');
  assert.ok(!html.includes('toolbar__sort'), 'сортировка всё ещё в тулбаре');

  // Жанры (data-category) должны быть только внутри панели меню
  const catalogPart = html.slice(html.indexOf('<section class="catalog'), html.indexOf('</section>', html.indexOf('<section class="catalog')));
  assert.ok(!catalogPart.includes('data-category'), 'в каталоге остались кнопки жанров');

  // Сортировка — внутри панели фильтров
  const filterStart = html.indexOf('data-panel="filter"');
  const filterEnd = html.indexOf('</aside>', filterStart);
  assert.ok(html.slice(filterStart, filterEnd).includes('data-sort'), 'data-sort не в панели фильтров');
});

test('настольная: сайдбар с разделами, сортировка в тулбаре, поиск в шапке', () => {
  const html = pageHtml('desktop.html');
  assert.ok(html.includes('class="catalog__side"'), 'нет сайдбара фильтров');
  assert.ok(html.includes('class="side-list"'), 'нет списка разделов');
  assert.ok(html.includes('class="toolbar__sort"'), 'нет сортировки в тулбаре');
  assert.ok(html.includes('class="search-line"'), 'нет поиска в шапке');
  assert.ok(html.includes('data-open-panel="menu"') === false, 'в настольной не должно быть бургер-меню');
});

test('обе версии: общие панели присутствуют по одному разу', () => {
  for (const page of ['desktop.html', 'mobile.html']) {
    const html = pageHtml(page);
    assert.strictEqual(html.split('data-panel="cart"').length - 1, 1, page + ': корзина');
    assert.strictEqual(html.split('data-panel="favorites"').length - 1, 1, page + ': избранное');
    assert.strictEqual(html.split('data-modal role="dialog"').length - 1, 1, page + ': модальное окно');
    assert.strictEqual(html.split('class="overlay"').length - 1, 1, page + ': оверлей');
    assert.strictEqual(html.split('class="toast-stack"').length - 1, 1, page + ': тосты');
  }
});

test('ссылки между версиями не потерялись', () => {
  const index = pageHtml('index.html');
  assert.ok(index.includes('href="desktop.html"'), 'index: нет ссылки на desktop');
  assert.ok(index.includes('href="mobile.html"'), 'index: нет ссылки на mobile');

  assert.ok(pageHtml('desktop.html').includes('href="mobile.html"'), 'desktop: нет ссылки на mobile');
  assert.ok(pageHtml('mobile.html').includes('href="desktop.html"'), 'mobile: нет ссылки на desktop');
});

test('якоря: у секций есть scroll-margin-top под закреплённую шапку', () => {
  // Без отступа переход по #catalog/#about/#subscribe/#contacts
  // прячет заголовок под sticky-шапкой (74 px на десктопе, ~118 px на мобиле)
  const base = fs.readFileSync(path.join(ROOT, 'assets/css/base.css'), 'utf8');
  const desktop = fs.readFileSync(path.join(ROOT, 'assets/css/desktop.css'), 'utf8');
  const mobile = fs.readFileSync(path.join(ROOT, 'assets/css/mobile.css'), 'utf8');

  const rule = (css) => {
    const match = css.match(/section\[id\],\s*footer\[id\]\s*\{\s*scroll-margin-top:\s*(\d+)px;\s*\}/);
    return match ? Number(match[1]) : null;
  };

  assert.ok(rule(base) !== null, 'base.css: нет базового scroll-margin-top');
  assert.ok(rule(desktop) >= 74, 'desktop.css: отступ меньше высоты шапки');
  assert.ok(rule(mobile) >= 118, 'mobile.css: отступ меньше высоты шапки');
});

