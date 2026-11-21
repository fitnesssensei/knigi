/* ============================================================
   Автотесты корзины и избранного: node --test tests/
   assets/js/shop.js на DOM-стабе: добавление/удаление, бейджи,
   localStorage, оформление заказа, подписка, уведомления.
   ============================================================ */

const { test } = require('node:test');
const assert = require('node:assert');

const { createSandbox, makeElement } = require('./helpers/dom');

const CART_KEY = 'gory-knig:cart:v1';
const FAVS_KEY = 'gory-knig:favs:v1';

// Окружение с корзиной, избранным и стеком уведомлений
function createShopEnv(extraNodes = {}, storage = {}) {
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
    '[data-toasts]': [makeElement()],
    // Панель избранного «открыта» — иначе renderFavorites не перерисовывается
    '[data-panel="favorites"].is-open': [makeElement()],
    ...extraNodes,
  };
  return createSandbox({ nodes, storage });
}

// Элемент, у которого closest() срабатывает на заданные селекторы
function clickTarget(selector, dataset) {
  const el = makeElement({ dataset });
  el.closest = (sel) => (sel === selector ? el : null);
  return el;
}

// Последний текст уведомления в стеке
function lastToast(env) {
  const stack = env.nodes['[data-toasts]'][0];
  const last = stack.children[stack.children.length - 1];
  return last ? last.innerHTML : '';
}

test('корзина: добавление и повторный клик убирает книгу', () => {
  const env = createShopEnv();
  env.click(clickTarget('[data-add]', { add: 'onegin' }));

  assert.strictEqual(env.storage.get(CART_KEY), JSON.stringify(['onegin']));
  assert.strictEqual(env.nodes['[data-cart-count]'][0].textContent, 1);
  assert.strictEqual(env.nodes['[data-cart-count]'][0].dataset.empty, 'false');
  assert.ok(env.nodes['[data-cart-body]'][0].innerHTML.includes('Евгений Онегин'), 'книги нет в корзине');
  assert.ok(env.nodes['[data-cart-foot]'][0].innerHTML.includes('Итого'), 'нет итога');
  assert.ok(lastToast(env).includes('в корзине'), 'нет уведомления о добавлении');

  env.click(clickTarget('[data-add]', { add: 'onegin' }));
  assert.strictEqual(env.storage.get(CART_KEY), JSON.stringify([]));
  assert.strictEqual(env.nodes['[data-cart-count]'][0].textContent, 0);
  assert.strictEqual(env.nodes['[data-cart-count]'][0].dataset.empty, 'true');
  assert.ok(env.nodes['[data-cart-body]'][0].innerHTML.includes('Корзина пуста'));
});

test('корзина: состояние читается из localStorage при загрузке', () => {
  const env = createShopEnv({}, { [CART_KEY]: JSON.stringify(['onegin', 'blok']) });

  assert.strictEqual(env.nodes['[data-cart-count]'][0].textContent, 2);
  const body = env.nodes['[data-cart-body]'][0].innerHTML;
  assert.ok(body.includes('Евгений Онегин') && body.includes('А. А. Блок'), 'книги не восстановлены');
});

test('бейджи: неизвестные id из localStorage не считаются', () => {
  // В хранилище остались книги, которых больше нет в каталоге:
  // бейдж обязан совпадать с тем, что реально перечислено в панелях
  const env = createShopEnv({}, {
    [CART_KEY]: JSON.stringify(['onegin', 'kniga-iz-proshlogo-tirazha']),
    [FAVS_KEY]: JSON.stringify(['net-takoy-knigi']),
  });

  assert.strictEqual(env.nodes['[data-cart-count]'][0].textContent, 1, 'в корзине одна реальная книга');
  assert.strictEqual(env.nodes['[data-cart-count]'][0].dataset.empty, 'false');
  assert.strictEqual(env.nodes['[data-fav-count]'][0].textContent, 0, 'избранное пустое');
  assert.strictEqual(env.nodes['[data-fav-count]'][0].dataset.empty, 'true');
  assert.ok(env.nodes['[data-cart-body]'][0].innerHTML.includes('Евгений Онегин'));
});

test('избранное: добавление, бейдж и сохранение', () => {
  const env = createShopEnv();
  env.click(clickTarget('[data-fav]', { fav: 'ahmatova' }));

  assert.strictEqual(env.storage.get(FAVS_KEY), JSON.stringify(['ahmatova']));
  assert.strictEqual(env.nodes['[data-fav-count]'][0].textContent, 1);
  assert.ok(env.nodes['[data-fav-body]'][0].innerHTML.includes('Ахматова'), 'книги нет в избранном');
  assert.ok(lastToast(env).includes('в избранном'));
});

test('избранное: «добавить всё в корзину» переносит книги', () => {
  const env = createShopEnv({}, { [FAVS_KEY]: JSON.stringify(['onegin', 'blok']) });
  env.click(clickTarget('[data-add-all]'));

  assert.strictEqual(env.storage.get(CART_KEY), JSON.stringify(['onegin', 'blok']));
  assert.strictEqual(env.nodes['[data-cart-count]'][0].textContent, 2);
  assert.ok(lastToast(env).includes('Добавили 2 книги'));
});

test('заказ: валидация полей и успешное оформление', () => {
  const env = createShopEnv({}, { [CART_KEY]: JSON.stringify(['onegin']) });

  env.click(clickTarget('[data-checkout]'));
  assert.ok(env.nodes['[data-cart-body]'][0].innerHTML.includes('data-checkout-form'), 'нет формы заказа');

  // Поля формы — простые объекты с value и focus()
  const makeForm = (values) => {
    const form = makeElement({ matches: ['[data-checkout-form]'] });
    form.elements = values;
    form.querySelectorAll = () => [];
    return form;
  };
  const field = (value) => ({ value, focus() {} });

  // Пустая форма — заказ не создаётся
  env.submit(makeForm({
    name: field(''), phone: field(''), email: field(''), agree: { checked: false }, delivery: field('courier'),
  }));
  assert.ok(lastToast(env).includes('Проверьте выделенные поля'));
  assert.strictEqual(env.storage.get(CART_KEY), JSON.stringify(['onegin']));

  // Корректные данные — заказ принят, корзина очищена, номер показан
  env.submit(makeForm({
    name: field('Иван'),
    phone: field('+7 999 123-45-67'),
    email: field('ivan@example.ru'),
    agree: { checked: true },
    delivery: field('courier'),
  }));
  assert.strictEqual(env.storage.get(CART_KEY), JSON.stringify([]));
  assert.strictEqual(env.nodes['[data-cart-count]'][0].textContent, 0);
  assert.ok(lastToast(env).includes('Заказ принят'));
  // Math.random в тестах зафиксирован на 0.5 — номер заказа предсказуем
  assert.ok(env.nodes['[data-cart-body]'][0].innerHTML.includes('ГК-5500'), 'номер заказа не показан');
});

test('подписка: пустой email и успешная отправка', () => {
  const env = createShopEnv();
  const emailInput = makeElement({ value: '' });
  let resets = 0;
  const form = makeElement({ matches: ['[data-subscribe]'] });
  form.querySelector = () => emailInput;
  form.reset = () => { resets += 1; };

  env.submit(form);
  assert.ok(lastToast(env).includes('Укажите email'));
  assert.strictEqual(resets, 0);

  emailInput.value = 'reader@example.ru';
  env.submit(form);
  assert.ok(lastToast(env).includes('reader@example.ru'), 'нет подтверждения подписки');
  assert.strictEqual(resets, 1);
});

test('уведомления: исчезают по таймеру', () => {
  const env = createShopEnv();
  const stack = env.nodes['[data-toasts]'][0];

  env.click(clickTarget('[data-add]', { add: 'onegin' }));
  assert.strictEqual(stack.children.length, 1);

  env.timers.flush();
  assert.strictEqual(stack.children.length, 0, 'уведомление не исчезло');
});

