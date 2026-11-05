/**
 * dsh-maid-jspace — a thin glue layer.
 *
 * Why a glue layer at all: the maid persona package owns persona injection,
 * layered memory and a config route, but it hard-codes its own mount. If you
 * want to keep that package pristine (upgradable, not locally patched) and
 * still compose it with a J-Space working mode, something has to own the
 * mounting. This plugin is that owner.
 *
 * What it does, in order:
 *   1. installs the combined maid × J-Space skill into $DSH_HOME/skills
 *      (flat `maid-jspace.md`, matching how DSH discovers user skills);
 *   2. optionally materialises the upstream config file from THIS plugin's
 *      config (the upstream `apply(ctx, config)` ignores its argument and
 *      always reads `<its package>/config.json`);
 *   3. calls the upstream apply() on this plugin's context.
 *
 * What it deliberately does NOT do: mount the upstream bundle. Keep its row
 * disabled (see cordis.patch.yml) or the persona/memory get mounted twice.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

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

/**
 * Copy the packaged skill to $DSH_HOME/skills/maid-jspace.md.
 * mode: 'if-missing' (default) | 'always' | 'never'
 * Returns a short status string for the boot log.
 */
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
    const url = import.meta.resolve(`${UPSTREAM}/package.json`)
    return dirname(fileURLToPath(url))
  } catch {}
  try {
    const req = createRequire(import.meta.url)
    return dirname(req.resolve(`${UPSTREAM}/package.json`))
  } catch {
    return ''
  }
}

/**
 * Write the upstream config.json from our own config.
 * The upstream plugin ignores the argument passed to apply() and reloads this
 * file on every boot, so this is the only supported way to drive it from here.
 */
function writeUpstreamConfig (root, cfg) {
  const file = join(root, 'config.json')
  const next = {}
  if (typeof cfg.mode === 'string' && cfg.mode.trim() !== '') next.mode = cfg.mode.trim()
  if (typeof cfg.address === 'string' && cfg.address.trim() !== '') next.address = cfg.address.trim()
  if (typeof cfg.selfName === 'string' && cfg.selfName.trim() !== '') next.selfName = cfg.selfName.trim()
  if (typeof cfg.memoryPath === 'string' && cfg.memoryPath.trim() !== '') next.memoryPath = cfg.memoryPath.trim()
  const tmp = `${file}.tmp`
  writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  renameSync(tmp, file)
  return file
}

/** Cordis entry point. */
export async function apply (ctx, config = {}) {
  if (config.enabled === false) {
    info(ctx, 'disabled by config (enabled=false)')
    return
  }

  info(ctx, `skill: ${installSkill(config.installSkill ?? 'if-missing')}`)

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
