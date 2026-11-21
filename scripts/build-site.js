/* ============================================================
   ГОРЫ-КНИГ — сборка сайта (CLI)
   Запуск: node scripts/build-site.js
   Результат: dist/index.html, dist/desktop.html, dist/mobile.html,
   dist/gory-knig-site.zip. Сама логика — в scripts/lib/build.js
   ============================================================ */

const { build } = require('./lib/build');

build();

