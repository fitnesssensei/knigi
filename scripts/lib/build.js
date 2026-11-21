/* ============================================================
   ГОРЫ-КНИГ — логика сборки (используется CLI и автотестами)
   1) склеивает шаблоны src/pages/*.html с partials;
   2) встраивает CSS, JS и шрифты (base64) прямо в HTML;
   3) пишет автономные страницы в dist/ и архив dist/gory-knig-site.zip.
   ============================================================ */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const PAGES = ['index.html', 'desktop.html', 'mobile.html'];
const ARCHIVE_PAGES = ['desktop.html', 'mobile.html'];
const INCLUDE_RE = /^<!-- include: (.+?) -->$/;
const DEFAULT_ROOT = path.join(__dirname, '..', '..');

// Склейка шаблона страницы с partials (include занимает целую строку)
function expandIncludes(pageFile, srcRoot) {
  const out = [];
  for (const line of fs.readFileSync(pageFile, 'utf8').split('\n')) {
    const match = line.match(INCLUDE_RE);
    if (!match) { out.push(line); continue; }

    const partialPath = path.join(srcRoot, match[1]);
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
function inlineAssets(html, root) {
  let result = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (whole, href) =>
    '<style data-inlined="' + href + '">\n' + inlineCssFile(path.join(root, href)) + '\n</style>');

  result = result.replace(/<script src="([^"]+)"><\/script>/g, (whole, src) =>
    '<script data-inlined="' + src + '">\n' + fs.readFileSync(path.join(root, src), 'utf8') + '\n</script>');

  return result;
}

// Автономные страницы для архива + лицензии шрифтов
function fillStage({ root, dist, stage }) {
  const bundle = path.join(stage, 'gory-knig');
  fs.mkdirSync(path.join(bundle, 'licenses'), { recursive: true });

  for (const page of ARCHIVE_PAGES) {
    fs.copyFileSync(path.join(dist, page), path.join(bundle, page));
  }

  const fontsDir = path.join(root, 'assets/fonts');
  for (const name of fs.readdirSync(fontsDir)) {
    if (!name.startsWith('LICENSE-')) continue;
    fs.copyFileSync(path.join(fontsDir, name), path.join(bundle, 'licenses', name));
  }
  return bundle;
}

// Сборка: root — корень проекта, dist — куда писать результат
function build(options = {}) {
  const root = options.root || DEFAULT_ROOT;
  const dist = options.dist || path.join(root, 'dist');
  const makeArchive = options.makeArchive !== false;
  const quiet = options.quiet === true;
  const stage = path.join(dist, '.stage');

  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });

  const pages = {};
  for (const page of PAGES) {
    const html = inlineAssets(expandIncludes(path.join(root, 'src/pages', page), path.join(root, 'src')), root);
    fs.writeFileSync(path.join(dist, page), html);
    pages[page] = html;
    if (!quiet) console.log('страница: ' + page + ' — ' + Math.round(html.length / 1024) + ' КБ');
  }

  let zipPath = null;
  if (makeArchive) {
    fillStage({ root, dist, stage });
    zipPath = path.join(dist, 'gory-knig-site.zip');
    execFileSync('zip', ['-r', '-X', zipPath, 'gory-knig'], { cwd: stage });
    fs.rmSync(stage, { recursive: true, force: true });
    if (!quiet) console.log('архив: gory-knig-site.zip');
  }

  return { root, dist, pages, zipPath };
}

module.exports = { PAGES, ARCHIVE_PAGES, expandIncludes, inlineAssets, inlineCssFile, build };

