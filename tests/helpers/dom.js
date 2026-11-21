/* ============================================================
   Минимальный DOM-стаб для тестов assets/js/shop.js.
   Без сторонних зависимостей: только то, что реально использует код
   (classList, dataset, closest, querySelector(All), textContent, innerHTML,
   setTimeout с ручным «прокручиванием», localStorage).
   ============================================================ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const DATA_JS = path.join(ROOT, 'assets/js/data.js');
const SHOP_JS = path.join(ROOT, 'assets/js/shop.js');

// Элемент с минимальным набором свойств DOM
function makeElement(init = {}) {
  const classes = new Set(init.classes || []);
  const el = {
    dataset: init.dataset || {},
    attrs: Object.assign({}, init.attrs),
    textContent: init.textContent || '',
    innerHTML: init.innerHTML || '',
    value: init.value || '',
    checked: Boolean(init.checked),
    hidden: Boolean(init.hidden),
    scrollTop: 0,
    className: init.className || '',
    children: [],
    parentNode: null,
    focused: false,

    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
      toggle: (name, force) => {
        const on = force === undefined ? !classes.has(name) : Boolean(force);
        if (on) classes.add(name); else classes.delete(name);
        return on;
      },
    },

    setAttribute(name, value) { this.attrs[name] = String(value); },
    getAttribute(name) { return name in this.attrs ? this.attrs[name] : null; },
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; },
    removeChild(child) {
      this.children = this.children.filter((item) => item !== child);
      child.parentNode = null;
    },
    focus() { this.focused = true; },
    matches: (selector) => (init.matches || []).includes(selector),
    closest: (selector) => (init.closest && init.closest[selector]) || null,
    querySelector: (selector) => (init.query && init.query[selector]) || null,
    querySelectorAll: () => [],
  };
  return el;
}

// Фейковые таймеры: время двигается только вручную через flush()
function createTimers() {
  let time = 0;
  let nextId = 1;
  const queue = new Map();

  return {
    setTimeout(fn, ms) {
      const id = nextId++;
      queue.set(id, { at: time + (Number(ms) || 0), fn });
      return id;
    },
    clearTimeout(id) { queue.delete(id); },
    flush() {
      let guard = 0;
      while (queue.size) {
        if (++guard > 1000) throw new Error('слишком много таймеров — проверьте тест');
        const [id, job] = Array.from(queue.entries()).sort((a, b) => a[1].at - b[1].at)[0];
        queue.delete(id);
        time = job.at;
        job.fn();
      }
    },
  };
}


// Окружение страницы: document/window/localStorage/таймеры + загрузка data.js и shop.js
function createSandbox(options = {}) {
  const nodes = options.nodes || {};      // selector -> массив элементов
  const singles = options.singles || {};  // selector -> элемент (приоритетнее nodes)
  const byId = options.byId || {};        // id -> элемент
  const store = new Map(Object.entries(options.storage || {}));
  const handlers = { click: [], input: [], change: [], submit: [], keydown: [] };
  const timers = createTimers();

  const find = (selector) => singles[selector] || (nodes[selector] && nodes[selector][0]) || null;

  const document = {
    readyState: 'complete',
    body: makeElement(),
    addEventListener(type, fn) { if (handlers[type]) handlers[type].push(fn); },
    querySelector: find,
    querySelectorAll: (selector) => nodes[selector] || [],
    getElementById: (id) => byId[id] || null,
    contains: (node) => Boolean(node),
    createElement: () => makeElement(),
  };

  const window = {
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => { store.set(key, String(value)); },
    },
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    addEventListener() {},
  };
  window.window = window;
  window.document = document;

  // Math с фиксированным random — номер заказа в тестах предсказуем
  const math = Object.create(Math);
  math.random = () => 0.5;

  const sandbox = {
    window,
    document,
    Math: math,
    console: { log() {}, warn() {}, error: (...args) => console.error(...args) },
  };

  vm.runInNewContext(fs.readFileSync(DATA_JS, 'utf8'), sandbox, { filename: 'data.js' });
  vm.runInNewContext(fs.readFileSync(SHOP_JS, 'utf8'), sandbox, { filename: 'shop.js' });

  return {
    document,
    window,
    nodes,
    singles,
    byId,
    storage: store,
    timers,
    click: (target) => handlers.click.forEach((fn) => fn({ target, preventDefault() {} })),
    input: (target) => handlers.input.forEach((fn) => fn({ target })),
    change: (target) => handlers.change.forEach((fn) => fn({ target })),
    submit: (target) => handlers.submit.forEach((fn) => fn({ target, preventDefault() {} })),
    keydown: (key) => handlers.keydown.forEach((fn) => fn({ key })),
  };
}

// Данные каталога (assets/js/data.js) — для расчёта ожидаемых результатов в тестах.
// Копируем через JSON, чтобы объекты и массивы принадлежали хостовому realm
// (иначе deepStrictEqual ругается на разные прототипы массивов из vm).
function loadData() {
  const holder = {};
  vm.runInNewContext(fs.readFileSync(DATA_JS, 'utf8'), { window: holder }, { filename: 'data.js' });
  const copy = (value) => JSON.parse(JSON.stringify(value || []));
  return {
    books: copy(holder.GORY_KNIG_BOOKS),
    categories: copy(holder.GORY_KNIG_CATEGORIES),
    conditions: copy(holder.GORY_KNIG_CONDITIONS),
  };
}

module.exports = { makeElement, createTimers, createSandbox, loadData };

