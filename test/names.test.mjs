import { fitName, condenseTitle, planSegments, safeSegment } from '../index.js'

const now = new Date(2026, 10, 12, 10, 30, 0)
const session = { id: 'abc123def456' }
let fails = 0
function eq(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) { fails++; console.log(`FAIL ${name}: got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`) }
  else console.log(`ok   ${name}: ${JSON.stringify(actual)}`)
}

eq('summary wins', planSegments('{date}-{title}', now, session, { title: '帮我看看登录页为什么闪退', summary: '登录页闪退', titleChars: 6 }), ['2026-11-12-登录页闪退'])
eq('summary over budget is trimmed', fitName('登录页闪退排查与修复方案', 6), '登录页闪退排')
eq('quotes stripped', fitName('「登录页闪退」', 6), '登录页闪退')
eq('trailing punctuation', fitName('登录页闪退。', 6), '登录页闪退')
eq('empty summary falls back to slice', planSegments('{date}-{title}', now, session, { title: '帮我看看登录页为什么闪退', summary: '', titleChars: 6 }), ['2026-11-12-帮我看看登录'])
eq('slice unchanged', condenseTitle('帮我看看登录页为什么闪退', 6), '帮我看看登录')
eq('latin whole word', fitName('Auth refactor module', 6), 'Auth')
eq('latin exact', fitName('Auth', 6), 'Auth')
eq('newline noise', fitName('登录页\n闪退', 6), '登录页闪退')
eq('markdown noise', fitName('## 认证重构', 6), '认证重构')
eq('no answer sentinel', fitName('未命名', 6), '未命名')
eq('illegal chars', safeSegment('a/b:c*d'), 'a-b-c-d')
eq('colon in summary sanitized downstream', planSegments('{date}-{title}', now, session, { summary: '登录:闪退', titleChars: 6 }), ['2026-11-12-登录-闪退'])
console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)

