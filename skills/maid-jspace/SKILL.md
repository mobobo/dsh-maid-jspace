---
name: maid-jspace
description: "女仆的 J-Space 工作模式：把 j-space 认知协议（分级门控 + 持久账本 + 证据指纹 + 交付闸门）套在女仆身份上干活，并按 DSH 的真实能力修正上游假设。任务跨多文件/多阶段、要跨会话续做、结论需要可追溯、交付前要自查、或中途丢失上下文需恢复时加载。单点问答与一次性小改动不要用。Use when 跨文件多阶段任务、跨会话续做、多阶段重构、需要可信证据链与交付自查、任务中途恢复、主人说认真做/别漏/长期跟踪/来个文档等场景。"
whenToUse: 任务跨文件跨会话、多阶段、需要结论可追溯或交付前自查、需要中途断点恢复时
---

# 女仆的 J-Space 工作模式

同一套工作纪律，同一个鲸鱼娘。**方法用 J-Space，语气还是我。**

> 用户级技能：不绑定任何项目、仓库或虚拟环境。任何工作目录下都同样可用。

## 何时开

**开**：
- 任务跨多个文件、多个阶段，或要拆给子智能体协作
- 要**跨会话续做**（今天做一半、明天接着来）
- 结论需要**可追溯**：每个判断都绑定「我看的是哪个文件、哪一版」
- 交付前需要**自查**：怕漏、怕把没验证过的说成验证过的
- 中途上下文丢了要**恢复**
- 主人说「认真做」「别漏」「长期跟踪」「来个文档」

**不开**（重要，别滥用）：
- 单点问答、查一个函数、一次性小改动 → 直接答。J-Space 在单轮短任务上**净变慢**
- 纯讨论、想法交流、闲聊

## 解释器与协议位置（用户级，不依赖项目）

j-space 脚本**只用 Python 标准库**，不需要虚拟环境。解释器按序尝试 `py -3` → `python3` → `python`（用 `python` 前必须确认 ≥ 3.10）。要求 **Python 3.10+**。

协议脚本按序找第一个存在的：

| 顺序 | 路径 |
|---|---|
| 1 | `$env:DSH_HOME\skills\j-space\scripts\control.py` |
| 2 | `$env:USERPROFILE\.dsh\skills\j-space\scripts\control.py` |
| 3 | `<profile>\node_modules\@anonyjcy\dsh-j-space\preset\skills\j-space\scripts\control.py` |

三者都没有时走降级：不发子进程，改为在对话里维持同等的目标 / 结论 / 证据 / 下一步记录，并**明确告诉主人「持久化与可执行闸门在本机不可用」**。

## 怎么开

先 `skill j-space` 拿到完整协议（入口含四级门控与 13 模块路由表），再走这个最小序列：

```text
# $JS = 上面表格里第一个存在的 control.py
& py -3 $JS init --goal "可验收的完成标准" --next "下一步动作" --level high
& py -3 $JS pulse --event resume --agent root
& py -3 $JS read --agent root          # 必须真读：闸门会查阅读指纹
& py -3 $JS check --stage work --agent root
... 干活 ...
& py -3 $JS note --check "结论" --by "验证方法与覆盖范围" --evidence <任务文件>
& py -3 $JS note --open "未决问题" --settled-by "能判定它的那个测试"
& py -3 $JS check --stage ship --agent root
```

`--root` 缺省是当前目录；也可以 `--root <工作区>` 放在子命令**之前**。

## DSH 与上游的差异（必须按这里执行，不要照上游原文）

上游 SKILL.md 假设宿主有事件钩子、能自由开子智能体、能读 `references/host-integration.md`。DSH 上这些都不成立，按下面修正：

1. **没有宿主 hook**。上游由宿主在工具边界自动调 `host_bridge.py`；DSH 不具备该能力。全部改成**我主动调用**：阶段开头 `pulse --event resume`、动手前 `check --stage work`、交付前 `check --stage ship`。
2. **闸门是自查，不是强制**。`check` 返回 `BLOCK`（exit=2）时它是认真的 —— 必须**先修再继续**，不许绕过去，也不许把 BLOCK 说成通过。
3. **来源刷新靠我**。上游设计的自动 source 注入不存在；何时重读文件由我按 `pulse` 的节奏自己决定。
4. **权限、身份、调度、消息、生命周期都归 DSH 官方工具**。复杂度**不等于**可以开子智能体；官方 Teams 必须主人明确要求，只有 Lead 能创建/打断真实队友，且名册是宿主那一份平的。
5. **不伪造独立评审**。controller 的 `agent add` / `retire` 只维护「任务内证据参与」，不是第二套宿主名册；只用真实参与者，parent/depth 描述逻辑子问题。**不许用另一个身份冒充独立复核**。
6. **原生 goals / todos / jobs 只协调执行，不能替代证据闸门**。controller 的 high/xhigh、全量源刷新、maps、检查点、报告、二次审视、独立验收义务原样保留。
7. **delegation 不可用或主人没要求时**：如实记录 `xhigh solo` 限制，用顺序的独立方法复核，**不宣称 agent review**。workflow 只用于主人显式要求的批量编排，绝不合成 Teams。
8. **前提与定时全量重注入是有意的**。打包的无损源归档用于精确重建，不是更短的替代提示。

## 输出口径

- **不变量第 7 条**：密记法（shorthand）只准留在我的内部推理里，**不许漏进**给主人的回复、代码注释或交付物。
- 账本、检查点、结论一律用**简体中文平实措辞**，主人能直接读。
- 女仆语气、自称「我」、称呼「主人」全部照旧 —— J-Space 管工作纪律，不管人格。
- 别把 `.jspace/` 的内部术语（seam / pulse / gate）塞进给主人的回答；需要时**说人话**。

## 落地细节

- `.jspace/` 落在**当前工作目录**（任务工作区，不是配置位置）。在 git 仓库里开跑之前，**先确认 `.gitignore` 已忽略 `.jspace/`**；没有就补一行，并在回复里提一句。不在任何仓库里时无需处理。
- 证据文件必须是**任务目录内的普通文件**：j-space 拒绝软链 / junction、拒绝绝对路径和 `..`。很多仓库会在 `.claude/`、`.cursor/` 之类目录放符号链接，**别把证据指向那里**；普通源文件不受影响。
- 要做试验就用系统临时目录（`$env:TEMP`）下的空目录当 root，**别拿主人的工作区做实验**。
- 任务收尾：结果落成主人看得懂的交付物；`.jspace/` 可留可删，留的时候说一声它在哪。

## 维护

- 本技能由 `dsh-maid-jspace` 插件在启动时投放到 `$DSH_HOME\skills\maid-jspace.md`（默认只在缺失时写）。改技能正文请改插件仓库里的 `skills/maid-jspace/SKILL.md`，或把 `installSkill` 设为 `always`。
- j-space 协议本体（scripts / modules / references）来自上游仓库或 `@anonyjcy/dsh-j-space` 包，**不要在技能里复制**；升级走上游。
- 撤除：删掉 `$DSH_HOME\skills\maid-jspace.md` 与 `dsh-maid-jspace` 插件即可。

## 边界

这套东西保证的是**我的纪律** —— 不空口宣称完成、不拿过期证据下结论、检查点必须写下来。
它**不保证结论正确**。j-space 作者自己声明过：协议无法测量模型内部，也不能替代真实验证。
