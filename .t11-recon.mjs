import fs from 'node:fs';
import { openHost, cssFor, mapFor, frontendCss } from './scripts/lib/host.mjs';
const host = openHost();
const right = host.file('@deepseek-ai/dsh-client-ui-sidebar-right/lib/client.js');
console.log('=== ExpandButton.module.css ===');
try { console.log(cssFor(right, '@deepseek-ai/dsh-client-ui-sidebar-right/ExpandButton.module.css').replace(/}/g, '}\n')); } catch (e) { console.log('ERR ' + e.message); }
console.log('\n=== dockkit empty class in frontend css ===');
const front = frontendCss(host);
const hash = /\\._tabCell_(\w+?)_\d+/.exec(front)?.[1];
console.log('dockkit hash = ' + hash);
const dockCss = [...front.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => m[1].includes('_' + hash + '_')).map((m) => m[0]).join('\n');
for (const m of dockCss.matchAll(/([^{}]*_empty[^{}]*)\{([^{}]*)\}/g)) console.log('  ' + m[0].replace(/\s+/g, ' '));
console.log('\n=== dockkit empty in right bundle css? ===');
const rc = cssFor(right, '@deepseek-ai/dsh-client-ui-sidebar-right/SidebarRight.module.css');
for (const m of rc.matchAll(/([^{}]*empty[^{}]*)\{([^{}]*)\}/g)) console.log('  ' + m[0].replace(/\s+/g, ' '));