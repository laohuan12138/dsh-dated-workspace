import { readFileSync } from 'node:fs'
const src = readFileSync('index.js', 'utf8')
const checks = [
  ['summaryMode is a schema field', /summaryMode: schema/],
  ['summaryChars is a schema field', /summaryChars: schema/],
  ['defaults to ai', /summaryMode[\s\S]{0,80}default\('ai'\)/],
  ['summary budget defaults to 15', /const DEFAULT_SUMMARY_CHARS = 15/],
  ['summary prompt forbids copying', /不是摘抄/],
  ['label prefix is stripped', /文件夹名\|名字\|名称\|简称/],
  ['renames only when idle', /live\.status !== 'running'/],
  ['warns once when llm is missing', /summaryBlocked/],
  ['traces every attempt', /summary:start/],
  ['summary budget reaches planSegments', /summaryChars: read\('summaryChars'/],
]
let bad = 0
for (const [name, re] of checks) {
  const ok = re.test(src)
  if (!ok) bad++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`)
}
process.exit(bad === 0 ? 0 : 1)
