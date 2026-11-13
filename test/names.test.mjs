import { fitName, condenseTitle, planSegments, safeSegment } from '../index.js'

const now = new Date(2026, 10, 12, 10, 30, 0)
const session = { id: 'abc123def456' }
let fails = 0
function eq(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) { fails++; console.log(`FAIL ${name}: got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`) }
  else console.log(`ok   ${name}: ${JSON.stringify(actual)}`)
}

// ---- the summary budget is its own, wider field -------------------------
eq('summary wins over slicing', planSegments('{date}-{title}', now, session, { title: '帮我看看登录页为什么闪退', summary: '登录页闪退', titleChars: 6, summaryChars: 15 }), ['2026-11-12-登录页闪退'])
eq('15-char summary survives whole', fitName('SMB 与 WMI 连通性排查', 15), 'SMB 与 WMI 连通性排查')
eq('summary over 15 is cut at 15', Array.from(fitName('排查 SMB 与 WMI 连接失败并修复共享访问', 15)).length, 15)
eq('empty summary falls back to slice', planSegments('{date}-{title}', now, session, { title: '帮我看看登录页为什么闪退', summary: '', titleChars: 6, summaryChars: 15 }), ['2026-11-12-帮我看看登录'])
eq('slicing still honours its own budget', condenseTitle('帮我看看登录页为什么闪退', 6), '帮我看看登录')
eq('summary ignores the slicing budget', planSegments('{title}', now, session, { title: '忽略我', summary: '登录页闪退排查', titleChars: 2, summaryChars: 15 }), ['登录页闪退排查'])

// ---- cleaning ------------------------------------------------------------
eq('quotes stripped', fitName('「登录页闪退」', 15), '登录页闪退')
eq('label prefix stripped', fitName('文件夹名：登录页闪退排查', 15), '登录页闪退排查')
eq('trailing punctuation', fitName('登录页闪退。', 15), '登录页闪退')
eq('markdown noise', fitName('## 认证重构', 15), '认证重构')
eq('newline noise', fitName('登录页\n闪退', 15), '登录页闪退')
eq('latin whole word', fitName('Auth refactor module', 6), 'Auth')
eq('sentinel passes through', fitName('未命名', 15), '未命名')
eq('illegal chars sanitized on write', planSegments('{date}-{title}', now, session, { summary: '登录:闪退', summaryChars: 15 }), ['2026-11-12-登录-闪退'])
eq('path separator cannot escape', safeSegment('a/b:c*d'), 'a-b-c-d')
console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)
