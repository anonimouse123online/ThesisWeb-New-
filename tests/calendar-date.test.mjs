import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/utils/dates.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
  fileName: 'dates.ts',
});
const { formatCalendarDate } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('task calendar dates stay YYYY-MM-DD and do not shift in another timezone', () => {
  const originalTimezone = process.env.TZ;
  process.env.TZ = 'America/Los_Angeles';
  try {
    assert.equal(formatCalendarDate('2026-10-29'), '2026-10-29');
    assert.equal(formatCalendarDate('2026-10-29T00:00:00.000Z'), '2026-10-29');
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
});
