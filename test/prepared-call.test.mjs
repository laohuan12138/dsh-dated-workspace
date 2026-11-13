// Reproduce the Host's prepared-call contract: prepared.stream(options) rejects
// when the config differs from the resolved one (dsh-llm callConfigEquals).
import { apply } from '../index.js'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const merge = (a, b) => ({ ...a, ...b })
function callConfigEquals(a, b) {
  if (a.provider !== b.provider || a.model !== b.model) return false
  if (a.reasoningEffort !== b.reasoningEffort || a.temperature !== b.temperature || a.maxTokens !== b.maxTokens) return false
  if (a.stop === undefined || b.stop === undefined) return a.stop === b.stop
  return true
}

let rejected = ''
const llm = {
  async prepareCall(config, _signal, configure) {
    const { provider, model, ...controls } = config
    const modelInfo = { reasoning: { efforts: [{ id: 'off', name: 'Off' }, { id: 'high', name: 'High' }] } }
    const proposed = configure === undefined
      ? config
      : { ...configure(controls, modelInfo), provider, model }
    const resolved = { maxTokens: proposed.maxTokens ?? 4096, ...proposed }
    return {
      config: resolved,
      stream: (options) => {
        if (!callConfigEquals(options, resolved)) {
          rejected = `INVALID_PREPARED_CALL: ${JSON.stringify({ options, resolved })}`
          throw new Error('prepared LLM call config changed before adapter dispatch')
        }
        return (async function* () {
          yield { type: 'text-delta', text: '登录页闪退排查' }
          yield { type: 'finish', reason: { kind: 'stop' } }
        })()
      },
    }
  },
}

const workspace = await mkdtemp(join(tmpdir(), 'dw-strict-'))
const handlers = new Map()
let current = workspace
const ctx = {
  effect: (fn) => fn(),
  on: (n, fn) => { handlers.set(n, fn); return () => {} },
  get: (n) => n === 'llm' ? llm : n === 'agentDefaultModel' ? { currentSelection: () => ({ provider: 'p', model: 'm' }) } : n === 'agents' ? { get: () => agent } : undefined,
  logger: { warn: (m) => console.log('warn:', m) },
  workingDirectory: { defaultDirectory: workspace, get: () => current, set: async (_a, d) => { current = d } },
}
apply(ctx, { enabled: true, workspace, folderName: '{date}-{title}', titleChars: 6, summaryMode: 'ai', summaryChars: 15, summaryTimeoutMs: 5000, collision: 'suffix', createMode: 'immediate' })

const log = []
const session = { id: 'sess-strict', header: { cwd: workspace, createdAt: new Date().toISOString() }, snapshotEvents: () => log, append: (t, d) => log.push({ type: t, data: d }) }
const agent = { session, status: 'idle' }
const message = { role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: '登录页一打开就闪退，帮我看看为什么' }] }

await handlers.get('agent/created')({ agent })
await new Promise((r) => setTimeout(r, 150))
await handlers.get('agent/pre-step')({ agent, messages: [message] }, () => Promise.resolve())
await new Promise((r) => setTimeout(r, 250))

const entries = await readdir(workspace)
console.log(rejected || 'no prepared-call contract violation')
console.log('folders:', JSON.stringify(entries))
const ok = !rejected && entries.some((n) => n.includes('登录页闪退排查'))
await rm(workspace, { recursive: true, force: true })
console.log(ok ? 'STRICT PREPARED CALL OK' : 'FAIL')
process.exit(ok ? 0 : 1)
