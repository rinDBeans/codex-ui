#!/usr/bin/env node
/**
 * pack-host-asar.mjs — 没有桌面壳时，用 npm 装的宿主包拼一份夹具能读的 app.asar。
 *
 * 夹具（*-verify.mjs）读的是 app.asar 里 dsh/node_modules/@deepseek-ai/<包>/… 的 shipped 源码。
 * 桌面壳与 npm 发布的是同一批 dsh-client-ui-* 包（0.1.7-rc.2 两边 dsh-web-frontend 的
 * index-DUvMhLle.css 哈希一致），所以把 npm 装下来的那一批按同样的目录打成 asar，夹具就能照跑。
 *
 *   npm install @deepseek-ai/dsh@0.1.7-rc.2 --prefix <临时目录>
 *   node scripts/pack-host-asar.mjs --from <临时目录>/node_modules [--out <路径>/app.asar]
 *   DSH_ASAR=<out>  DSH_GLOBAL_MODULES=<临时目录>/node_modules  node scripts/hero-verify.mjs
 *
 * 只收 dsh-client-ui-* 与 dsh-web-frontend（夹具只读这些），跳过字体、图片与 source map。
 *
 * 格式：标准 asar（Pickle 头 + JSON 目录 + 文件体）。JSON 用空格补到 4 字节整数倍 ——
 * 夹具按 16 + JSON 长度 求数据起点，而规范是 8 + 头 Pickle 长度，两者只在 JSON 长度是 4 的倍数时相等。
 */
import fs from 'node:fs';
import { join } from 'node:path';
import { tempDir } from './host-paths.mjs';

const arg = (name, fallback) => {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback;
};
const FROM = arg('from', process.env.DSH_GLOBAL_MODULES ?? '');
const OUT = arg('out', join(tempDir('codex-ui-host'), 'app.asar'));
const SCOPE = join(FROM, '@deepseek-ai');
if (FROM === '' || !fs.existsSync(SCOPE)) {
  console.error('找不到 ' + SCOPE + '。先 npm install @deepseek-ai/dsh --prefix <目录>，再用 --from <目录>/node_modules 指过来。');
  process.exit(2);
}

const packages = fs.readdirSync(SCOPE).filter((name) => name.startsWith('dsh-client-ui-') || name === 'dsh-web-frontend').sort();
const tree = { files: {} };
const bodies = [];
let offset = 0;
const SKIP_DIR = new Set(['node_modules', 'fonts', 'langs']);
const SKIP_FILE = /\.(woff2?|ttf|otf|png|jpe?g|gif|webp|map|wasm)$/i;

function add(abs, parts) {
  let node = tree;
  for (const seg of parts.slice(0, -1)) {
    node.files[seg] ??= { files: {} };
    node = node.files[seg];
  }
  const size = fs.statSync(abs).size;
  node.files[parts.at(-1)] = { size, offset: String(offset) };
  bodies.push(abs);
  offset += size;
}
function walk(abs, parts) {
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIR.has(entry.name)) walk(join(abs, entry.name), [...parts, entry.name]);
    } else if (entry.isFile() && !SKIP_FILE.test(entry.name)) {
      add(join(abs, entry.name), [...parts, entry.name]);
    }
  }
}
for (const name of packages) walk(join(SCOPE, name), ['dsh', 'node_modules', '@deepseek-ai', name]);

let json = JSON.stringify(tree);
while (Buffer.byteLength(json) % 4 !== 0) json += ' ';
const header = Buffer.from(json);
const head = Buffer.alloc(16);
head.writeUInt32LE(4, 0);
head.writeUInt32LE(8 + header.length, 4);
head.writeUInt32LE(4 + header.length, 8);
head.writeUInt32LE(header.length, 12);
fs.mkdirSync(join(OUT, '..'), { recursive: true });
const fd = fs.openSync(OUT, 'w');
fs.writeSync(fd, head);
fs.writeSync(fd, header);
for (const file of bodies) fs.writeSync(fd, fs.readFileSync(file));
fs.closeSync(fd);

const version = (() => {
  try { return JSON.parse(fs.readFileSync(join(SCOPE, 'dsh', 'package.json'), 'utf8')).version; } catch { return '?'; }
})();
console.log('宿主版本 : @deepseek-ai/dsh ' + version);
console.log('收录     : ' + packages.length + ' 个包 · ' + bodies.length + ' 个文件 · ' + offset + ' B');
console.log('写出     : ' + OUT);
console.log('接着     : DSH_ASAR="' + OUT + '" DSH_GLOBAL_MODULES="' + FROM + '" node scripts/<夹具>.mjs');
