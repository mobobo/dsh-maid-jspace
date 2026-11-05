# dsh-maid-jspace

把「女仆人格」和「J-Space 工作纪律」组合成一个可安装的 DSH 插件，**同时让两个上游包保持原版、不改一行代码**。

- 女仆人格 / 分层记忆：上游 [`dsh-humanized-deepseek-maid`](https://github.com/loonai321/dsh-humanized-deepseek-maid) 提供，本插件只负责把它挂起来。
- J-Space 协议：上游 [`@anonyjcy/dsh-j-space`](https://www.npmjs.com/package/@anonyjcy/dsh-j-space) 提供，本插件投放一份「组合版技能」把两者接起来。
- 本仓库只有胶水：约 150 行 JS + 一份技能正文。

## 安装（一条命令装三个包）

```powershell
dsh plugin --profile desktop add `
  "github:loonai321/dsh-humanized-deepseek-maid#c13281456456a6b4018288396eef14c3c97628c8" `
  "@anonyjcy/dsh-j-space@1.2.5" `
  "github:<owner>/dsh-maid-jspace#main"
```

然后把**只**这一行加进 profile 的 `dsh.profile.bundles`（`$DSH_HOME/profiles/<profile>/package.json`）：

```json
"dsh-maid-jspace"
```

重启 DSH 即可。**不要**把女仆或 j-space 加进 bundles —— 它们装在那儿但不挂载，这就是「已安装、已关闭」的状态；人格与记忆由胶水自己挂，挂载点只有一处。

> 为什么三个包要一起装：pnpm 的 `blockExoticSubdeps` 禁止 git 源出现在**子依赖**里，所以本插件不能在 `dependencies` 里声明女仆包。三个都作为顶层依赖装，既绕开该策略，也保证上游是真正的原版包（不是我们复制的代码）。

## 配置

在 profile patch 里给本插件行加 `config`：

```yaml
- id: dsh-maid-jspace
  config:
    enabled: true                 # false = 只装技能、不挂人格
    installSkill: if-missing      # if-missing(默认) | always | never
    maid:                         # 写进上游包的 config.json（上游 apply 不读参数，只读自己的文件）
      mode: default               # proactive | passive | default
      address: 主人
      selfName: 我
      memoryPath: 'C:\Users\you\.dsh\maid-memory'
```

- 不写 `maid` 就完全不碰上游的 `config.json`，沿用那里已有的设置。
- `memoryPath` 是记忆目录，会话明细在其 `sessions/` 子目录里。

## 它做了什么

1. 把 `skills/maid-jspace/SKILL.md` 投放到 `$DSH_HOME/skills/maid-jspace.md`（默认只在缺失时写）。
2. 若给了 `config.maid`，原子写入上游包根目录的 `config.json`。
3. `import` 上游包并调用其 `apply(ctx)` —— 人设、分层记忆、配置路由都挂在**本插件的 ctx** 上，卸载本插件即全部卸载。

## 它不做什么

- 不修改上游包的任何文件。升级上游只需重跑上面那条 `add` 命令（换版本号）。
- 不把上游写进 bundles，因此不会重复挂载。
- 不安装 j-space 的 preset，也不复制它的 scripts。

## 迁移：以前挂过女仆插件

如果 `dsh.profile.bundles` 里曾经有 `dsh-humanized-deepseek-maid`（或其它地方插入过它的行），先删掉那条，或在 profile patch 里加：

```yaml
- id: dsh-humanized-deepseek-maid
  disabled: true
- id: preset-j-space
  disabled: true
```

否则人设段与记忆写入会各挂两份。

## 目录

```
dsh-maid-jspace/
├─ package.json          # dsh.bundle.patch → cordis.patch.yml
├─ cordis.patch.yml      # 只插入本插件一行
├─ lib/index.mjs         # 胶水
├─ skills/maid-jspace/SKILL.md
└─ README.md / README.zh.md
```

## 卸载

```sh
dsh plugin --profile <profile> remove dsh-maid-jspace
```

再删掉 `$DSH_HOME/skills/maid-jspace.md`。

## 验证情况

已在隔离的临时 profile 上跑过完整链路：

- 三个包用上面那条命令一次装完，`exit 0`；
- 组合后的配置树里只有 `dsh-maid-jspace` 一行，女仆 / j-space 的行都不存在（即未挂载）；
- 载入胶水 → 解析到上游包 → 调用其 `apply()` 成功，人设与记忆挂载、技能投放、`config.maid` 写入均通过；
- 上游缺失时只告警、不崩。

**未**在别人机器上做过端到端安装；第一次给别人装时留意启动日志里 `[dsh-maid-jspace]` 开头的行。

## License

MIT。上游女仆插件同为 MIT；j-space 套件为 Apache-2.0 / MIT（见其自身 LICENSE），本仓库不复制其代码。
