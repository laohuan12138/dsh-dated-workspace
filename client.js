/**
 * Browser half of dsh-dated-workspace.
 *
 * Renders the plugin's configuration card on the Plugins page. Deliberately
 * dependency-free: only React from the module table and the `configForms`
 * service are used, so a rename in any Harness Client package cannot blank the
 * card. Every control writes through the shared settings form, which stages the
 * edit until Save and lets the Host validate it.
 */
window.__ModuleLoader__.load({
  id: 'dsh-dated-workspace',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const React = require('react')
    const h = React.createElement

    const NS = 'dsh-dated-workspace'
    const ROW_NS = 'dated-workspace'
    const BUNDLE_KEY = 'dsh-dated-workspace'

    const zh = {
      title: '按日期命名的工作区文件夹',
      description:
        '在你指定的工作区里每开一个新会话，就建一个「日期-会话简称」文件夹，并把该会话的工作目录切进去。',
      workspace: '生效的工作区',
      workspaceHint:
        '只有工作目录等于这个路径的新会话会被处理；留空表示 DSH 的默认工作区。其它工作区一律不受影响。',
      workspaceEmpty: '默认工作区（未指定）',
      choose: '选择文件夹…',
      choosing: '正在打开…',
      pickFailed: '没有打开文件夹选择器，请重试。',
      useDefault: '使用默认工作区',
      folderName: '文件夹名模板',
      folderNameHint:
        '可用 {date}（2026-11-12）、{title}（会话简称）、{time}、{session}（会话 id 尾段）。用 / 可以建多级目录。',
      titleChars: '简称字数',
      titleCharsHint: '会话简称最多保留几个字，默认 6。',
      summaryMode: '简称来源',
      summaryModeHint:
        '「AI 浓缩」让默认模型读完会话再起名，概括主题而不是截取开头几个字；模型不可用时自动退回截取。',
      summaryModeAi: 'AI 浓缩（默认）',
      summaryModeSlice: '标题截取',
      summaryChars: '浓缩字数',
      summaryCharsHint: 'AI 浓缩出的简称最多几个字，默认 15。比截取字数宽，因为一句话才能说清主题。',
      summaryModel: '浓缩用的模型',
      summaryModelHint:
        '留空跟随当前默认模型。要单独指定就同时填 provider 与模型 id，例如 new-api / deepseek-v4.1-flash。',
      summaryProviderPlaceholder: 'provider（可留空）',
      summaryModelPlaceholder: '模型 id（可留空）',
      summaryTimeout: '浓缩超时（毫秒）',
      summaryTimeoutHint: '超过这个时间就用截取的名字，不耽误开文件夹。默认 25000。',
      preview: '示例',
      previewTitle: '重构认证模块并补充测试',
      previewSummary: '认证模块重构',
      previewAiNote: 'AI 模式下最终名字由模型当场浓缩，这里只是示意。',
      collision: '同名文件夹',
      collisionHint: '同一天开多个会话时怎么放。',
      collisionReuse: '复用同一个',
      collisionSuffix: '追加 -2、-3（默认）',
      createMode: '创建时机',
      createModeHint: '“打开会话时创建”会立刻生成文件夹；“首条消息时创建”可避免留下空文件夹。',
      createImmediate: '打开会话时创建',
      createFirstMessage: '首条消息时创建',
      renameNote: '文件夹先用可用的名字建好，等会话标题生成后自动改名，所以你看到的名字可能晚一步变成正式简称。',
      readOnly: '本部署的设置为只读。',
      unavailable: '该插件当前未加载，暂时无法配置。',
      saveFailed: '设置没有被接受，请检查后重试。',
    }

    const en = {
      title: 'Dated workspace folders',
      description:
        'Every new session opened in the workspace you choose gets a date-and-title folder, and the session works inside it.',
      workspace: 'Workspace',
      workspaceHint:
        'Only new sessions whose working directory equals this path are handled; leave it empty to use the DSH default workspace. Other workspaces are never touched.',
      workspaceEmpty: 'Default workspace (not set)',
      choose: 'Choose folder…',
      choosing: 'Opening…',
      pickFailed: 'The folder picker could not be opened. Try again.',
      useDefault: 'Use default workspace',
      folderName: 'Folder name template',
      folderNameHint:
        'Supports {date} (2026-11-12), {title} (short session title), {time} and {session} (session id tail). Use / for nested folders.',
      titleChars: 'Title length',
      titleCharsHint: 'How many characters the short title keeps. Default 6.',
      summaryMode: 'Name source',
      summaryModeHint:
        'AI summary reads the conversation and names its subject instead of cutting the first few characters. Falls back to slicing when no model is reachable.',
      summaryModeAi: 'AI summary (default)',
      summaryModeSlice: 'Slice the title',
      summaryChars: 'Summary length',
      summaryCharsHint: 'How many characters the condensed name keeps. Default 15 — wider than slicing, since a phrase needs room.',
      summaryModel: 'Summarising model',
      summaryModelHint:
        'Leave both empty to follow the current default model, or set provider and model id together (for example new-api / deepseek-v4.1-flash).',
      summaryProviderPlaceholder: 'provider (optional)',
      summaryModelPlaceholder: 'model id (optional)',
      summaryTimeout: 'Summary timeout (ms)',
      summaryTimeoutHint:
        'Past this the sliced name is used instead, so folder creation is never delayed. Default 25000.',
      preview: 'Preview',
      previewTitle: 'Refactor the auth module',
      previewSummary: 'Auth refactor',
      previewAiNote: 'In AI mode the model condenses the real name on the spot; this is only an illustration.',
      collision: 'Name collision',
      collisionHint: 'How several sessions on the same day are placed.',
      collisionReuse: 'Share one folder',
      collisionSuffix: 'Append -2, -3 (default)',
      createMode: 'Creation timing',
      createModeHint:
        'Create on open gives every new chat a folder immediately. Create on first message avoids empty folders.',
      createImmediate: 'Create on open',
      createFirstMessage: 'Create on first message',
      renameNote:
        'The folder is created immediately under the best available name, then renamed once the session title is generated — so its name can catch up a moment later.',
      readOnly: 'This deployment stores settings read-only.',
      unavailable: 'This plugin is not loaded, so it cannot be configured right now.',
      saveFailed: 'The settings were not accepted. Check them and try again.',
    }

    const ILLEGAL = /[<>:"/\\|?*\u0000-\u001f]/g
    const TRIM_CHARS = new Set(' -_.·,，。、:：;；!！?？\'"“”‘’()（）[]【】<>《》/\\|~`@#$%^&*+=')
    const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/

    function trimEdges(text) {
      let start = 0
      let end = text.length
      while (start < end && TRIM_CHARS.has(text[start])) start += 1
      while (end > start && TRIM_CHARS.has(text[end - 1])) end -= 1
      return text.slice(start, end)
    }

    /** Local echo of the Host's condenseTitle, for the preview line only. */
    function condenseTitle(raw, maxChars) {
      const budget = Math.max(2, Math.min(24, Math.trunc(Number(maxChars) || 6)))
      let text = String(raw || '')
        .replace(/^\s*(?:#{1,6}\s*|[-*+>]\s+|\d+[.)]\s+)/, '')
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (!text) return ''
      const prefixed = text.match(/^(?:标题|话题|会话|主题)\s*[:：]\s*(.+)$/)
      if (prefixed) text = prefixed[1].trim()
      text = trimEdges(text)
      if (!text) return ''
      const chars = Array.from(text)
      if (CJK.test(text)) return trimEdges(chars.slice(0, budget).join(''))
      const words = text.split(' ').filter(Boolean)
      let out = ''
      for (const word of words) {
        const candidate = out ? `${out} ${word}` : word
        if (Array.from(candidate).length > budget) break
        out = candidate
      }
      if (!out) {
        const first = Array.from(words[0] || '')
        out = first.length <= budget * 2 ? words[0] : first.slice(0, budget).join('')
      }
      return trimEdges(out)
    }

    /** Local echo of the Host's fitName, for the preview line only. */
    function fitName(raw, maxChars) {
      const budget = Math.max(2, Math.min(40, Math.trunc(Number(maxChars) || 15)))
      let text = String(raw || '')
        .replace(/^\s*(?:#{1,6}\s*|[-*+>]\s+|\d+[.)]\s+)/, '')
        .replace(/[`*_#>]/g, ' ')
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (!text) return ''
      const labelled = text.match(/^(?:文件夹名|名字|名称|简称|输出|答案)\s*[:：]\s*(.+)$/)
      if (labelled) text = labelled[1].trim()
      const quoted = text.match(/^["'“”‘’「」『』【】](.+?)["'“”‘’「」『』【】]$/)
      if (quoted) text = quoted[1]
      text = trimEdges(text)
      if (!text) return ''
      text = text.replace(
        /([\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af])\s+(?=[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af])/g,
        '$1',
      )
      if (CJK.test(text)) return trimEdges(Array.from(text).slice(0, budget).join(''))
      const words = text.split(' ').filter(Boolean)
      let out = ''
      for (const word of words) {
        const candidate = out ? `${out} ${word}` : word
        if (Array.from(candidate).length > budget) break
        out = candidate
      }
      return trimEdges(out || Array.from(words[0] || '').slice(0, budget).join(''))
    }

    function previewSegments(template, title, titleChars, summary, summaryChars) {
      const now = new Date()
      const pad = (value) => String(value).padStart(2, '0')
      const name = fitName(summary, summaryChars) || condenseTitle(title, titleChars)
      const rendered = String(template || '')
        .replace(
          /\{date\}/g,
          `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
        )
        .replace(
          /\{time\}/g,
          `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`,
        )
        .replace(/\{session\}/g, 'ab12cd34')
        .replace(/\{title\}/g, name || 'ab12cd34')
      return rendered
        .split(/[\\/]+/)
        .map((part) =>
          String(part || '')
            .trim()
            .replace(ILLEGAL, '-')
            .replace(/-{2,}/g, '-')
            .replace(/^[-.\s]+/g, '')
            .replace(/[-.\s]+$/g, ''),
        )
        .filter(Boolean)
        .slice(0, 4)
    }

    const monoPath = {
      padding: '9px 11px',
      borderRadius: 8,
      border: '1px solid var(--dsw-alias-border-l2)',
      color: 'var(--dsw-alias-label-secondary)',
      fontFamily: 'var(--dsw-font-family-mono, monospace)',
      fontSize: 12,
      overflowWrap: 'anywhere',
    }
    const hint = { color: 'var(--dsw-alias-label-tertiary)', fontSize: 12 }
    const label = { fontSize: 13, fontWeight: 600 }
    const divider = {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      paddingTop: 12,
      borderTop: '1px solid var(--dsw-alias-border-l2)',
    }
    const inputStyle = {
      padding: '9px 11px',
      borderRadius: 8,
      border: '1px solid var(--dsw-alias-border-l2)',
      background: 'transparent',
      color: 'inherit',
      fontFamily: 'var(--dsw-font-family-mono, monospace)',
      fontSize: 12,
    }

    function button(labelText, onClick, { primary = false, disabled = false } = {}) {
      return h(
        'button',
        {
          type: 'button',
          onClick,
          disabled,
          style: {
            padding: '5px 11px',
            borderRadius: 8,
            fontSize: 12,
            cursor: disabled ? 'default' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            border: '1px solid var(--dsw-alias-border-l2)',
            background: primary ? 'var(--dsw-alias-brand-primary, #3b6ef5)' : 'transparent',
            color: primary ? '#fff' : 'inherit',
          },
        },
        labelText,
      )
    }

    /** A text input that keeps typing local and commits on blur or Enter. */
    function TextField(props) {
      const [draft, setDraft] = React.useState(null)
      const value = draft === null ? props.value : draft
      return h('input', {
        type: props.numeric ? 'number' : 'text',
        value,
        min: props.numeric ? (props.min ?? 2) : undefined,
        max: props.numeric ? (props.max ?? 24) : undefined,
        placeholder: props.placeholder,
        spellCheck: false,
        disabled: props.disabled,
        'aria-label': props.ariaLabel,
        onChange: (event) => setDraft(event.target.value),
        onBlur: () => {
          if (draft === null) return
          const next = draft
          setDraft(null)
          if (String(next) !== String(props.value)) props.onCommit(next)
        },
        onKeyDown: (event) => {
          if (event.key === 'Enter' && typeof event.currentTarget.blur === 'function') {
            event.currentTarget.blur()
          }
        },
        style: inputStyle,
      })
    }

    function DatedWorkspaceCard(props) {
      const { t, form } = props
      const usable = form !== undefined && typeof form.subscribe === 'function'
      const snapshot = React.useSyncExternalStore(
        (listener) => (usable ? form.subscribe(listener) : () => {}),
        () => (usable ? form.getSnapshot() : { status: 'unavailable', writable: false }),
      )
      const [picking, setPicking] = React.useState(false)
      const [pickError, setPickError] = React.useState('')
      const [saveError, setSaveError] = React.useState('')

      if (props.view === 'summary') return t('description')

      const value = snapshot.value
      if (!usable || snapshot.status === 'unavailable' || value === undefined) {
        return h('p', { style: hint }, t('unavailable'))
      }

      const writable = snapshot.writable === true
      const field = (name, fallback) => {
        const raw = value?.[name]
        return typeof raw === 'string' && raw.length > 0 ? raw : fallback
      }
      const numberField = (name, fallback) => {
        const raw = value?.[name]
        const parsed = Number(raw)
        return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
      }

      const workspaceText = field('workspace', '')
      const templateText = field('folderName', '{date}-{title}')
      const titleChars = numberField('titleChars', 6)
      const collision = field('collision', 'suffix')
      const createMode = field('createMode', 'immediate')
      const summaryMode = field('summaryMode', 'ai')
      const summaryChars = numberField('summaryChars', 15)
      const summaryProvider = field('summaryProvider', '')
      const summaryModel = field('summaryModel', '')
      const summaryTimeoutMs = numberField('summaryTimeoutMs', 25000)
      const sampleTitle = t('previewTitle')
      const sampleSummary = summaryMode === 'ai' ? t('previewSummary') : ''
      const segments = previewSegments(templateText, sampleTitle, titleChars, sampleSummary, summaryChars)

      const write = async (name, next) => {
        setSaveError('')
        if (typeof form.set !== 'function') {
          setSaveError(t('saveFailed'))
          return false
        }
        const ok = await form.set(name, next)
        if (!ok) setSaveError(t('saveFailed'))
        return ok
      }

      const choose = async () => {
        if (picking || !writable) return
        setPicking(true)
        setPickError('')
        try {
          const picked = await props.pickDirectory()
          if (typeof picked === 'string' && picked.length > 0) await write('workspace', picked)
        } catch {
          setPickError(t('pickFailed'))
        } finally {
          setPicking(false)
        }
      }

      return h(
        'section',
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            padding: 16,
            border: '1px solid var(--dsw-alias-border-l2)',
            borderRadius: 12,
          },
        },
        h('h3', { style: { margin: 0, fontSize: 16 } }, t('title')),
        h('p', { style: { margin: 0, opacity: 0.72, fontSize: 13 } }, t('description')),
        writable ? null : h('p', { style: hint }, t('readOnly')),

        h(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
          h('div', { style: label }, t('workspace')),
          h('div', { style: monoPath }, workspaceText || t('workspaceEmpty')),
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
            button(picking ? t('choosing') : t('choose'), choose, {
              disabled: !writable || picking,
            }),
            workspaceText
              ? button(t('useDefault'), () => void write('workspace', ''), {
                  disabled: !writable,
                })
              : null,
          ),
          h('div', { style: hint }, pickError || t('workspaceHint')),
        ),

        h(
          'div',
          { style: divider },
          h('div', { style: label }, t('folderName')),
          h(TextField, {
            value: templateText,
            disabled: !writable,
            ariaLabel: t('folderName'),
            onCommit: (next) => void write('folderName', next),
          }),
          h('div', { style: hint }, t('folderNameHint')),
          h('div', { style: monoPath }, `${t('preview')}: ${segments.join(' / ') || '—'}`),
        ),

        h(
          'div',
          { style: divider },
          h('div', { style: label }, t('titleChars')),
          h(TextField, {
            value: titleChars,
            numeric: true,
            disabled: !writable,
            ariaLabel: t('titleChars'),
            onCommit: (next) => {
              const parsed = Number.parseInt(String(next), 10)
              void write('titleChars', Number.isFinite(parsed) ? parsed : 6)
            },
          }),
          h('div', { style: hint }, t('titleCharsHint')),
        ),

        h(
          'div',
          { style: divider },
          h('div', { style: label }, t('summaryMode')),
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
            button(t('summaryModeAi'), () => void write('summaryMode', 'ai'), {
              primary: summaryMode !== 'slice',
              disabled: !writable,
            }),
            button(t('summaryModeSlice'), () => void write('summaryMode', 'slice'), {
              primary: summaryMode === 'slice',
              disabled: !writable,
            }),
          ),
          h('div', { style: hint }, summaryMode === 'slice' ? t('titleCharsHint') : t('summaryModeHint')),
          summaryMode === 'slice'
            ? null
            : h(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
                h(
                  'div',
                  { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
                  h('span', { style: hint }, t('summaryChars')),
                  h(TextField, {
                    value: summaryChars,
                    numeric: true,
                    min: 2,
                    max: 40,
                    disabled: !writable,
                    ariaLabel: t('summaryChars'),
                    onCommit: (next) => {
                      const parsed = Number.parseInt(String(next), 10)
                      void write('summaryChars', Number.isFinite(parsed) ? parsed : 15)
                    },
                  }),
                ),
                h('div', { style: hint }, t('summaryCharsHint')),
                h(TextField, {
                  value: summaryProvider,
                  disabled: !writable,
                  ariaLabel: t('summaryModel'),
                  placeholder: t('summaryProviderPlaceholder'),
                  onCommit: (next) => void write('summaryProvider', String(next || '').trim()),
                }),
                h(TextField, {
                  value: summaryModel,
                  disabled: !writable,
                  ariaLabel: t('summaryModel'),
                  placeholder: t('summaryModelPlaceholder'),
                  onCommit: (next) => void write('summaryModel', String(next || '').trim()),
                }),
                h(
                  'div',
                  { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
                  h('span', { style: hint }, t('summaryTimeout')),
                  h(TextField, {
                    value: summaryTimeoutMs,
                    numeric: true,
                    min: 3000,
                    max: 120000,
                    disabled: !writable,
                    ariaLabel: t('summaryTimeout'),
                    onCommit: (next) => {
                      const parsed = Number.parseInt(String(next), 10)
                      void write('summaryTimeoutMs', Number.isFinite(parsed) ? parsed : 25000)
                    },
                  }),
                ),
                h('div', { style: hint }, t('summaryModelHint')),
                h('div', { style: hint }, t('summaryTimeoutHint')),
                h('div', { style: hint }, t('previewAiNote')),
              ),
        ),

        h(
          'div',
          { style: divider },
          h('div', { style: label }, t('collision')),
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
            button(t('collisionReuse'), () => void write('collision', 'reuse'), {
              primary: collision === 'reuse',
              disabled: !writable,
            }),
            button(t('collisionSuffix'), () => void write('collision', 'suffix'), {
              primary: collision !== 'reuse',
              disabled: !writable,
            }),
          ),
          h('div', { style: hint }, t('collisionHint')),
        ),

        h(
          'div',
          { style: divider },
          h('div', { style: label }, t('createMode')),
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
            button(t('createImmediate'), () => void write('createMode', 'immediate'), {
              primary: createMode !== 'first-message',
              disabled: !writable,
            }),
            button(t('createFirstMessage'), () => void write('createMode', 'first-message'), {
              primary: createMode === 'first-message',
              disabled: !writable,
            }),
          ),
          h('div', { style: hint }, t('createModeHint')),
        ),

        h('div', { style: { ...hint, opacity: 0.85 } }, t('renameNote')),
        saveError
          ? h(
              'p',
              {
                style: {
                  margin: 0,
                  fontSize: 12,
                  color: 'var(--dsw-alias-state-error-primary)',
                },
              },
              saveError,
            )
          : null,
      )
    }

    function apply(ctx) {
      const t = ctx.locale.bind(NS)
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-dated-workspace: dictionaries')

      const form = ctx.configForms.get(ROW_NS)
      ctx.effect(() => () => void form.dispose(), 'dsh-dated-workspace: form subscription')

      const desktopPicker = globalThis.__DSH_DIRECTORY_PICKER__
      const pickDirectory =
        typeof desktopPicker?.pick === 'function'
          ? () => desktopPicker.pick()
          : typeof ctx.uiWorkspace?.pickDirectory === 'function'
            ? () => ctx.uiWorkspace.pickDirectory()
            : () => Promise.reject(new Error('directory-picker/unavailable'))

      ctx.effect(
        () =>
          ctx.slots.inject('plugins.bundle.config', () =>
            ctx.slots.register(
              {
                name: 'plugins.bundle.config',
                key: BUNDLE_KEY,
                locale: NS,
                inject: () => ({ form, pickDirectory }),
              },
              DatedWorkspaceCard,
            ),
          ),
        'dsh-dated-workspace: bundle detail configuration',
      )
    }

    exports.apply = apply
    exports.inject = ['slots', 'locale', 'configForms']
    return module.exports
  },
})
