const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/features/shipping/providers/live-date-window.ts'), 'utf8');
const exportsObject = {};
new Function('exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(exportsObject);
const { liveDateWindow } = exportsObject;
const now = new Date('2026-10-25T16:30:00Z'); // Already Oct 26 in Shanghai.
assert.deepEqual(liveDateWindow('2026-10-25', '2026-11-22', now), { from: '2026-10-26', adjusted: true, expired: false });
assert.deepEqual(liveDateWindow('2026-10-26', '2026-11-22', now), { from: '2026-10-26', adjusted: false, expired: false });
assert.deepEqual(liveDateWindow('2026-10-27', '2026-11-22', now), { from: '2026-10-27', adjusted: false, expired: false });
assert.equal(liveDateWindow('2026-10-20', '2026-10-25', now).expired, true);
console.log('PASS: past, current, future, expired windows and Shanghai timezone boundary');
