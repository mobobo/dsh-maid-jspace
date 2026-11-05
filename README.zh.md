# dsh-maid-jspace

把「女仆人格」和「J-Space 工作纪律」组合成一个可安装的 DSH 插件，**同时让两个上游包保持原版、不改一行代码**。

- 女仆人格 / 分层记忆：由上游 [`dsh-humanized-deepseek-maid`](https://github.com/loonai321/dsh-humanized-deepseek-maid) 提供，本插件只负责把它挂起来。
- J-Space 协议：由上游 j-space 套件 / [`@anonyjcy/dsh-j-space`](https://www.npmjs.com/package/@anonyjcy/dsh-j-space) 提供，本插件只投放一份「组合版技能」把两者接起来。
- 本仓库只有胶水：约 150 行 JS + 一份技能正文。

## 为什么需要胶水层

女仆插件自己 `ctx.effect(...)` 注册人设段、记忆钩子和配置路由，但它只能被装载器整包挂载。想「原版 + 可升级 + 与 J-Space 组合」，就得有人替它挂载 —— 那就是本插件：它 `import` 上游包、在自己的 ctx 上调上游的 `apply()`，因此上游包永远保持原样。

J-Space 那边没有可代理的运行时：它的能力是一条**声明式 preset**（由装载器解析）加一套**技能文件**。所以本插件不碰它的 preset，只投放组合技能；J-Space 的 preset 行请保持关闭。

## 安装

```sh
# 从 GitHub
dsh plugin --profile <profile> add "github:<owner>/dsh-maid-jspace#main"

# 或从本地目录
dsh plugin --profile <profile> add "file:D:/workCode/dsh-maid-jspace"
```

装完**必须**在你的 profile patch（`$DSH_HOME/profiles/<profile>/cordis.patch.yml`）里关掉上游行，否则人设段和记忆会挂两遍：

```yaml
- id: dsh-humanized-deepseek-maid
  disabled: true

# 如果你同时装了 j-space 插件，也建议关掉它的 preset
- id: preset-j-space
  disabled: true
- id: j-space
  disabled: true
```

然后**重启 DSH**（插件在启动时装载，技能文件在下次调用时读取）。

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

- 不写 `maid` 就完全不碰上游的 `config.json`，沿用你在那里已有的设置。
- 被说的 `memoryPath` 就是记忆目录，会话明细在其 `sessions/` 子目录里。

## 它做了什么

1. 把 `skills/maid-jspace/SKILL.md` 投放到 `$DSH_HOME/skills/maid-jspace.md`（默认只在缺失时写）。
2. 若给了 `config.maid`，原子写入上游包根目录的 `config.json`。
3. `import` 上游包并调用其 `apply(ctx)` —— 人设、分层记忆、配置路由都挂在**本插件的 ctx** 上，卸载本插件即全部卸载。

## 它不做什么

- 不修改、不 patch 上游包的任何文件；升级只需改本仓库 `package.json` 里的依赖版本。
- 不挂载上游 bundle（这正是要你 `disabled: true` 的原因）。
- 不安装 j-space 的 preset，也不复制它的 scripts —— 那是上游的事。

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

再删掉 `$DSH_HOME/skills/maid-jspace.md`，并恢复你关掉的那两行（想恢复女仆直挂的话）。

## 状态声明

- 已在作者本机验证：包可解析、patch 可装载、技能可投放、上游 `apply` 可被调用。
- **未**在干净机器上做过端到端安装验证；第一次给别的机器装时，请留意启动日志里 `[dsh-maid-jspace]` 开头的几行。

## License

MIT。上游女仆插件同为 MIT；j-space 套件为 Apache-2.0 / MIT（见其自身 LICENSE），本仓库不复制其代码。
