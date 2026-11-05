# dsh-maid-jspace

A thin glue plugin for DeepSeek Harness (DSH). It does two things and nothing else:

1. **Mounts a pristine persona package.** [`dsh-humanized-deepseek-maid`](https://github.com/loonai321/dsh-humanized-deepseek-maid) hard-codes its own mount, so it cannot be combined with anything without forking it. This plugin owns the mount point instead: it imports the upstream package and calls its `apply()` on its own context. The upstream stays untouched and stays upgradable.
2. **Owns the working memory the persona layer lacks.** A per-session working set (goal / confirmed / open items) plus a small knowledge base, injected as a compact index every turn. A decision made 30 turns ago is still there after context compaction, and the token cost stays flat because only the index is injected — detail is read on demand.

It also ships one skill, `maid-jspace`: the J-Pace working protocol applied under the maid persona, with the upstream protocol's host assumptions corrected for DSH.

## Quick start

```powershell
dsh plugin --profile desktop add `
  "github:loonai321/dsh-humanized-deepseek-maid#c13281456456a6b4018288396eef14c3c97628c8" `
  "@anonyjcy/dsh-j-space@1.2.5" `
  "github:mobobo/dsh-maid-jspace#main"
```

Then append **one** line to `dsh.profile.bundles` in `$DSH_HOME/profiles/desktop/package.json`:

```json
"dsh-maid-jspace"
```

Restart DSH. That is the whole install.

## What each piece is for

| Piece | Role |
|---|---|
| this plugin | the only mount point for the persona; owner of session memory + KB; installs the skill |
| `dsh-humanized-deepseek-maid` | persona injection, layered long-term memory, its own config route |
| `@anonyjcy/dsh-j-space` | the cognition protocol text and scripts (this plugin never mounts its preset) |
| `maid-jspace` skill | the combined working discipline, installed to `$DSH_HOME/skills/maid-jspace.md` |

## Usage

### Working memory, per turn

Every turn the model gets a block like this (budget ~900 chars, index only):

```
【工作记忆 · 自动注入】
当前会话工作集（<sid>）：
目标：…
已确认：
- [10-21] …
未决：
- …
轻量知识库（3 条，仅目录；正文用 read 打开 …\kb.md）：
- [花色撤回换牌] 根因与救场换牌无关… (done)
写回规则：…直接编辑对应文件，保持一行一条
```

Two plain markdown files under `$DSH_HOME/maid-jspace-memory/`:

```
sessions/<sid>.md     ## 目标 / ## 已确认 / ## 未决   (one item per line)
kb.md                 - [topic] one-line conclusion | #tag1 #tag2 | status: active|done|dropped | src: … | 2026-10-21
```

Write-back is **file editing**, not a tool call: the block tells the model where the files are and what the format is. There is deliberately no registered tool — `defineTool` lives in `@deepseek-ai/dsh-tools`, which an installed plugin cannot resolve.

### Configuration

Put this on the plugin row in your profile patch:

```yaml
- id: dsh-maid-jspace
  config:
    enabled: true                 # false = skill + memory only, no persona
    installSkill: if-missing      # if-missing (default) | always | never
    memory:
      enabled: true
      storeDir: 'C:\Users\you\.dsh\maid-jspace-memory'
      maxChars: 900               # injection cap
      maxKb: 15                   # how many KB rows to list
    maid:                         # written into the upstream config.json
      mode: default               # proactive | passive | default
      address: 主人
      selfName: 我
      memoryPath: 'C:\Users\you\.dsh\maid-memory'
```

Omit `maid` and the upstream `config.json` is left alone.

## Caveats (read before installing)

1. **Install all three packages in one command.** pnpm's `blockExoticSubdeps` rejects a git-sourced *transitive* dependency, so this plugin intentionally declares no dependencies. Installing only this one gives you the skill and working memory but **no persona** — the log says `upstream not installed; nothing mounted`.
2. **Never add the upstream packages to `dsh.profile.bundles`.** Installed-but-not-listed *is* the "installed but switched off" state. If you previously had `dsh-humanized-deepseek-maid` in `bundles`, remove that entry (or add `- id: dsh-humanized-deepseek-maid` + `disabled: true` to your patch), otherwise the persona and the memory writer get mounted twice.
3. **Restart is required.** Plugins mount at boot. The skill file is read per invocation, so it updates without a restart.
4. **Version matters.** Built against the DSH `0.2.1-rc.x` line (`systemPrompt.section`, `agent/pre-step`). On an incompatible host the plugin's `inject` never satisfies and it stays inert — check the `[dsh-maid-jspace]` log lines after boot.
5. **No tool is registered**, by design. If you run a profile with no filesystem tools, write-back is not possible and the memory becomes read-only.
6. **The upstream's per-session memory patch is not part of upstream.** This machine's local build carries a session-isolation patch; the GitHub version does not. Reinstalling from upstream replaces it — the global memory file survives, but `sessions/` stops being written.
7. **One writer per memory directory.** Do not point two DSH instances (or two plugins) at the same `storeDir`; there is no locking.
8. **Multi-source routing is not implemented yet.** A home/family knowledge base routed alongside the work KB is designed (fs / HTTP index + keyword routing) but not shipped.
9. **If GitHub is unreachable** on the target machine: `git clone` the repo, then `dsh plugin --profile desktop add "file:<path>"`. The `file:` form installs fine as a top-level package.

## Layout

```
dsh-maid-jspace/
├─ package.json          # dsh.bundle.patch → cordis.patch.yml, no declared deps
├─ cordis.patch.yml      # inserts this plugin's row only
├─ lib/index.mjs         # proxy upstream + register the memory section
├─ lib/memory.mjs        # session set + KB parse/render
├─ skills/maid-jspace/SKILL.md
└─ README.md / README.zh.md
```

## Verified

Run against an isolated profile: three packages install in one command (exit 0); the composed tree contains only `dsh-maid-jspace` (no upstream rows); loading the glue resolves the upstream, calls its `apply()`, installs the skill, writes `config.maid`, and registers the memory section (337-char render on seeded data); a missing upstream only warns.

Not yet verified on a second machine. Watch the `[dsh-maid-jspace]` lines on first boot.

## License

MIT. The upstream persona plugin is MIT; the j-space suite is Apache-2.0 / MIT. No upstream code is copied into this repository.
