/**
 * Dated workspace: every new session opened in ONE configured workspace gets
 * its own folder named `日期-会话简称`, and that session's effective working
 * directory is switched into it — so everything the session writes by relative
 * path lands inside that folder instead of the workspace root.
 *
 * The workspace is configuration, not a guess: a session is only touched when
 * its recorded `cwd` equals the configured workspace. Sessions elsewhere, in
 * other workspaces, subagents, and sessions with a working directory of their
 * own are left exactly as they were.
 *
 * The short name comes from the session title, which DSH generates after the
 * first turn. The folder is created immediately with the best name available
 * (first message text, else the session id tail) and renamed once the real
 * title lands, so a folder is never blocked on a title that may never come.
 */
import { mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises'
import { basename, join, relative, resolve, isAbsolute } from 'node:path'
import os from 'node:os'

const PLUGIN = 'dsh-dated-workspace'
const MARKER = '.dsh-dated-workspace.json'
const MARKER_VERSION = 2
const MAX_SEGMENTS = 4
const MAX_NAME_CHARS = 64
const DEFAULT_TITLE_CHARS = 6
const ILLEGAL = /[<>:"/\\|?*\u0000-\u001f]/g
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i
/** Characters with no place at the start or end of a folder name. */
const TRIM_CHARS = new Set(' -_.·,，。、:：;；!！?？\'"“”‘’()（）[]【】<>《》/\\|~`@#$%^&*+=')
/** Markdown/heading noise that would otherwise eat the name budget. */
const LEADING_NOISE = /^\s*(?:#{1,6}\s*|[-*+>]\s+|\d+[.)]\s+)/

/** Strip leading and trailing punctuation that would look like a typo. */
function trimEdges(text) {
  let start = 0
  let end = text.length
  while (start < end && TRIM_CHARS.has(text[start])) start += 1
  while (end > start && TRIM_CHARS.has(text[end - 1])) end -= 1
  return text.slice(start, end)
}

/** Optional schema so the package still loads in a minimal development profile. */
let schema
try {
  schema = (await import('@deepseek-ai/schemastery')).default
} catch (error) {
  console.warn(`[${PLUGIN}] configuration UI unavailable: ${String(error)}`)
}

/** Required services: the working directory is the whole point. */
export const inject = ['workingDirectory', 'systemPrompt']

/**
 * All fields are volatile so they stay editable from the running settings form
 * without restarting the plugin (and so the Settings page can render them).
 */
export const Config = schema
  ? schema.object({
      enabled: schema
        .boolean()
        .default(true)
        .volatile()
        .description('启用后，在下方指定的工作区里新开的会话会自动获得「日期-会话简称」文件夹。'),
      workspace: schema
        .string()
        .default('')
        .volatile()
        .description(
          '要生效的工作区路径（绝对路径）。留空表示 DSH 的默认工作区。只有 cwd 等于这个工作区的会话会被处理。',
        ),
      folderName: schema
        .string()
        .default('{date}-{title}')
        .volatile()
        .description(
          '文件夹名模板。可用 {date}（2026-11-12）、{title}（会话简称）、{time}、{session}（会话 id 尾段），用 / 分隔可建多级目录。',
        ),
      titleChars: schema
        .number()
        .min(2)
        .max(24)
        .default(DEFAULT_TITLE_CHARS)
        .volatile()
        .description('{title} 最多保留几个字，默认 6。'),
      collision: schema
        .union(['reuse', 'suffix'])
        .default('suffix')
        .volatile()
        .description(
          '同名文件夹已存在时：suffix 追加 -2、-3 另建（默认）；reuse 复用同一个。',
        ),
      createMode: schema
        .union(['immediate', 'first-message'])
        .default('immediate')
        .volatile()
        .description(
          'immediate 打开新会话就建文件夹；first-message 等发出第一条消息再建，避免留下空文件夹。',
        ),
    })
  : undefined

function expandHome(raw, home = os.homedir()) {
  const value = String(raw ?? '').trim()
  if (!value) return ''
  if (value === '~') return home
  if (value.startsWith('~/') || value.startsWith('~\\')) return join(home, value.slice(2))
  return value.replace(/%([^%]+)%/g, (whole, key) => process.env[key] ?? whole)
}

function normalizeForCompare(value) {
  const resolved = resolve(value)
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

function samePath(left, right) {
  return (
    typeof left === 'string' &&
    left.length > 0 &&
    typeof right === 'string' &&
    right.length > 0 &&
    normalizeForCompare(left) === normalizeForCompare(right)
  )
}

function isInside(candidate, root) {
  if (typeof candidate !== 'string' || typeof root !== 'string') return false
  const rest = relative(normalizeForCompare(root), normalizeForCompare(candidate))
  return rest !== '' && !rest.startsWith('..') && !isAbsolute(rest)
}

/** One filesystem-safe path segment, or '' when nothing usable is left. */
export function safeSegment(raw, max = MAX_NAME_CHARS) {
  let text = String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return ''
  text = text
    .replace(ILLEGAL, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.\s]+/g, '')
    .replace(/[-.\s]+$/g, '')
  if (!text) return ''
  if (RESERVED.test(text)) text = `_${text}`
  const chars = Array.from(text)
  if (chars.length > max) text = chars.slice(0, max).join('').replace(/[-.\s]+$/g, '')
  return text === '.' || text === '..' ? '' : text
}

/** Code points, so an emoji or a CJK character is never split in half. */
const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/

/**
 * Condense a session title into a short folder name.
 *
 * CJK text is cut at the character budget, which is what "五六个字" means. Latin
 * text is cut at a word boundary near that budget so `Refactor the auth module`
 * becomes `Refactor` rather than `Refact`.
 */
export function condenseTitle(raw, maxChars = DEFAULT_TITLE_CHARS) {
  const budget = Math.max(2, Math.min(24, Math.trunc(Number(maxChars) || DEFAULT_TITLE_CHARS)))
  let text = String(raw ?? '')
    .replace(LEADING_NOISE, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return ''

  // Drop a "标题：xxx" style prefix users sometimes paste along with the text.
  const prefixed = text.match(/^(?:标题|话题|会话|主题)\s*[:：]\s*(.+)$/)
  if (prefixed) text = prefixed[1].trim()
  text = trimEdges(text)
  if (!text) return ''

  const chars = Array.from(text)
  if (CJK.test(text)) {
    // "五六个字" is a character count, so cut at the budget directly.
    return trimEdges(chars.slice(0, budget).join(''))
  }

  // Latin: prefer whole words that fit. A single long first word is kept whole
  // while it stays within twice the budget — "Refactor" reads as a name where
  // "Refact" reads as a typo.
  const words = text.split(' ').filter(Boolean)
  let out = ''
  for (const word of words) {
    const candidate = out ? `${out} ${word}` : word
    if (Array.from(candidate).length > budget) break
    out = candidate
  }
  if (!out) {
    const first = Array.from(words[0] ?? '')
    out = Array.from(first).length <= budget * 2 ? words[0] : first.slice(0, budget).join('')
  }
  return trimEdges(out)
}

/** Expand a folder-name template into path segments under the workspace. */
export function planSegments(template, now, session, options = {}) {
  const pad = (value) => String(value).padStart(2, '0')
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
  const id =
    String(session?.id ?? '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(-8) || 'session'
  const title = condenseTitle(options.title, options.titleChars) || id
  const rendered = String(template ?? '')
    .replace(/\{date\}/g, date)
    .replace(/\{time\}/g, time)
    .replace(/\{session\}/g, id)
    .replace(/\{title\}/g, title)
  const segments = rendered
    .split(/[\\/]+/)
    .map((part) => safeSegment(part))
    .filter(Boolean)
    .slice(0, MAX_SEGMENTS)
  return segments.length > 0 ? segments : [date]
}

function messageText(message) {
  const content = message?.content
  if (typeof content === 'string') return content.trim()
  if (!Array.isArray(content)) return ''
  return content
    .filter((part) => part?.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join(' ')
    .trim()
}

function isHumanMessage(message) {
  return message?.source?.kind === 'user' && messageText(message).length > 0
}

function textFromMessages(messages) {
  if (!Array.isArray(messages)) return ''
  for (const message of messages) {
    if (isHumanMessage(message)) return messageText(message)
  }
  return ''
}

/** The latest title DSH logged for this session, or ''. */
function latestTitle(session) {
  try {
    const events = session?.snapshotEvents?.() ?? []
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index]
      if (event?.type === 'session/title' && typeof event.data?.title === 'string') {
        return event.data.title.trim()
      }
    }
  } catch {}
  return ''
}

/** The first human text the session ever received, as a title stand-in. */
function firstUserText(session) {
  try {
    for (const event of session?.snapshotEvents?.() ?? []) {
      if (event?.type !== 'user/message') continue
      if (!isHumanMessage(event.data)) continue
      return messageText(event.data)
    }
  } catch {}
  return ''
}

/**
 * Whether this Session already had a conversation before now.
 *
 * A pending first prompt is NOT prior conversation: it is the very turn whose
 * step is asking for the folder. Only committed assistant/tool/turn events are,
 * so a resumed old Session is never relocated while a fresh one still is.
 */
function hasPriorConversation(session) {
  try {
    return (session?.snapshotEvents?.() ?? []).some(
      (event) =>
        event?.type === 'assistant/message' ||
        event?.type === 'tool/call' ||
        event?.type === 'turn/end',
    )
  } catch {
    return true
  }
}

async function exists(target) {
  try {
    return await stat(target).then(
      (info) => info,
      () => undefined,
    )
  } catch {
    return undefined
  }
}

export function apply(ctx, rawConfig) {
  const read = (name, fallback) => {
    const value = rawConfig?.[name]
    const settled =
      value !== null && typeof value === 'object' && typeof value.get === 'function'
        ? value.get()
        : value
    return settled === undefined || settled === null ? fallback : settled
  }

  if (read('enabled', true) === false) return

  const workingDirectory = ctx.workingDirectory
  if (workingDirectory === undefined || typeof workingDirectory.set !== 'function') {
    console.warn(`[${PLUGIN}] workingDirectory service unavailable; plugin stays inactive`)
    return
  }

  const logger = ctx.logger
  const warn = (message) => {
    const text = `[${PLUGIN}] ${message}`
    try {
      if (typeof logger?.warn === 'function') logger.warn(text)
      else console.warn(text)
    } catch {}
  }

  const states = new Map()

  const stateOf = (session) => {
    let state = states.get(session.id)
    if (!state) {
      state = {
        dir: undefined,
        chain: Promise.resolve(),
        settled: false,
        /** The session's folder was allocated by us, so it may be renamed. */
        owned: false,
        /** Name the folder currently carries, for cheap equality checks. */
        name: '',
      }
      states.set(session.id, state)
    }
    return state
  }

  const enqueue = (state, operation) => {
    state.chain = state.chain.then(async () => {
      try {
        await operation()
      } catch (error) {
        warn(`会话目录操作失败：${error?.message ?? error}`)
      }
    })
    return state.chain
  }

  /** The configured workspace, or the default workspace when the field is blank. */
  function targetWorkspace() {
    const configured = expandHome(read('workspace', ''))
    if (configured) {
      if (!isAbsolute(configured)) {
        warn(`workspace 必须是绝对路径，已忽略：${configured}`)
        return undefined
      }
      return resolve(configured)
    }

    try {
      const domain = ctx.get?.('storageDomain')?.get?.('workspace')
      const id = domain?.global?.get?.()?.defaultWorkspaceId
      if (typeof id === 'string' && id) {
        const workspace = ctx.get?.('workspaceRegistry')?.get?.(id)
        if (typeof workspace?.path === 'string' && workspace.path) {
          return resolve(workspace.path)
        }
      }
    } catch (error) {
      warn(`读取默认工作区失败：${error?.message ?? error}`)
    }

    if (typeof workingDirectory.defaultDirectory === 'string') {
      return resolve(workingDirectory.defaultDirectory)
    }
    return undefined
  }

  /** Free path for `segments` under `root`, honouring the collision policy. */
  async function allocate(root, segments) {
    const base = join(root, ...segments)
    // reuse: one folder per name, shared by whatever lands on it.
    if (String(read('collision', 'suffix')) === 'reuse') {
      await mkdir(base, { recursive: true })
      return base
    }

    // suffix: one folder per session, numbered when the name is taken.
    for (let index = 1; index <= 999; index += 1) {
      const candidate = index === 1 ? base : `${base}-${index}`
      if ((await exists(candidate)) !== undefined) continue
      await mkdir(candidate, { recursive: true })
      return candidate
    }

    const fallback = `${base}-${Date.now()}`
    await mkdir(fallback, { recursive: true })
    return fallback
  }

  /** A rename target that is free, or the current path when nothing changed. */
  async function freeSibling(current, desiredName) {
    const parent = resolve(current, '..')
    const base = join(parent, desiredName)
    if (samePath(base, current)) return current
    if ((await exists(base)) === undefined) return base
    for (let index = 2; index <= 999; index += 1) {
      const candidate = `${base}-${index}`
      if (samePath(candidate, current)) return current
      if ((await exists(candidate)) === undefined) return candidate
    }
    return `${base}-${Date.now()}`
  }

  async function writeMarker(directory, session) {
    const file = join(directory, MARKER)
    if ((await exists(file)) !== undefined) return
    const marker = {
      version: MARKER_VERSION,
      sessionId: session?.id ?? '',
      createdAt: new Date().toISOString(),
    }
    await writeFile(file, JSON.stringify(marker), 'utf8')
  }

  /**
   * Recover the folder this session was given before a restart or reload.
   * The marker is the proof; a folder without it belongs to the user.
   */
  async function adoptExisting(directory, session) {
    const file = join(directory, MARKER)
    try {
      const marker = JSON.parse(await readFile(file, 'utf8'))
      return marker?.sessionId === session?.id
    } catch {
      return false
    }
  }

  /**
   * Find the folder this Session was already given, by its marker.
   *
   * Needed after a DSH restart: the Session header still records the original
   * workspace, and the working-directory projection replays the folder path, so
   * a resumed conversation would otherwise look new and get a second folder.
   * The walk is bounded — template depth, a per-directory entry cap, and
   * dependency/VCS directories skipped.
   */
  async function findMarked(root, sessionId, depth = MAX_SEGMENTS) {
    if (depth <= 0 || !root) return undefined
    let entries
    try {
      entries = await readdir(root, { withFileTypes: true })
    } catch {
      return undefined
    }
    const names = entries.slice(0, 500)
    for (const entry of names) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const candidate = join(root, entry.name)
      if (await adoptExisting(candidate, { id: sessionId })) return candidate
    }
    for (const entry of names) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const found = await findMarked(join(root, entry.name), sessionId, depth - 1)
      if (found !== undefined) return found
    }
    return undefined
  }

  function skipSession(session) {
    const header = session?.header
    return (
      !header ||
      header.origin === 'subagent' ||
      header.parentSession !== undefined ||
      typeof header.cwd !== 'string' ||
      header.cwd.length === 0
    )
  }

  /** Best available short title: logged title, else first message, else ''. */
  function titleFor(session, messages) {
    return (
      latestTitle(session) ||
      textFromMessages(messages) ||
      firstUserText(session) ||
      ''
    )
  }

  function nameFor(session, now, title) {
    const segments = planSegments(read('folderName', '{date}-{title}'), now, session, {
      title,
      titleChars: read('titleChars', DEFAULT_TITLE_CHARS),
    })
    return { segments, leaf: segments[segments.length - 1] ?? '' }
  }

  /**
   * Rename the session's folder to the current title and re-point the working
   * directory at it.
   *
   * Runs only between turns: a directory a running tool holds open cannot be
   * renamed on Windows, and a mid-turn move would invalidate paths the model
   * already printed. A failed rename keeps the old name and is retried at the
   * next turn boundary.
   */
  async function syncName(agent, session, state, messages) {
    if (!state.owned || state.dir === undefined) return
    if ((await exists(state.dir)) === undefined) return

    const now = new Date(session?.header?.createdAt ?? Date.now())
    const { segments, leaf } = nameFor(session, now, titleFor(session, messages))
    if (!leaf || leaf === state.name) return

    const desired = join(resolve(state.dir, '..'), leaf)
    if (samePath(desired, state.dir)) {
      state.name = leaf
      return
    }

    const target = await freeSibling(state.dir, leaf)
    if (!samePath(target, state.dir)) {
      try {
        await rename(state.dir, target)
      } catch (error) {
        warn(`重命名会话目录失败（${state.dir} → ${target}）：${error?.message ?? error}`)
        return
      }
    }

    try {
      await workingDirectory.set(agent, target)
    } catch (error) {
      if (!samePath(target, state.dir)) {
        try {
          await rename(target, state.dir)
        } catch {}
      }
      throw error
    }

    state.dir = target
    state.name = basename(target)
  }

  async function step(agent, messages) {
    const session = agent?.session
    if (skipSession(session)) return

    const workspace = targetWorkspace()
    if (!workspace) return

    const state = stateOf(session)
    if (state.settled) {
      // Already placed; only the name may still need to catch up with a title
      // that arrived after creation.
      await syncName(agent, session, state, messages)
      return
    }

    const current = workingDirectory.get(session)

    // Already living inside the workspace: placed by an earlier run. Adopt it
    // when it carries our marker, so title renames keep working after a restart.
    if (isInside(current, workspace)) {
      state.settled = true
      state.dir = current
      state.name = basename(current)
      state.owned = await adoptExisting(current, session)
      await syncName(agent, session, state, messages)
      return
    }

    // The session is not in the configured workspace; nothing to do.
    if (!samePath(current, workspace)) {
      state.settled = true
      return
    }

    if (state.dir !== undefined && (await adoptExisting(state.dir, session))) {
      await workingDirectory.set(agent, state.dir)
      state.owned = true
      state.name = basename(state.dir)
      state.settled = true
      await syncName(agent, session, state, messages)
      return
    }

    // A resumed conversation already has a history of its own; moving it now
    // would scatter files it already wrote under a different root. Look for the
    // folder an earlier run gave it, and re-adopt that instead.
    if (hasPriorConversation(session)) {
      const located = await findMarked(workspace, session.id)
      if (located !== undefined) {
        state.dir = located
        state.owned = true
        state.name = basename(located)
        await workingDirectory.set(agent, located)
        await syncName(agent, session, state, messages)
      }
      state.settled = true
      return
    }

    const now = new Date(session?.header?.createdAt ?? Date.now())
    const { segments } = nameFor(session, now, titleFor(session, messages))
    const directory = await allocate(workspace, segments)
    await writeMarker(directory, session)
    // Recorded before the durable write so a failed `set` is retried against
    // the folder that already exists instead of allocating a second one.
    state.dir = directory
    state.owned = true
    state.name = basename(directory)
    await workingDirectory.set(agent, directory)
    state.settled = true
  }

  const run = (agent, messages) => {
    const session = agent?.session
    if (session?.id === undefined) return Promise.resolve()
    return enqueue(stateOf(session), () => step(agent, messages))
  }

  ctx.effect(() => {
    const disposers = []

    disposers.push(
      ctx.on('agent/created', (payload) => {
        if (String(read('createMode', 'immediate')) === 'first-message') return
        void run(payload?.agent)
      }),
    )

    disposers.push(
      ctx.on(
        'agent/pre-step',
        async (payload, next) => {
          try {
            await run(payload?.agent, payload?.messages)
          } catch (error) {
            warn(`准备会话目录失败：${error?.message ?? error}`)
          }
          return next()
        },
        { prepend: true },
      ),
    )

    // A title lands after the turn that produced it; rename then, when no tool
    // holds the directory open.
    const syncOnTitle = (session) => {
      const agent = ctx.get?.('agents')?.get?.(session?.id)
      if (agent === undefined) return
      void run(agent)
    }

    disposers.push(
      ctx.on('session/event', (session, event) => {
        if (event?.type !== 'session/title' && event?.type !== 'turn/end') return
        syncOnTitle(session)
      }),
    )

    // Last resort for a session that somehow reaches assembly before any hook
    // above ran; keeps the model's view of its cwd truthful from turn one.
    disposers.push(
      ctx.on(
        'system-prompt/assemble',
        async (_assembly, context, next) => {
          if (context?.agent !== undefined) {
            try {
              await run(context.agent)
            } catch (error) {
              warn(`准备会话目录失败：${error?.message ?? error}`)
            }
          }
          return next()
        },
        { prepend: true },
      ),
    )

    return () => {
      for (const dispose of disposers) {
        try {
          if (typeof dispose === 'function') dispose()
        } catch {}
      }
    }
  })
}
