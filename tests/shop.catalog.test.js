/* ============================================================
   Автотесты каталога: node --test tests/
   Проверяют assets/js/shop.js на реальных данных assets/js/data.js:
   рендер, поиск, жанры, цена, редкости, сортировка, сброс фильтров.
   DOM заменён минимальным стабом (tests/helpers/dom.js).
   ============================================================ */

const { test } = require('node:test');
const assert = require('node:assert');

const { createSandbox, makeElement, loadData } = require('./helpers/dom');

const DATA = loadData();

// Карточки каталога: уникальные id книг в порядке вывода
// (в разметке карточки data-open-book встречается дважды: обложка и заголовок)
function renderedIds(env) {
  const all = Array.from(env.nodes['[data-catalog]'][0].innerHTML.matchAll(/data-open-book="([^"]+)"/g), (m) => m[1]);
  return Array.from(new Set(all));
}

// Каталог + счётчик + бейджи + панели корзины и избранного
function createCatalogEnv(extraNodes = {}, options = {}) {
  const nodes = {
    '[data-catalog]': [makeElement()],
    '[data-count]': [makeElement()],
    '[data-cart-count]': [makeElement()],
    '[data-fav-count]': [makeElement()],
    '[data-cart-body]': [makeElement()],
    '[data-cart-foot]': [makeElement()],
    '[data-fav-body]': [makeElement()],
    '[data-fav-foot]': [makeElement()],
    '[data-search]': [makeElement()],
    '[data-sort]': [makeElement()],
    ...extraNodes,
  };
  return createSandbox({ nodes, ...options });
}

test('каталог: при загрузке рендерятся все книги и счётчик', () => {
  const env = createCatalogEnv();
  assert.strictEqual(renderedIds(env).length, DATA.books.length);
  assert.ok(env.nodes['[data-count]'][0].innerHTML.includes('<b>' + DATA.books.length + '</b>'));
});

test('каталог: поиск по автору фильтрует книги', () => {
  const env = createCatalogEnv();
  const search = env.nodes['[data-search]'][0];
  search.value = 'пушкин';
  env.input(Object.assign(search, { matches: (sel) => sel === '[data-search]' }));
  env.timers.flush();

  const expected = DATA.books.filter((b) => (b.author + ' ' + b.title).toLowerCase().includes('пушкин'));
  assert.ok(expected.length > 0, 'в данных нет книг Пушкина — тест устарел');
  assert.deepStrictEqual(renderedIds(env), expected.map((b) => b.id));
});

test('каталог: первый ввод в поиске шапки прокручивает к каталогу', () => {
  // Секция каталога с отслеживанием вызова scrollIntoView
  const calls = [];
  const catalog = makeElement();
  catalog.scrollIntoView = (options) => calls.push(options);
  const env = createCatalogEnv({}, { byId: { catalog } });

  const search = env.nodes['[data-search]'][0];
  // Ввод первого символа: каталог должен оказаться на экране
  search.value = 'пушкин';
  env.input(Object.assign(search, { matches: (sel) => sel === '[data-search]' }));
  assert.strictEqual(calls.length, 1, 'после первого ввода нужна прокрутка к каталогу');
  assert.strictEqual(calls[0].behavior, 'smooth');
  assert.strictEqual(calls[0].block, 'start');

  // Продолжение ввода в той же сессии не дёргает страницу повторно
  search.value = 'пушки';
  env.input(Object.assign(search, { matches: (sel) => sel === '[data-search]' }));
  assert.strictEqual(calls.length, 1, 'повторные символы не должны прокручивать страницу');

  // Очистка поля начинает новую сессию поиска
  search.value = '';
  env.input(Object.assign(search, { matches: (sel) => sel === '[data-search]' }));
  assert.strictEqual(calls.length, 1, 'очистка поля сама по себе не прокручивает страницу');

  search.value = 'блок';
  env.input(Object.assign(search, { matches: (sel) => sel === '[data-search]' }));
  assert.strictEqual(calls.length, 2, 'новый поиск после очистки снова подводит каталог');
});

test('каталог: выбор жанра оставляет только этот жанр', () => {
  const env = createCatalogEnv();
  const chip = makeElement({ dataset: { category: 'Поэзия' } });
  chip.closest = (sel) => (sel === '[data-category]' ? chip : null);
  env.click(chip);

  const expected = DATA.books.filter((b) => b.category === 'Поэзия');
  assert.deepStrictEqual(renderedIds(env), expected.map((b) => b.id));
  assert.ok(renderedIds(env).length > 0, 'жанр «Поэзия» пуст — тест устарел');
});

test('каталог: ограничение цены отсекает дорогие книги', () => {
  const env = createCatalogEnv();
  env.input(makeElement({ value: '20000', matches: ['[data-max-price]'] }));

  const expected = DATA.books.filter((book) => book.price <= 20000).map((book) => book.id).sort();
  assert.deepStrictEqual(renderedIds(env).sort(), expected);
  assert.ok(expected.length > 0 && expected.length < DATA.books.length, 'фильтр цены ничего не отсекает');
});

test('каталог: чекбокс «только редкости» оставляет редкие издания', () => {
  const env = createCatalogEnv();
  env.change(makeElement({ checked: true, matches: ['[data-rare]'] }));

  const expected = DATA.books
    .filter((book) => book.tag === 'Редкость' || book.tag === 'Антиквариат')
    .map((book) => book.id)
    .sort();
  assert.deepStrictEqual(renderedIds(env).sort(), expected);
  assert.ok(expected.length > 0, 'в данных нет редких книг — тест устарел');
});

test('каталог: сортировка «дешевле» упорядочивает книги по цене', () => {
  const env = createCatalogEnv();
  env.change(makeElement({ value: 'price-asc', matches: ['[data-sort]'] }));

  const expected = DATA.books.slice().sort((a, b) => a.price - b.price).map((book) => book.id);
  assert.deepStrictEqual(renderedIds(env), expected);
});

test('каталог: сортировка «старые» упорядочивает книги по году', () => {
  const env = createCatalogEnv();
  env.change(makeElement({ value: 'year-asc', matches: ['[data-sort]'] }));

  const expected = DATA.books.slice().sort((a, b) => a.year - b.year).map((book) => book.id);
  assert.deepStrictEqual(renderedIds(env), expected);
});

test('каталог: сброс фильтров возвращает все книги', () => {
  const env = createCatalogEnv();
  // сначала сужаем выборку, затем сбрасываем
  const chip = makeElement({ dataset: { category: 'История' } });
  chip.closest = (sel) => (sel === '[data-category]' ? chip : null);
  env.click(chip);
  assert.ok(renderedIds(env).length < DATA.books.length, 'фильтр по жанру не сработал');

  const reset = makeElement();
  reset.closest = (sel) => (sel === '[data-reset-filters]' ? reset : null);
  env.click(reset);

  assert.deepStrictEqual(renderedIds(env).sort(), DATA.books.map((book) => book.id).sort());
});

