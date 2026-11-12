// Render the settings card with a tiny React stand-in: catches runtime errors
// in the render path and proves the new controls are actually produced.
import { readFileSync } from 'node:fs'

const source = readFileSync('client.js', 'utf8')
let factory, registered
function h(type, props, ...children) {
  return {
    type,
    props: props || {},
    children: children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false),
  }
}
const React = {
  createElement: h,
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useSyncExternalStore: (_sub, get) => get(),
}
const require = (name) => {
  if (name === 'react') return React
  throw new Error(`unexpected require ${name}`)
}
globalThis.window = { __ModuleLoader__: { load: (mod) => { factory = mod.factory } } }
new Function('window', 'require', source)(globalThis.window, require)
const mod = factory(require)

const snapshot = (over = {}) => ({
  status: 'ready',
  writable: true,
  value: {
    workspace: 'F:\\tmp\\workspace',
    folderName: '{date}-{title}',
    titleChars: 6,
    summaryMode: 'ai',
    summaryProvider: '',
    summaryModel: '',
    summaryTimeoutMs: 25000,
    collision: 'suffix',
    createMode: 'immediate',
    ...over,
  },
})

let snapshotValue = snapshot()
mod.apply({
  locale: Object.assign((key) => `t:${key}`, { register: () => () => {} }),
  configForms: { get: () => ({ subscribe: () => () => {}, getSnapshot: () => snapshotValue }) },
  effect: (fn) => { if (typeof fn === 'function') fn() },
  slots: {
    inject: (name, fn) => { fn(); return () => {} },
    register: (options, component) => { registered = { options, component }; return () => {} },
  },
})
if (!registered) throw new Error('the card was never registered')

const Card = registered.component
const previewText = {
  previewTitle: '重构认证模块并补充测试',
  previewSummary: '认证模块重构',
}
const t = (key) => previewText[key] ?? `t:${key}`
const form = { subscribe: () => () => {}, getSnapshot: () => snapshotValue, set: async () => true }

/** Fully render the tree, expanding every function component. */
function render(node) {
  if (node === null || node === undefined || node === false) return null
  if (Array.isArray(node)) return node.map(render).filter(Boolean)
  if (typeof node === 'string' || typeof node === 'number') return node
  if (typeof node.type === 'function') return render(node.type(node.props))
  return { ...node, children: node.children.map(render).filter(Boolean) }
}

const flat = (node, out = []) => {
  if (node === null || node === undefined) return out
  if (Array.isArray(node)) { for (const child of node) flat(child, out); return out }
  if (typeof node === 'object' && node.props) { out.push(node); flat(node.children, out) }
  return out
}
const labelText = (nodes) => nodes.filter((n) => typeof n.type === 'string').map((n) => n.children.filter((c) => typeof c === 'string').join('')).join(' | ')

const check = (name, cond, extra = '') => cond ? console.log(`ok   ${name}`) : console.log(`FAIL ${name} ${extra}`)

const aiNodes = flat(render(Card({ t, form, pickDirectory: async () => '' })))
const aiLabels = labelText(aiNodes)
const aiInputs = aiNodes.filter((n) => n.type === 'input')
check('card renders a section', aiNodes.some((n) => n.type === 'section'))
check('name-source label present', aiLabels.includes('t:summaryMode'), aiLabels)
check('AI summary button present', aiLabels.includes('t:summaryModeAi'), aiLabels)
check('slice button present', aiLabels.includes('t:summaryModeSlice'), aiLabels)
check('provider + model + timeout inputs present', aiInputs.length === 5, `inputs=${aiInputs.length}`)
check('preview shows the AI sample name', aiLabels.includes('认证模块重构'), aiLabels)

snapshotValue = snapshot({ summaryMode: 'slice' })
const sliceNodes = flat(render(Card({ t, form, pickDirectory: async () => '' })))
const sliceLabels = labelText(sliceNodes)
const sliceInputs = sliceNodes.filter((n) => n.type === 'input')
check('slice mode hides model controls', sliceInputs.length === 2, `inputs=${sliceInputs.length}`)
check('slice mode preview uses the sliced title', sliceLabels.includes('2026-11-12-重构认证模块'), sliceLabels)
console.log('CLIENT CARD OK')



