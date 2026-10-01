import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildThemeCss } from '@ems/config';

/** Generate the web stylesheet from the shared design tokens so @ems/config
 *  stays the single source of truth (PLAN.md §6). Runs on predev/prebuild. */
const out = resolve(process.cwd(), 'src/app/theme.generated.css');
mkdirSync(dirname(out), { recursive: true });

const banner =
  '/* AUTO-GENERATED from @ems/config buildThemeCss(). Do not edit by hand.\n' +
  '   Regenerate: pnpm --filter frontend gen:theme */\n';

writeFileSync(out, banner + buildThemeCss(), 'utf8');
console.log('Generated', out);
