/* ============================================================
   ГОРЫ-КНИГ — логика магазина
   Общая для десктопной и мобильной версий:
   каталог, поиск, фильтры, избранное, корзина, оформление заказа
   ============================================================ */

(function () {
  'use strict';

  var books = window.GORY_KNIG_BOOKS || [];
  var categories = window.GORY_KNIG_CATEGORIES || [];
  var PRICE_MIN = 5000;
  var PRICE_MAX = 150000;
  var STORAGE = {
    cart: 'gory-knig:cart:v1',
    favs: 'gory-knig:favs:v1'
  };

  var byId = {};
  books.forEach(function (book) { byId[book.id] = book; });

  var state = {
    category: 'all',
    conditions: [],
    rareOnly: false,
    maxPrice: PRICE_MAX,
    sort: 'popular',
    query: '',
    cart: readJSON(STORAGE.cart, []),
    favs: readJSON(STORAGE.favs, []),
    checkout: false,
    lastFocus: null,
    order: null
  };

  /* ---------- Утилиты ---------- */

  function readJSON(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      var value = raw ? JSON.parse(raw) : null;
      return Array.isArray(value) ? value : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      /* приватный режим — просто не сохраняем */
    }
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function money(value) {
    return Number(value).toLocaleString('ru-RU').replace(/\u00A0/g, ' ') + ' ₽';
  }

  function plural(count, one, few, many) {
    var mod10 = count % 10;
    var mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
    return many;
  }

  function booksWord(count) {
    return plural(count, 'книга', 'книги', 'книг');
  }

  function isRare(book) {
    return book.tag === 'Редкость' || book.tag === 'Антиквариат';
  }

  /* ---------- Иконки ---------- */

  var icons = {
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 20.5s-7.6-4.7-7.6-9.5A4.2 4.2 0 0 1 12 8.1a4.2 4.2 0 0 1 7.6 2.9c0 4.8-7.6 9.5-7.6 9.5Z" stroke-linejoin="round"/></svg>',
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" focusable="false"><path d="M6 8h12l1 12H5L6 8Z" stroke-linejoin="round"/><path d="M9 8V6.6a3 3 0 0 1 6 0V8"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4" stroke-linecap="round"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18" stroke-linecap="round"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true" focusable="false"><path d="m5 12.5 4.5 4.5L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" focusable="false"><path d="M4 12h15M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    filters: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false"><path d="M4 7h9M17 7h3M4 17h3M11 17h9" stroke-linecap="round"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" focusable="false"><path d="M4 5.6A2.6 2.6 0 0 1 6.6 3H19v15H6.6A2.6 2.6 0 0 0 4 20.6V5.6Z" stroke-linejoin="round"/><path d="M19 18v3H6.6" stroke-linecap="round"/></svg>'
  };

  /* ---------- Проверка состояния ---------- */

  function inCart(id) {
    return state.cart.indexOf(id) !== -1;
  }

  function isFav(id) {
    return state.favs.indexOf(id) !== -1;
  }

  /* ---------- Фильтрация и сортировка ---------- */

  function matchesQuery(book, query) {
    if (!query) return true;
    var haystack = [book.title, book.author, book.publisher, book.category, book.year, book.tag]
      .join(' ')
      .toLowerCase();
    return haystack.indexOf(query) !== -1;
  }

  function filteredBooks() {
    var query = state.query.trim().toLowerCase();
    var list = books.filter(function (book) {
      if (state.category !== 'all' && book.category !== state.category) return false;
      if (state.conditions.length && state.conditions.indexOf(book.condition) === -1) return false;
      if (state.rareOnly && !isRare(book)) return false;
      if (book.price > state.maxPrice) return false;
      return matchesQuery(book, query);
    });

    switch (state.sort) {
      case 'price-asc':
        list.sort(function (a, b) { return a.price - b.price; });
        break;
      case 'price-desc':
        list.sort(function (a, b) { return b.price - a.price; });
        break;
      case 'year-asc':
        list.sort(function (a, b) { return a.year - b.year; });
        break;
      case 'year-desc':
        list.sort(function (a, b) { return b.year - a.year; });
        break;
      default:
        list.sort(function (a, b) { return b.popularity - a.popularity; });
    }
    return list;
  }

  function filtersActive() {
    return state.conditions.length > 0 || state.rareOnly || state.maxPrice !== PRICE_MAX;
  }

  /* ---------- Отрисовка каталога ---------- */

  function renderCatalog() {
    var grid = document.querySelector('[data-catalog]');
    if (!grid) return;
    var list = filteredBooks();

    grid.innerHTML = list.length
      ? list.map(cardMarkup).join('')
      : '<div class="empty" style="grid-column:1/-1">' +
          '<p class="empty__title">Ничего не нашлось</p>' +
          '<p class="small">Попробуйте изменить запрос или сбросить фильтры — в каталоге ' +
            books.length + ' ' + booksWord(books.length) + '.</p>' +
          '<button class="btn btn--ghost btn--sm" type="button" data-reset-filters>Сбросить фильтры</button>' +
        '</div>';

    document.querySelectorAll('[data-count]').forEach(function (node) {
      node.innerHTML = '<b>' + list.length + '</b> ' + booksWord(list.length);
    });

    document.querySelectorAll('[data-category]').forEach(function (button) {
      var active = button.dataset.category === state.category;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    document.querySelectorAll('[data-category-count]').forEach(function (node) {
      var value = node.dataset.categoryCount;
      node.textContent = value === 'all'
        ? books.length
        : books.filter(function (book) { return book.category === value; }).length;
    });

    document.querySelectorAll('[data-filter-dot]').forEach(function (node) {
      node.hidden = !filtersActive();
    });

    document.querySelectorAll('[data-filter-button]').forEach(function (node) {
      node.classList.toggle('is-active', filtersActive());
    });

    document.querySelectorAll('[data-condition]').forEach(function (input) {
      input.checked = state.conditions.indexOf(input.value) !== -1;
    });

    document.querySelectorAll('[data-rare]').forEach(function (input) {
      input.checked = state.rareOnly;
    });

    document.querySelectorAll('[data-max-price]').forEach(function (input) {
      var value = String(state.maxPrice);
      if (input.value !== value) input.value = value;
    });

    document.querySelectorAll('[data-price-label]').forEach(function (node) {
      node.textContent = money(state.maxPrice);
    });

    document.querySelectorAll('[data-sort]').forEach(function (select) {
      select.value = state.sort;
    });

    document.querySelectorAll('[data-search]').forEach(function (input) {
      if (input.value !== state.query) input.value = state.query;
    });
  }


  function coverMarkup(book) {
    var cover = book.cover || {};
    return '' +
      '<div class="cover cover--' + esc(cover.pattern || 'frame') + '" ' +
        'style="--cover-bg:' + esc(cover.bg || '#3B2F55') + ';' +
        '--cover-fg:' + esc(cover.fg || '#EDE4F7') + ';' +
        '--cover-accent:' + esc(cover.accent || '#B79BD8') + '">' +
        '<span class="cover__rule"></span>' +
        '<span class="cover__author">' + esc(book.author) + '</span>' +
        '<span class="cover__title">' + esc(book.title) + '</span>' +
        '<span class="cover__mark">' + esc(cover.mark || book.year) + '</span>' +
      '</div>';
  }

  function cardMarkup(book) {
    var fav = isFav(book.id);
    var added = inCart(book.id);
    return '' +
      '<article class="book-card" data-card="' + esc(book.id) + '">' +
        '<div class="book-card__media">' +
          '<button class="book-card__open" type="button" data-open-book="' + esc(book.id) + '" ' +
            'aria-label="Подробнее о книге «' + esc(book.title) + '»">' +
            coverMarkup(book) +
          '</button>' +
          (book.tag ? '<span class="book-card__tag">' + esc(book.tag) + '</span>' : '') +
          '<button class="book-card__fav" type="button" data-fav="' + esc(book.id) + '" ' +
            'aria-pressed="' + fav + '" aria-label="' +
            (fav ? 'Убрать из избранного: ' : 'В избранное: ') + esc(book.title) + '">' +
            icons.heart + '</button>' +
        '</div>' +
        '<div class="book-card__body">' +
          '<p class="book-card__author">' + esc(book.author) + '</p>' +
          '<h3 class="book-card__title">' +
            '<button type="button" data-open-book="' + esc(book.id) + '">' + esc(book.title) + '</button>' +
          '</h3>' +
          '<p class="book-card__meta">' + esc(book.year) + ' · ' + esc(book.condition) + '</p>' +
          '<div class="book-card__foot">' +
            '<p class="book-card__price-box">' +
              '<span class="price">' + money(book.price) + '</span>' +
              (book.oldPrice ? '<span class="price--old">' + money(book.oldPrice) + '</span>' : '') +
            '</p>' +
            '<button class="add-btn' + (added ? ' is-added' : '') + '" type="button" ' +
              'data-add="' + esc(book.id) + '" aria-label="Добавить в корзину: ' + esc(book.title) + '">' +
              icons.bag + '<span class="add-btn__text">' + (added ? 'В корзине' : 'В корзину') + '</span>' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</article>';
  }
  /* ---------- Корзина и избранное ---------- */

  function cartList() {
    return state.cart.map(function (id) { return byId[id]; }).filter(Boolean);
  }

  function favoritesList() {
    return state.favs.map(function (id) { return byId[id]; }).filter(Boolean);
  }

  function cartTotal() {
    return cartList().reduce(function (sum, book) { return sum + book.price; }, 0);
  }

  function renderBadges() {
    // Считаем только реально существующие книги: в localStorage могли остаться
    // id, которых больше нет в каталоге. Иначе бейдж показывал бы больше
    // позиций, чем перечислено в панели корзины/избранного.
    var cartCount = cartList().length;
    var favsCount = favoritesList().length;
    document.querySelectorAll('[data-cart-count]').forEach(function (node) {
      node.textContent = cartCount;
      node.dataset.empty = String(cartCount === 0);
    });
    document.querySelectorAll('[data-fav-count]').forEach(function (node) {
      node.textContent = favsCount;
      node.dataset.empty = String(favsCount === 0);
    });
  }

  function emptyMarkup(title, text) {
    return '<div class="empty">' +
        '<p class="empty__title">' + title + '</p>' +
        '<p class="small">' + text + '</p>' +
        '<button class="btn btn--ghost btn--sm" type="button" data-goto-catalog>Перейти в каталог</button>' +
      '</div>';
  }

  function cartItemMarkup(book) {
    return '<article class="cart-item">' +
        '<div class="cart-item__cover">' + coverMarkup(book) + '</div>' +
        '<div>' +
          '<p class="cart-item__author">' + esc(book.author) + '</p>' +
          '<p class="cart-item__title">' + esc(book.title) + '</p>' +
          '<p class="cart-item__meta">' + esc(book.year) + ' · ' + esc(book.condition) + ' · 1 экз.</p>' +
          '<div class="cart-item__row">' +
            '<button class="cart-item__remove" type="button" data-remove="' + esc(book.id) + '">Убрать</button>' +
            '<button class="cart-item__remove" type="button" data-open-book="' + esc(book.id) + '">Подробнее</button>' +
          '</div>' +
        '</div>' +
        '<p class="cart-item__price">' + money(book.price) + '</p>' +
      '</article>';
  }

  function favItemMarkup(book) {
    var added = inCart(book.id);
    return '<article class="cart-item">' +
        '<div class="cart-item__cover">' + coverMarkup(book) + '</div>' +
        '<div>' +
          '<p class="cart-item__author">' + esc(book.author) + '</p>' +
          '<p class="cart-item__title">' + esc(book.title) + '</p>' +
          '<p class="cart-item__meta">' + esc(book.year) + ' · ' + esc(book.condition) + '</p>' +
          '<div class="cart-item__row">' +
            '<button class="cart-item__remove" type="button" data-remove-fav="' + esc(book.id) + '">Убрать</button>' +
            '<button class="add-btn' + (added ? ' is-added' : '') + '" type="button" ' +
              'data-add="' + esc(book.id) + '" aria-label="Добавить в корзину: ' + esc(book.title) + '">' +
              icons.bag + '<span class="add-btn__text">' + (added ? 'В корзине' : 'В корзину') + '</span>' +
            '</button>' +
          '</div>' +
        '</div>' +
        '<p class="cart-item__price">' + money(book.price) + '</p>' +
      '</article>';
  }



  function checkoutMarkup() {
    return '<form class="checkout" data-checkout-form novalidate>' +
        '<p class="checkout__note">Проверьте контактные данные — менеджер свяжется в течение рабочего дня, ' +
          'чтобы подтвердить сохранность и удобное время доставки.</p>' +
        '<label class="field"><span>Имя и фамилия</span>' +
          '<input name="name" type="text" autocomplete="name" placeholder="Анна Петрова" required></label>' +
        '<label class="field"><span>Телефон</span>' +
          '<input name="phone" type="tel" autocomplete="tel" placeholder="+7 900 000-00-00" required></label>' +
        '<label class="field"><span>Email</span>' +
          '<input name="email" type="email" autocomplete="email" placeholder="anna@mail.ru"></label>' +
        '<label class="field"><span>Как получить</span>' +
          '<select name="delivery">' +
            '<option value="courier">Курьер по Сочи</option>' +
            '<option value="post">Почта России</option>' +
            '<option value="pickup">Самовывоз: Сочи, Дагомыс</option>' +
          '</select></label>' +
        '<label class="check"><input type="checkbox" name="agree" required>' +
          'Согласен с условиями обработки персональных данных</label>' +
        '<div class="sum sum--total"><span>К оплате</span><b>' + money(cartTotal()) + '</b></div>' +
        '<button class="btn btn--primary btn--block" type="submit">Подтвердить заказ</button>' +
        '<button class="btn btn--ghost btn--block" type="button" data-checkout-back>Вернуться в корзину</button>' +
      '</form>';
  }

  function orderDoneMarkup() {
    var order = state.order || {};
    return '<div class="order-done">' +
        '<div class="order-done__mark">' + icons.check + '</div>' +
        '<p class="order-done__num">Заказ ' + esc(order.number || '') + '</p>' +
        '<h3>Спасибо, заказ принят</h3>' +
        '<p>Мы проверим сохранность экземпляров, упакуем в крафт и защитный бокс и позвоним по номеру ' +
          esc(order.phone || '') + ' в течение рабочего дня.</p>' +
        (order.email ? '<p class="small">Подтверждение отправили на ' + esc(order.email) + '.</p>' : '') +
        '<button class="btn btn--ghost btn--sm" type="button" data-goto-catalog>Вернуться в каталог</button>' +
      '</div>';
  }

  function renderCart() {
    var body = document.querySelector('[data-cart-body]');
    var foot = document.querySelector('[data-cart-foot]');
    if (!body || !foot) return;
    var items = cartList();

    if (state.checkout) {
      body.innerHTML = state.order ? orderDoneMarkup() : checkoutMarkup();
      foot.hidden = true;
      body.scrollTop = 0;
      return;
    }

    foot.hidden = false;

    if (!items.length) {
      body.innerHTML = emptyMarkup('Корзина пуста',
        'Загляните в каталог — у каждой книги есть история, а у некоторых ещё и экслибрис.');
      foot.innerHTML = '<p class="checkout__note">Доставка курьером по Сочи и Почтой России. ' +
        'Каждый экземпляр упаковываем вручную.</p>';
      return;
    }

    body.innerHTML = items.map(cartItemMarkup).join('');
    foot.innerHTML = '' +
      '<div class="sum"><span>Книги (' + items.length + ')</span><span>' + money(cartTotal()) + '</span></div>' +
      '<div class="sum"><span>Доставка</span><span>По тарифу</span></div>' +
      '<div class="sum sum--total"><span>Итого</span><b>' + money(cartTotal()) + '</b></div>' +
      '<div class="cart-foot__action"><button class="btn btn--primary btn--block" type="button" ' +
        'data-checkout>Оформить заказ</button></div>' +
      '<p class="checkout__note cart-foot__note">Оплата после подтверждения сохранности. ' +
        'Отменить заказ можно в течение суток.</p>';
  }

  function renderFavorites() {
    var body = document.querySelector('[data-fav-body]');
    var foot = document.querySelector('[data-fav-foot]');
    if (!body || !foot) return;
    var items = favoritesList();

    if (!items.length) {
      body.innerHTML = emptyMarkup('Пока пусто',
        'Нажмите на сердце у книги — сохраним её здесь, даже если вы закроете страницу.');
      foot.innerHTML = '<p class="checkout__note">Избранное хранится в этом браузере. ' +
        'Мы не отправляем письма без вашего согласия.</p>';
      return;
    }

    body.innerHTML = items.map(favItemMarkup).join('');
    var available = items.filter(function (book) { return !inCart(book.id); }).length;
    foot.innerHTML = '' +
      '<div class="cart-foot__action"><button class="btn btn--primary btn--block" type="button" ' +
        'data-add-all' + (available ? '' : ' disabled') + '>' +
        (available ? 'Добавить всё в корзину' : 'Всё уже в корзине') + '</button></div>' +
      '<p class="checkout__note cart-foot__note">Каждый экземпляр существует в единственном числе — ' +
        'мы придержим его за вами на 24 часа.</p>';
  }

  /* ---------- Подробности о книге ---------- */

  function specMarkup(term, value) {
    return '<div><dt>' + esc(term) + '</dt><dd>' + esc(value) + '</dd></div>';
  }

  function bookDetailMarkup(book) {
    var fav = isFav(book.id);
    var added = inCart(book.id);
    return '<div class="book-detail">' +
        '<div class="book-detail__media">' + coverMarkup(book) + '</div>' +
        '<div class="book-detail__info">' +
          '<div class="book-detail__eyebrow">' +
            (book.tag ? '<span class="pill pill--accent">' + esc(book.tag) + '</span>' : '') +
            '<span class="pill">' + esc(book.category) + '</span>' +
          '</div>' +
          '<h2 class="book-detail__title" id="book-detail-title">' + esc(book.title) + '</h2>' +
          '<p class="book-detail__author">' + esc(book.author) + '</p>' +
          '<p class="book-detail__desc">' + esc(book.desc) + '</p>' +
          '<dl class="specs">' +
            specMarkup('Год издания', book.year) +
            specMarkup('Издательство', book.publisher + ', ' + book.place) +
            specMarkup('Переплёт', book.binding) +
            specMarkup('Страниц', book.pages) +
            specMarkup('Сохранность', book.condition) +
            specMarkup('Инвентарный номер', 'ГК-' + book.year + '-' + book.id.slice(0, 3).toUpperCase()) +
          '</dl>' +
          '<div class="book-detail__buy">' +
            '<p class="book-detail__price">' + money(book.price) +
              (book.oldPrice ? ' <span class="price--old">' + money(book.oldPrice) + '</span>' : '') +
            '</p>' +
            '<button class="btn btn--primary' + (added ? ' is-added' : '') + '" type="button" ' +
              'data-add="' + esc(book.id) + '">' + icons.bag +
              '<span data-add-label>' + (added ? 'В корзине' : 'В корзину') + '</span></button>' +
            '<button class="fav-btn" type="button" data-fav="' + esc(book.id) + '" ' +
              'aria-pressed="' + fav + '">' + icons.heart +
              '<span data-fav-label>' + (fav ? 'В избранном' : 'В избранное') + '</span></button>' +
          '</div>' +
          '<p class="book-detail__note">' + icons.check +
            'Единственный экземпляр. Упаковка, доставка и страховка — за наш счёт.</p>' +
        '</div>' +
      '</div>';
  }

  /* ---------- Синхронизация кнопок ---------- */

  function syncBookButtons(id) {
    var book = byId[id];
    if (!book) return;
    var added = inCart(id);
    var fav = isFav(id);

    document.querySelectorAll('[data-add="' + id + '"]').forEach(function (btn) {
      btn.classList.toggle('is-added', added);
      btn.setAttribute('aria-label', (added ? 'Убрать из корзины: ' : 'Добавить в корзину: ') + book.title);
      var shortLabel = btn.querySelector('.add-btn__text');
      if (shortLabel) shortLabel.textContent = added ? 'В корзине' : 'В корзину';
      var label = btn.querySelector('[data-add-label]');
      if (label) label.textContent = added ? 'В корзине' : 'В корзину';
    });

    document.querySelectorAll('[data-fav="' + id + '"]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(fav));
      btn.setAttribute('aria-label', (fav ? 'Убрать из избранного: ' : 'В избранное: ') + book.title);
      var label = btn.querySelector('[data-fav-label]');
      if (label) label.textContent = fav ? 'В избранном' : 'В избранное';
    });
  }

  /* ---------- Уведомления ---------- */

  function toast(message) {
    var stack = document.querySelector('[data-toasts]');
    if (!stack) return;
    var node = document.createElement('div');
    node.className = 'toast';
    node.setAttribute('role', 'status');
    node.innerHTML = icons.check + '<span>' + esc(message) + '</span>';
    stack.appendChild(node);
    window.setTimeout(function () {
      node.classList.add('is-out');
      window.setTimeout(function () {
        if (node.parentNode) node.parentNode.removeChild(node);
      }, 320);
    }, 2600);
  }

  /* ---------- Панели, модальное окно, блокировка прокрутки ---------- */

  function lockBody() {
    document.body.classList.add('is-locked');
  }

  function unlockBody() {
    if (!document.querySelector('[data-panel].is-open') && !document.querySelector('.modal.is-open')) {
      document.body.classList.remove('is-locked');
    }
  }

  function restoreFocus() {
    if (state.lastFocus && document.contains(state.lastFocus)) {
      try {
        state.lastFocus.focus({ preventScroll: true });
      } catch (error) {
        state.lastFocus.focus();
      }
    }
    state.lastFocus = null;
  }

  function openPanel(name) {
    var panel = document.querySelector('[data-panel="' + name + '"]');
    if (!panel) return;
    closePanels(true);
    state.lastFocus = document.activeElement;

    if (name === 'cart') {
      state.checkout = false;
      state.order = null;
      renderCart();
    }
    if (name === 'favorites') renderFavorites();

    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    var overlay = document.querySelector('[data-overlay]');
    if (overlay) overlay.classList.add('is-open');
    lockBody();

    var target = panel.querySelector('.drawer__close') || panel.querySelector('input, button');
    if (target) {
      window.setTimeout(function () {
        try { target.focus({ preventScroll: true }); } catch (error) { target.focus(); }
      }, 160);
    }
  }

  function closePanels(silent) {
    document.querySelectorAll('[data-panel].is-open').forEach(function (panel) {
      panel.classList.remove('is-open');
      panel.setAttribute('aria-hidden', 'true');
    });
    var overlay = document.querySelector('[data-overlay]');
    if (overlay) overlay.classList.remove('is-open');
    unlockBody();
    if (!silent) restoreFocus();
  }

  // Раскрывает и скрывает список жанров в меню по кнопке «Категории»
  function toggleMenuCategories(button) {
    var list = document.getElementById(button.getAttribute('aria-controls'));
    if (!list) return;
    var open = list.classList.toggle('is-open');
    button.setAttribute('aria-expanded', String(open));
  }

  function openBook(id) {
    var book = byId[id];
    var modal = document.querySelector('[data-modal]');
    var content = document.querySelector('[data-modal-content]');
    if (!book || !modal || !content) return;

    closePanels(true);
    state.lastFocus = document.activeElement;
    content.innerHTML = bookDetailMarkup(book);
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    lockBody();

    var closeBtn = modal.querySelector('.modal__close');
    if (closeBtn) {
      window.setTimeout(function () {
        try { closeBtn.focus({ preventScroll: true }); } catch (error) { closeBtn.focus(); }
      }, 140);
    }
  }

  function closeBookModal() {
    var modal = document.querySelector('[data-modal]');
    if (!modal || !modal.classList.contains('is-open')) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    unlockBody();
    restoreFocus();
  }

  function trapFocus(container, event) {
    var nodes = Array.prototype.filter.call(
      container.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])'
      ),
      function (node) { return node.offsetParent !== null; }
    );
    if (!nodes.length) return;
    var first = nodes[0];
    var last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /* ---------- Действия ---------- */

  function toggleCart(id) {
    var book = byId[id];
    if (!book) return;
    var index = state.cart.indexOf(id);

    if (index === -1) {
      state.cart.push(id);
      toast('«' + book.title + '» — в корзине');
    } else {
      state.cart.splice(index, 1);
      toast('«' + book.title + '» убрали из корзины');
      if (!state.cart.length) {
        state.checkout = false;
        state.order = null;
      }
    }

    saveJSON(STORAGE.cart, state.cart);
    syncBookButtons(id);
    renderBadges();
    renderCart();
    if (document.querySelector('[data-panel="favorites"].is-open')) renderFavorites();
  }

  function toggleFav(id) {
    var book = byId[id];
    if (!book) return;
    var index = state.favs.indexOf(id);

    if (index === -1) {
      state.favs.push(id);
      toast('«' + book.title + '» — в избранном');
    } else {
      state.favs.splice(index, 1);
      toast('«' + book.title + '» убрали из избранного');
    }

    saveJSON(STORAGE.favs, state.favs);
    syncBookButtons(id);
    renderBadges();
    if (document.querySelector('[data-panel="favorites"].is-open')) renderFavorites();
  }

  function addAllFavorites() {
    var added = 0;
    state.favs.forEach(function (id) {
      if (state.cart.indexOf(id) === -1 && byId[id]) {
        state.cart.push(id);
        added += 1;
      }
    });
    if (!added) {
      toast('Все книги из избранного уже в корзине');
      return;
    }
    saveJSON(STORAGE.cart, state.cart);
    renderCart();
    renderBadges();
    renderCatalog();
    renderFavorites();
    toast('Добавили ' + added + ' ' + booksWord(added) + ' в корзину');
  }

  function resetFilters() {
    state.category = 'all';
    state.conditions = [];
    state.rareOnly = false;
    state.maxPrice = PRICE_MAX;
    state.query = '';
    renderCatalog();
  }

  function submitCheckout(form) {
    var name = form.elements.name;
    var phone = form.elements.phone;
    var email = form.elements.email;
    var agree = form.elements.agree;
    var invalid = [];
    var digits = phone.value.replace(/\D/g, '');

    form.querySelectorAll('.field').forEach(function (field) {
      field.classList.remove('is-invalid');
    });

    if (name.value.trim().length < 2) invalid.push(name);
    if (digits.length < 10) invalid.push(phone);
    if (email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) invalid.push(email);
    if (!agree.checked) invalid.push(agree);

    invalid.forEach(function (input) {
      var field = input.closest ? input.closest('.field') : null;
      if (field) field.classList.add('is-invalid');
    });

    if (invalid.length) {
      invalid[0].focus();
      toast('Проверьте выделенные поля');
      return;
    }

    var total = cartTotal();
    state.order = {
      number: 'ГК-' + String(Math.floor(1000 + Math.random() * 9000)),
      name: name.value.trim(),
      phone: phone.value.trim(),
      email: email.value.trim(),
      delivery: form.elements.delivery.value,
      total: total,
      count: state.cart.length
    };
    state.cart = [];
    state.checkout = true;
    saveJSON(STORAGE.cart, state.cart);

    renderCatalog();
    renderBadges();
    renderCart();
    toast('Заказ принят — ' + money(total));
  }

  /* ---------- События ---------- */

  function onClick(event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var action;

    action = target.closest('[data-add]');
    if (action) { toggleCart(action.dataset.add); return; }

    action = target.closest('[data-fav]');
    if (action) { toggleFav(action.dataset.fav); return; }

    action = target.closest('[data-open-book]');
    if (action) { openBook(action.dataset.openBook); return; }

    action = target.closest('[data-remove]');
    if (action) { toggleCart(action.dataset.remove); return; }

    action = target.closest('[data-remove-fav]');
    if (action) { toggleFav(action.dataset.removeFav); return; }

    action = target.closest('[data-open-panel]');
    if (action) { openPanel(action.dataset.openPanel); return; }

    action = target.closest('[data-close-panel]');
    if (action) { closePanels(); return; }

    action = target.closest('[data-close-modal]');
    if (action) { closeBookModal(); return; }

    action = target.closest('[data-menu-categories]');
    if (action) { toggleMenuCategories(action); return; }

    action = target.closest('[data-category]');
    if (action) {
      state.category = action.dataset.category;
      renderCatalog();
      // Жанр выбран внутри меню — закрываем панель, чтобы был виден отфильтрованный каталог
      if (action.closest('[data-panel]')) closePanels();
      return;
    }

    if (target.closest('[data-reset-filters]')) { resetFilters(); return; }

    if (target.closest('[data-apply-filters]')) {
      closePanels();
      toast('Фильтры применены — ' + filtersBooksWord());
      return;
    }

    if (target.closest('[data-checkout]')) {
      state.checkout = true;
      state.order = null;
      renderCart();
      return;
    }

    if (target.closest('[data-checkout-back]')) {
      state.checkout = false;
      state.order = null;
      renderCart();
      return;
    }

    if (target.closest('[data-add-all]')) { addAllFavorites(); return; }

    if (target.closest('[data-goto-catalog]')) {
      closeBookModal();
      closePanels();
      scrollToCatalog();
    }
  }

  function filtersBooksWord() {
    var count = filteredBooks().length;
    return count + ' ' + booksWord(count);
  }

  function scrollToCatalog() {
    var catalog = document.getElementById('catalog');
    // Метода может не быть (тестовый DOM-стаб) — тогда просто ничего не делаем
    if (!catalog || typeof catalog.scrollIntoView !== 'function') return;
    try {
      catalog.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      catalog.scrollIntoView();
    }
  }

  var searchTimer = null;
  // Флаг «сессии ввода»: к каталогу прокручиваем один раз, а не на каждый символ
  var searchScrolled = false;

  function applySearch(value, source) {
    state.query = String(value == null ? '' : value);

    if (!state.query) {
      // Поле очищено — следующая попытка поиска снова подведёт каталог к экрану
      searchScrolled = false;
    } else if (!searchScrolled) {
      // Первый символ в поиске шапки: прокручиваем к каталогу, иначе результат
      // фильтрации остаётся за пределами экрана. Шапка закреплена, поэтому
      // поле поиска не уезжает и ввод можно продолжать.
      searchScrolled = true;
      scrollToCatalog();
    }

    document.querySelectorAll('[data-search]').forEach(function (input) {
      if (input !== source && input.value !== state.query) input.value = state.query;
    });
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(renderCatalog, 140);
  }

  function onInput(event) {
    var input = event.target;
    if (!input.matches) return;

    if (input.matches('[data-search]')) {
      applySearch(input.value, input);
      return;
    }

    if (input.matches('[data-max-price]')) {
      state.maxPrice = Number(input.value);
      document.querySelectorAll('[data-price-label]').forEach(function (node) {
        node.textContent = money(state.maxPrice);
      });
      renderCatalog();
    }
  }

  function onChange(event) {
    var input = event.target;
    if (!input.matches) return;

    if (input.matches('[data-condition]')) {
      var index = state.conditions.indexOf(input.value);
      if (input.checked && index === -1) state.conditions.push(input.value);
      if (!input.checked && index !== -1) state.conditions.splice(index, 1);
      renderCatalog();
      return;
    }

    if (input.matches('[data-rare]')) {
      state.rareOnly = input.checked;
      renderCatalog();
      return;
    }

    if (input.matches('[data-sort]')) {
      state.sort = input.value;
      renderCatalog();
      return;
    }

    if (input.matches('[data-max-price]')) {
      state.maxPrice = Number(input.value);
      renderCatalog();
    }
  }

  function onSubmit(event) {
    var form = event.target;
    if (!form.matches) return;

    if (form.matches('[data-subscribe]')) {
      event.preventDefault();
      var email = form.querySelector('input[type="email"]');
      if (!email || !email.value.trim()) {
        toast('Укажите email — и мы напишем первыми');
        return;
      }
      toast('Заявка принята. Ответим на ' + email.value.trim());
      form.reset();
      return;
    }

    if (!form.matches('[data-checkout-form]')) return;
    event.preventDefault();
    submitCheckout(form);
  }

  function onKeydown(event) {
    if (event.key === 'Escape') {
      if (document.querySelector('.modal.is-open')) { closeBookModal(); return; }
      if (document.querySelector('[data-panel].is-open')) { closePanels(); return; }
    }

    if (event.key !== 'Tab') return;

    var modal = document.querySelector('.modal.is-open');
    if (modal) { trapFocus(modal, event); return; }

    var panel = document.querySelector('[data-panel].is-open');
    if (panel) trapFocus(panel, event);
  }

  /* ---------- Инициализация ---------- */

  function initReveal() {
    var nodes = document.querySelectorAll('[data-reveal]');
    if (!nodes.length) return;

    if (!('IntersectionObserver' in window)) {
      nodes.forEach(function (node) { node.classList.add('is-visible'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });

    nodes.forEach(function (node) { observer.observe(node); });
  }

  function initHeader() {
    var header = document.querySelector('[data-header]');
    if (!header) return;
    var update = function () {
      header.classList.toggle('is-stuck', window.scrollY > 8);
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  function init() {
    renderBadges();
    renderCatalog();
    renderCart();
    renderFavorites();
    initReveal();
    initHeader();

    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    document.addEventListener('change', onChange);
    document.addEventListener('submit', onSubmit);
    document.addEventListener('keydown', onKeydown);

    document.querySelectorAll('[data-year]').forEach(function (node) {
      node.textContent = new Date().getFullYear();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

