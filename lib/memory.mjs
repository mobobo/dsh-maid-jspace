/**
 * dsh-maid-jspace — lightweight memory: session working set + small knowledge base.
 *
 * Two plain markdown files under one directory, both human-editable:
 *
 *   <store>/sessions/<sid>.md   per-session working set
 *       ## 目标      - ...
 *       ## 已确认    - [MM-DD] ...
 *       ## 未决      - ...
 *
 *   <store>/kb.md              one line per topic
 *       - [主题] 结论句 | #tag1 #tag2 | status: active | src: session-xxx | 2026-10-21
 *
 * Both are injected as a compact block every turn. Detail is NOT injected — the
 * block carries the index (topic + one-line conclusion) and the file path, so
 * the agent can open the file when a topic actually comes up. That keeps the
 * token cost flat while surviving context compaction, which is what was failing
 * before: a decision made 30 turns ago either lives in this index or it is gone.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DEFAULTS = {
  maxChars: 900,
  maxKb: 15,
  maxGoals: 3,
  maxDone: 4,
  maxOpen: 4,
}

const safeSid = (sid) => String(sid || '').trim().replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 96)

const oneLine = (text) => String(text ?? '').replace(/\s+/g, ' ').trim()

const clip = (text, max) => {
  const t = oneLine(text)
  return t.length > max ? `${t.slice(0, max)}…` : t
}

/** Parse `## 目标` style sections into { goal, done, open }. */
function parseSession (raw) {
  const out = { goal: [], done: [], open: [] }
  let bucket = ''
  for (const rawLine of String(raw).split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line === '') continue
    if (line.startsWith('## ')) {
      const key = line.slice(3).trim()
      bucket = key === '目标' ? 'goal' : key === '已确认' ? 'done' : key === '未决' ? 'open' : ''
      continue
    }
    if (bucket !== '' && line.startsWith('- ')) out[bucket].push(line.slice(2).trim())
  }
  return out
}

/** Parse kb.md lines into entries. Unparsable lines are ignored, never thrown on. */
function parseKb (raw) {
  const entries = []
  for (const rawLine of String(raw).split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line.startsWith('- ')) continue
    const body = line.slice(2).trim()
    const m = body.match(/^\[([^\]]+)\]\s*(.*)$/)
    if (!m) continue
    const topic = oneLine(m[1])
    const rest = m[2]
    const parts = rest.split('|').map((x) => x.trim())
    const summary = oneLine(parts[0])
    const entry = { topic, summary, tags: [], status: 'active', src: '', updated: '' }
    for (const part of parts.slice(1)) {
      if (part.startsWith('#')) entry.tags.push(...part.split(/\s+/).filter((t) => t.startsWith('#')).map((t) => t.slice(1)))
      else if (part.toLowerCase().startsWith('status:')) entry.status = part.slice(7).trim()
      else if (part.toLowerCase().startsWith('src:')) entry.src = part.slice(4).trim()
      else if (/^\d{4}-\d{2}-\d{2}$/.test(part)) entry.updated = part
    }
    entries.push(entry)
  }
  entries.sort((a, b) => String(b.updated).localeCompare(String(a.updated)))
  return entries
}

/**
 * Build the injector.
 * @param {{ storeDir: string, maxChars?: number, maxKb?: number }} options
 */
export function createMemory (options) {
  const storeDir = options.storeDir
  const maxChars = options.maxChars ?? DEFAULTS.maxChars
  const maxKb = options.maxKb ?? DEFAULTS.maxKb
  const kbFile = join(storeDir, 'kb.md')
  const sessionsDir = join(storeDir, 'sessions')

  const readKb = () => {
    try {
      return existsSync(kbFile) ? parseKb(readFileSync(kbFile, 'utf8')) : []
    } catch {
      return []
    }
  }

  const readSession = (sid) => {
    const key = safeSid(sid)
    if (key === '') return { goal: [], done: [], open: [] }
    try {
      const file = join(sessionsDir, `${key}.md`)
      return existsSync(file) ? parseSession(readFileSync(file, 'utf8')) : { goal: [], done: [], open: [] }
    } catch {
      return { goal: [], done: [], open: [] }
    }
  }

  /** Compact block injected as a system-prompt section. '' means "inject nothing". */
  const render = (sid) => {
    const session = readSession(sid)
    const kb = readKb()
    const hasSession = session.goal.length + session.done.length + session.open.length > 0
    if (!hasSession && kb.length === 0) return ''

    const lines = ['【工作记忆 · 自动注入】']
    if (hasSession) {
      lines.push(`当前会话工作集（${safeSid(sid) || 'unknown'}）：`)
      if (session.goal.length > 0) lines.push(`目标：${session.goal.slice(-DEFAULTS.maxGoals).map((x) => clip(x, 60)).join('；')}`)
      if (session.done.length > 0) lines.push(`已确认：\n${session.done.slice(-DEFAULTS.maxDone).map((x) => `- ${clip(x, 90)}`).join('\n')}`)
      if (session.open.length > 0) lines.push(`未决：\n${session.open.slice(-DEFAULTS.maxOpen).map((x) => `- ${clip(x, 90)}`).join('\n')}`)
    }
    if (kb.length > 0) {
      lines.push(`轻量知识库（${kb.length} 条，仅目录；正文用 read 打开 ${kbFile}）：`)
      for (const entry of kb.slice(0, maxKb)) {
        const flag = entry.status === 'active' ? '' : ` (${entry.status})`
        lines.push(`- [${entry.topic}] ${clip(entry.summary, 70)}${flag}`)
      }
    }
    lines.push(
      '写回规则：本轮出现新的结论 / 未决项 / 可复用知识时，直接编辑对应文件，保持一行一条；'
      + `会话工作集：${join(sessionsDir, `${safeSid(sid) || '<sid>'}.md`)}`,
    )

    let text = lines.join('\n')
    if (text.length > maxChars) text = `${text.slice(0, maxChars - 1)}…`
    return text
  }

  /** Create the store skeleton (idempotent). Used by the installer, not per turn. */
  const ensureStore = () => {
    mkdirSync(sessionsDir, { recursive: true })
    if (!existsSync(kbFile)) writeFileSync(kbFile, '# 轻量知识库（一行一条：[主题] 结论 | #tag | status | src | YYYY-MM-DD）\n', 'utf8')
  }

  return { render, ensureStore, readKb, readSession, kbFile, sessionsDir, storeDir }
}
