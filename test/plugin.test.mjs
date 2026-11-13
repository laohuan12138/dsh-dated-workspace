import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../index.js'

let fails = 0
const check = (name, cond, extra = '') => {
  if (cond) console.log(`ok   ${name}`)
  else { fails++; console.log(`FAIL ${name} ${extra}`) }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

function makeSession({ id, cwd, events = [] }) {
  const log = [...events]
  return {
    id,
    header: { id, cwd, createdAt: new Date(2026, 10, 12, 9, 0, 0).toISOString(), origin: 'user' },
    snapshotEvents: () => log,
    append: (type, data) => log.push({ type, data }),
    log,
  }
}
const userMessage = (text) => ({ role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text }] })
const assistantMessage = (text) => ({ role: 'assistant', source: { kind: 'model' }, content: [{ type: 'text', text }] })

/** One host: a workspace, a working directory projection, a model, handlers. */
function makeHost({ reply = '「登录页闪退排查」', broken = false } = {}) {
  const state = { current: undefined, setCalls: [], modelCalls: [], handlers: new Map() }
  const api = {
    state,
    handlers: state.handlers,
    llm: {
      async prepareCall(config, _signal, configure) {
        state.modelCalls.push({ ...config })
        if (broken) throw new Error('boom')
        const controls = configure ? configure({ ...config }, { reasoning: { efforts: [{ id: 'low' }, { id: 'high' }] } }) : config
        state.modelCalls[state.modelCalls.length - 1] = controls
        return {
          config: controls,
          stream: async function* () {
            yield { type: 'text-delta', text: reply }
            yield { type: 'finish', reason: { kind: 'stop' } }
          },
        }
      },
    },
  }
  api.ctx = {
    effect(fn) { return fn() },
    on(name, fn) { state.handlers.set(name, fn); return () => state.handlers.delete(name) },
    get(name) {
      if (name === 'llm') return api.llm
      if (name === 'agentDefaultModel') return { currentSelection: () => ({ provider: 'new-api', model: 'deepseek-v4.1-flash' }) }
      if (name === 'agents') return { get: () => api.agent }
      return undefined
    },
    logger: { warn: (m) => console.log('   warn:', m.replace(/\n/g, ' ')) },
    workingDirectory: {
      defaultDirectory: '',
      get: () => state.current,
      set: async (_agent, dir) => { state.current = dir; state.setCalls.push(dir) },
    },
  }
  return api
}

const config = (workspace, over = {}) => ({
  enabled: true,
  workspace,
  folderName: '{date}-{title}',
  titleChars: 6,
  summaryMode: 'ai',
  summaryProvider: '',
  summaryModel: '',
  summaryTimeoutMs: 5000,
  collision: 'suffix',
  createMode: 'immediate',
  ...over,
})

// ---- 1. new session: folder at once, AI name at the turn boundary -------
{
  const workspace = await mkdtemp(join(tmpdir(), 'dw-a-'))
  const host = makeHost()
  host.ctx.workingDirectory.defaultDirectory = workspace
  apply(host.ctx, config(workspace))

  const session = makeSession({ id: 'sess-abc123', cwd: workspace })
  const agent = { session }
  host.agent = agent
  host.state.current = workspace

  await host.handlers.get('agent/created')({ agent }); await wait(120)
  let entries = await readdir(workspace)
  check('a. folder created immediately', entries.length === 1, JSON.stringify(entries))
  check('b. named after the session id when nothing else is known', entries[0].startsWith('2026-11-12-'), entries[0])
  check('c. cwd moved inside', host.state.current === join(workspace, entries[0]), host.state.current)

  const messages = [userMessage('登录页一打开就闪退，帮我看看为什么，最好顺便把测试补上')]
  await host.handlers.get('agent/pre-step')({ agent, messages }, () => Promise.resolve())
  await wait(200)

  entries = await readdir(workspace)
  check('d. exactly one folder after the rename', entries.length === 1, JSON.stringify(entries))
  check('e. renamed to the condensed name (15-char budget keeps the whole phrase)', entries[0] === '2026-11-12-登录页闪退排查', entries[0])
  check('f. cwd follows the rename', host.state.current === join(workspace, entries[0]), host.state.current)
  check('g. one model call', host.state.modelCalls.length === 1, String(host.state.modelCalls.length))
  check('h. cheapest reasoning effort requested', host.state.modelCalls[0]?.reasoningEffort === 'low', JSON.stringify(host.state.modelCalls[0]))

  // A second turn must not re-condense the same opening message.
  await host.handlers.get('agent/pre-step')({ agent, messages }, () => Promise.resolve())
  await wait(100)
  check('i. no second model call for the same message', host.state.modelCalls.length === 1, String(host.state.modelCalls.length))

  await rm(workspace, { recursive: true, force: true })
}

// ---- 2. a model that fails must not lose the folder ---------------------
{
  const workspace = await mkdtemp(join(tmpdir(), 'dw-b-'))
  const host = makeHost({ broken: true })
  host.ctx.workingDirectory.defaultDirectory = workspace
  apply(host.ctx, config(workspace))
  const session = makeSession({ id: 'sess-broken', cwd: workspace })
  const agent = { session }
  host.agent = agent
  host.state.current = workspace
  await host.handlers.get('agent/created')({ agent })
  session.append('user/message', userMessage('登录页闪退，帮我看看为什么'))
  await host.handlers.get('agent/pre-step')({ agent, messages: [userMessage('登录页闪退，帮我看看为什么')] }, () => Promise.resolve())
  await wait(200)
  const entries = await readdir(workspace)
  check('j. folder survives a failing model', entries.length === 1, JSON.stringify(entries))
  check('k. name falls back to the sliced title', entries[0].startsWith('2026-11-12-登录页闪'), entries[0])
  await rm(workspace, { recursive: true, force: true })
}

// ---- 3. slice mode never calls the model -------------------------------
{
  const workspace = await mkdtemp(join(tmpdir(), 'dw-c-'))
  const host = makeHost()
  host.ctx.workingDirectory.defaultDirectory = workspace
  apply(host.ctx, config(workspace, { summaryMode: 'slice' }))
  const session = makeSession({ id: 'sess-slice', cwd: workspace })
  const agent = { session }
  host.agent = agent
  host.state.current = workspace
  await host.handlers.get('agent/created')({ agent })
  await host.handlers.get('agent/pre-step')({ agent, messages: [userMessage('登录页一打开就闪退，帮我看看')] }, () => Promise.resolve())
  await wait(150)
  const entries = await readdir(workspace)
  check('l. slice mode makes no model call', host.state.modelCalls.length === 0, String(host.state.modelCalls.length))
  check('m. slice mode uses the first six characters', entries[0] === '2026-11-12-登录页一打开', entries[0])
  await rm(workspace, { recursive: true, force: true })
}

// ---- 4. a session outside the workspace is left alone ------------------
{
  const workspace = await mkdtemp(join(tmpdir(), 'dw-d-'))
  const elsewhere = await mkdtemp(join(tmpdir(), 'dw-e-'))
  const host = makeHost()
  host.ctx.workingDirectory.defaultDirectory = workspace
  apply(host.ctx, config(workspace))
  const session = makeSession({ id: 'sess-outside', cwd: elsewhere })
  host.state.current = elsewhere
  await host.handlers.get('agent/created')({ agent: { session } })
  check('n. foreign workspace untouched', host.state.current === elsewhere && host.state.setCalls.length === 0)
  await rm(workspace, { recursive: true, force: true })
  await rm(elsewhere, { recursive: true, force: true })
}

// ---- 5. subagents are skipped ------------------------------------------
{
  const workspace = await mkdtemp(join(tmpdir(), 'dw-f-'))
  const host = makeHost()
  host.ctx.workingDirectory.defaultDirectory = workspace
  apply(host.ctx, config(workspace))
  const session = makeSession({ id: 'sess-sub', cwd: workspace })
  session.header.origin = 'subagent'
  host.state.current = workspace
  await host.handlers.get('agent/created')({ agent: { session } })
  check('o. subagent untouched', host.state.setCalls.length === 0, JSON.stringify(host.state.setCalls))
  await rm(workspace, { recursive: true, force: true })
}

console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)






