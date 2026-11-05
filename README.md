# dsh-maid-jspace

A thin DSH glue plugin that composes two **pristine** upstream packages:

- [`dsh-humanized-deepseek-maid`](https://github.com/loonai321/dsh-humanized-deepseek-maid) — whale-maid persona, layered memory, config routes. This plugin imports it and calls its `apply()` on its own context, so the upstream package is never modified.
- [J-Space Cognition Suite](https://github.com/Tiger3807861189/J-Space-Cognition-Suite) / [`@anonyjcy/dsh-j-space`](https://www.npmjs.com/package/@anonyjcy/dsh-j-space) — the cognitive working protocol. This plugin only ships a combined skill; the upstream preset stays disabled.

```sh
dsh plugin --profile <profile> add "github:<owner>/dsh-maid-jspace#main"
```

Then disable the upstream persona row in your profile patch, or you get the persona and memory mounted twice:

```yaml
- id: dsh-humanized-deepseek-maid
  disabled: true
```

Restart DSH afterwards. See [README.zh.md](README.zh.md) for configuration (`config.maid`, `installSkill`, `enabled`) and the design rationale.

MIT licensed. No upstream code is copied.
