/**
 * dsh-maid-jspace — a thin glue layer.
 *
 * Two jobs, both narrow:
 *
 *   1. Mount the pristine maid persona/memory package on this plugin's context.
 *      The upstream package hard-codes its own mount; we own the mount point so
 *      the upstream stays upgradable and unpatched.
 *   2. Own the working memory the persona layer lacks: a per-session working set
 *      (goal / confirmed / open) plus a small knowledge base, injected as a
 *      compact index every turn. Detail is never injected, so a decision made
 *      long ago survives context compaction without paying tokens for it.
 *
 * What it deliberately does NOT do: mount the upstream bundle (keep its row out
 * of `dsh.profile.bundles`) and register tools. Write-back is done by editing
 * the two markdown files directly — registering a tool would require
 * `@deepseek-ai/dsh-tools`, which is not resolvable from an installed plugin.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMemory } from './memory.mjs'

/** cordis plugin name. */
export const name = 'dsh-maid-jspace'

/** Same services the upstream persona package needs; it runs on this ctx. */
export const inject = ['webServer', 'systemPrompt', 'settings']

const UPSTREAM = 'dsh-humanized-deepseek-maid'
const SKILL_FILE = 'maid-jspace.md'
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SKILL_SRC = join(ROOT, 'skills', 'maid-jspace', 'SKILL.md')

/** $DSH_HOME, defaulting to ~/.dsh. */
function dshHome () {
  return process.env.DSH_HOME && process.env.DSH_HOME.trim() !== ''
    ? process.env.DSH_HOME
    : join(homedir(), '.dsh')
}

function info (ctx, msg) {
  const line = `[dsh-maid-jspace] ${msg}`
  try {
    if (ctx && ctx.logger && typeof ctx.logger.info === 'function') return ctx.logger.info(line)
  } catch {}
  console.log(line)
}

function warn (ctx, msg) {
  const line = `[dsh-maid-jspace] ${msg}`
  try {
    if (ctx && ctx.logger && typeof ctx.logger.warn === 'function') return ctx.logger.warn(line)
  } catch {}
  console.warn(line)
}

/** Copy the packaged skill to $DSH_HOME/skills/maid-jspace.md. */
function installSkill (mode) {
  if (mode === 'never') return 'skipped (installSkill=never)'
  if (!existsSync(SKILL_SRC)) return 'source missing (packaging error)'
  const target = join(dshHome(), 'skills', SKILL_FILE)
  if (mode !== 'always' && existsSync(target)) return `kept existing ${target}`
  try {
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, readFileSync(SKILL_SRC), 'utf8')
    return `installed ${target}`
  } catch (error) {
    return `failed: ${error instanceof Error ? error.message : String(error)}`
  }
}

/** Absolute path of the installed upstream package root, or '' when absent. */
function upstreamRoot () {
  try {
    return dirname(fileURLToPath(import.meta.resolve(`${UPSTREAM}/package.json`)))
  } catch {}
  try {
    return dirname(createRequire(import.meta.url).resolve(`${UPSTREAM}/package.json`))
  } catch {
    return ''
  }
}

/** Drive the upstream config.json (its apply() ignores the argument it is given). */
function writeUpstreamConfig (root, cfg) {
  const file = join(root, 'config.json')
  const next = {}
  for (const key of ['mode', 'address', 'selfName', 'memoryPath']) {
    const value = cfg[key]
    if (typeof value === 'string' && value.trim() !== '') next[key] = value.trim()
  }
  const tmp = `${file}.tmp`
  writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  renameSync(tmp, file)
  return file
}

/** Session id from a DSH session-ish object (`id` / `sessionId`, defensive). */
function sidOf (session) {
  const value = session && typeof session === 'object' ? (session.id ?? session.sessionId) : undefined
  return typeof value === 'string' ? value.trim() : ''
}

/** Cordis entry point. */
export async function apply (ctx, config = {}) {
  if (config.enabled === false) {
    info(ctx, 'disabled by config (enabled=false)')
    return
  }

  info(ctx, `skill: ${installSkill(config.installSkill ?? 'if-missing')}`)

  // ---- 1) working memory: session working set + small knowledge base --------
  const memoryCfg = config.memory && typeof config.memory === 'object' ? config.memory : {}
  let currentSid = ''
  if (memoryCfg.enabled !== false) {
    const storeDir = typeof memoryCfg.storeDir === 'string' && memoryCfg.storeDir.trim() !== ''
      ? memoryCfg.storeDir.trim()
      : join(dshHome(), 'maid-jspace-memory')
    const memory = createMemory({
      storeDir,
      maxChars: typeof memoryCfg.maxChars === 'number' ? memoryCfg.maxChars : undefined,
      maxKb: typeof memoryCfg.maxKb === 'number' ? memoryCfg.maxKb : undefined,
    })
    try {
      memory.ensureStore()
      info(ctx, `memory store: ${storeDir}`)
    } catch (error) {
      warn(ctx, `memory store not writable: ${error instanceof Error ? error.message : String(error)}`)
    }

    // Track the session of the running agent so the section can render it.
    ctx.on('agent/pre-step', async (payload, next) => {
      try {
        const sid = sidOf(payload && payload.agent ? payload.agent.session : undefined)
        if (sid !== '') currentSid = sid
      } catch {}
      return next()
    })

    const systemPrompt = typeof ctx.get === 'function' ? ctx.get('systemPrompt') : undefined
    if (systemPrompt !== undefined && typeof systemPrompt.section === 'function') {
      ctx.effect(
        () => systemPrompt.section({
          name: 'plugin:dsh-maid-jspace:memory',
          order: 5,
          text: () => memory.render(currentSid),
        }),
        'dsh-maid-jspace: working memory',
      )
      info(ctx, 'working-memory section registered')
    } else {
      warn(ctx, 'systemPrompt unavailable; working memory not injected')
    }
  }

  // ---- 2) proxy the pristine upstream persona/memory -----------------------
  let upstream
  try {
    upstream = await import(UPSTREAM)
  } catch (error) {
    warn(ctx, `upstream not installed (${error instanceof Error ? error.message : String(error)}); nothing mounted`)
    return
  }
  if (typeof upstream.apply !== 'function') {
    warn(ctx, 'upstream exports no apply(); nothing mounted')
    return
  }

  const root = upstreamRoot()
  if (root && config.maid && typeof config.maid === 'object') {
    try {
      info(ctx, `maid config written: ${writeUpstreamConfig(root, config.maid)}`)
    } catch (error) {
      warn(ctx, `could not write maid config: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  try {
    await upstream.apply(ctx, {})
  } catch (error) {
    warn(ctx, `upstream apply failed: ${error instanceof Error ? error.message : String(error)}`)
    return
  }

  info(ctx, 'persona + memory mounted through glue (upstream row must stay disabled)')
}
