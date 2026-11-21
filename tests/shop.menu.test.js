/* ============================================================
   Автотесты меню и панелей: node --test tests/
   Мобильное меню (аккордеон «Категории»), открытие/закрытие панелей,
   Escape, блокировка прокрутки — всё из assets/js/shop.js.
   ============================================================ */

const { test } = require('node:test');
const assert = require('node:assert');

const { createSandbox, makeElement } = require('./helpers/dom');

// Окружение с мобильной панелью меню, списком жанров и оверлеем
function createMenuEnv() {
  const panel = makeElement();
  const overlay = makeElement();
  const categoryList = makeElement();
  const env = createSandbox({
    nodes: {
      '[data-panel="menu"]': [panel],
      '[data-overlay]': [overlay],
      '[data-cart-count]': [makeElement()],
      '[data-fav-count]': [makeElement()],
    },
    byId: { 'menu-categories': categoryList },
  });
  return { env, panel, overlay, categoryList };
}

test('меню: кнопка «Категории» раскрывает и сворачивает список жанров', () => {
  const { env, categoryList } = createMenuEnv();
  const button = makeElement({ attrs: { 'aria-controls': 'menu-categories' } });
  button.closest = (sel) => (sel === '[data-menu-categories]' ? button : null);

  env.click(button);
  assert.ok(categoryList.classList.contains('is-open'), 'список не раскрылся');
  assert.strictEqual(button.attrs['aria-expanded'], 'true');

  env.click(button);
  assert.ok(!categoryList.classList.contains('is-open'), 'список не свернулся');
  assert.strictEqual(button.attrs['aria-expanded'], 'false');
});

test('меню: бургер открывает панель, оверлей и блокирует прокрутку', () => {
  const { env, panel, overlay } = createMenuEnv();
  const burger = makeElement({ dataset: { openPanel: 'menu' } });
  burger.closest = (sel) => (sel === '[data-open-panel]' ? burger : null);

  env.click(burger);
  assert.ok(panel.classList.contains('is-open'), 'панель не открылась');
  assert.strictEqual(panel.attrs['aria-hidden'], 'false');
  assert.ok(overlay.classList.contains('is-open'), 'оверлей не показан');
  assert.ok(env.document.body.classList.contains('is-locked'), 'прокрутка не заблокирована');
});

test('меню: Escape закрывает панель', () => {
  const { env, panel, overlay } = createMenuEnv();
  const burger = makeElement({ dataset: { openPanel: 'menu' } });
  burger.closest = (sel) => (sel === '[data-open-panel]' ? burger : null);
  env.click(burger);

  // Для закрытия нужен селектор открытой панели — отдаём тот же элемент
  env.nodes['[data-panel].is-open'] = [panel];
  env.keydown('Escape');

  assert.ok(!panel.classList.contains('is-open'), 'панель не закрылась');
  assert.strictEqual(panel.attrs['aria-hidden'], 'true');
  assert.ok(!overlay.classList.contains('is-open'), 'оверлей остался');
});

test('меню: выбор жанра внутри панели закрывает её', () => {
  const { env, panel } = createMenuEnv();
  env.nodes['[data-panel].is-open'] = [panel];

  const chip = makeElement({ dataset: { category: 'Поэзия' } });
  chip.closest = (sel) => {
    if (sel === '[data-category]') return chip;
    if (sel === '[data-panel]') return panel;
    return null;
  };
  env.click(chip);

  assert.ok(!panel.classList.contains('is-open'), 'панель не закрылась после выбора жанра');
});
