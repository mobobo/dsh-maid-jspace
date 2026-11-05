# dsh-maid-jspace

A thin DSH glue plugin that composes two **pristine** upstream packages:

- [`dsh-humanized-deepseek-maid`](https://github.com/loonai321/dsh-humanized-deepseek-maid) — whale-maid persona, layered memory, config routes. This plugin imports it and calls its `apply()` on its own context, so the upstream package is never modified.
- [`@anonyjcy/dsh-j-space`](https://www.npmjs.com/package/@anonyjcy/dsh-j-space) — the cognitive working protocol. This plugin only ships a combined skill and never mounts the upstream preset.

## Install (one command, three packages)

```powershell
dsh plugin --profile desktop add `
  "github:loonai321/dsh-humanized-deepseek-maid#c13281456456a6b4018288396eef14c3c97628c8" `
  "@anonyjcy/dsh-j-space@1.2.5" `
  "github:mobobo/dsh-maid-jspace#main"
```

Then add **only** this to `dsh.profile.bundles` in `$DSH_HOME/profiles/<profile>/package.json`:

```json
"dsh-maid-jspace"
```

Restart DSH. Do **not** add the maid or j-space packages to `bundles`: installed-but-not-mounted is exactly the "switched off" state, and the glue mounts the persona/memory itself — one mount point, no duplicates.

Why three packages: pnpm's `blockExoticSubdeps` forbids git-sourced *transitive* dependencies, so this package cannot declare the maid package as a dependency. Installing all three as top-level packages satisfies the policy and keeps the upstream copy genuinely unmodified.

See [README.zh.md](README.zh.md) for configuration (`config.maid`, `installSkill`, `enabled`), migration notes, and verified scenarios.

MIT licensed. No upstream code is copied.
