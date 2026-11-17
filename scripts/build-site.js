/* ============================================================
   ГОРЫ-КНИГ — сборка сайта
   1) склеивает шаблоны src/pages/*.html с partials;
   2) встраивает CSS, JS и шрифты (base64) прямо в HTML;
   3) пишет автономные страницы в dist/ и архив dist/gory-knig-site.zip.
   Запуск: node scripts/build-site.js
   ============================================================ */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const STAGE = path.join(DIST, '.stage');
const PAGES = ['index.html', 'desktop.html', 'mobile.html'];
const INCLUDE_RE = /^<!-- include: (.+?) -->$/;

// Склейка шаблона страницы с partials (include занимает целую строку)
function expandIncludes(pageFile) {
  const out = [];
  for (const line of fs.readFileSync(pageFile, 'utf8').split('\n')) {
    const match = line.match(INCLUDE_RE);
    if (!match) { out.push(line); continue; }

    const partialPath = path.join(SRC, match[1]);
    if (!fs.existsSync(partialPath)) {
      throw new Error('не найден partial: ' + match[1] + ' (' + path.basename(pageFile) + ')');
    }

    const partial = fs.readFileSync(partialPath, 'utf8').split('\n');
    if (partial[partial.length - 1] === '') partial.pop();
    out.push(...partial);
  }
  return out.join('\n');
}

// Файл шрифта -> data URI
function fontDataUri(fontFile) {
  return 'data:font/woff2;base64,' + fs.readFileSync(fontFile).toString('base64');
}

// CSS: локальные url(...) заменяем встроенными данными
function inlineCssFile(cssFile) {
  const cssDir = path.dirname(cssFile);
  const css = fs.readFileSync(cssFile, 'utf8');
  return css.replace(/url\('([^']+)'\)/g, (whole, rel) => {
    if (/^(data:|https?:)/.test(rel)) return whole;
    const target = path.resolve(cssDir, rel);
    return fs.existsSync(target) ? "url('" + fontDataUri(target) + "')" : whole;
  });
}

// Встраивание <link rel="stylesheet"> и <script src> в HTML
function inlineAssets(html) {
  let result = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (whole, href) =>
    '<style data-inlined="' + href + '">\n' + inlineCssFile(path.join(ROOT, href)) + '\n</style>');

  result = result.replace(/<script src="([^"]+)"><\/script>/g, (whole, src) =>
    '<script data-inlined="' + src + '">\n' + fs.readFileSync(path.join(ROOT, src), 'utf8') + '\n</script>');

  return result;
}

// Автономные страницы для архива + лицензии шрифтов
function fillStage() {
  const bundle = path.join(STAGE, 'gory-knig');
  fs.mkdirSync(path.join(bundle, 'licenses'), { recursive: true });

  for (const page of ['desktop.html', 'mobile.html']) {
    fs.copyFileSync(path.join(DIST, page), path.join(bundle, page));
  }

  const fontsDir = path.join(ROOT, 'assets/fonts');
  for (const name of fs.readdirSync(fontsDir)) {
    if (!name.startsWith('LICENSE-')) continue;
    fs.copyFileSync(path.join(fontsDir, name), path.join(bundle, 'licenses', name));
  }
}

function build() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  for (const page of PAGES) {
    const html = inlineAssets(expandIncludes(path.join(SRC, 'pages', page)));
    fs.writeFileSync(path.join(DIST, page), html);
    console.log('страница: dist/' + page + ' — ' + Math.round(html.length / 1024) + ' КБ');
  }

  fillStage();

  const zipPath = path.join(DIST, 'gory-knig-site.zip');
  execFileSync('zip', ['-r', '-X', zipPath, 'gory-knig'], { cwd: STAGE });
  fs.rmSync(STAGE, { recursive: true, force: true });
  console.log('архив: dist/gory-knig-site.zip');
}

build();
