import{readdir}from'node:fs/promises';import{pathToFileURL}from'node:url';import path from'node:path';
const files=(await readdir('kanji-reading/lab/tests')).filter(f=>f.endsWith('.test.mjs')).map(f=>'kanji-reading/lab/tests/'+f);
const extra=await readdir('tests');files.push(...extra.filter(f=>f.endsWith('.test.mjs')).map(f=>'tests/'+f));
// Import into this process: nested node spawning is unavailable in some work
// environments, and must never silently turn file-level exits into test passes.
for(const file of files)await import(pathToFileURL(path.resolve(file)).href);
