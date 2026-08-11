---
title: 我的 Claude Code 本地工具栈
pubDate: 2026-08-11
categories:
  - tools
description: 我本地是怎么用 Claude 的——自建模型网关、MCP、十几个插件、二十多个 Hook、Exa 搜索与跨会话记忆等自建基础设施。
---

# 我的 Claude Code 本地工具栈

> 一份用于分享的「我本地是怎么用 Claude 的」清单。涵盖接入方式、模型路由、MCP、插件、Skills、Hooks 与自建基础设施。
> 生成日期:2026-08-11

---

## 0. 一句话概览

我不用裸的 Claude Code。本地是一套**重度定制**的配置:自建模型网关接入国产模型、十几个插件提供领域技能、四个常驻 MCP 扩展能力边界、二十多个 Hook 把会话生命周期焊死到外部工具、再叠加 Exa 搜索 / agentmemory 跨会话记忆 / image-reader 图片识别等自建基础设施。核心理念是:**把 Claude Code 当成一个可编程的 agent runtime,而不是一个聊天框**。

---

## 1. 接入方式与模型路由

我走的是**自建中转网关**,不直连 Anthropic 官方 API。配置在 `~/.claude/settings.json` 的 `env` 里:

| 角色 (Claude Code 槽位) | 实际模型 | 来源 |
|---|---|---|
| Opus / 主模型 (`ANTHROPIC_MODEL`) | `aliyun/glm-5.2[1M]` | 阿里 (智谱 GLM-5.2,1M 长上下文) |
| Sonnet | `aliyun/MiniMax-M3[1M]` | 阿里 (MiniMax-M3) |
| Haiku | `volcengine/Doubao-Seed-2.1-pro` | 火山引擎 (豆包) |
| Subagent | `aliyun/deepseek-v4-pro[1M]` | 阿里 (DeepSeek-V4-Pro) |
| 网关地址 | `https://claudecode.sf-express.com/ccr` | 顺丰内部中转 |

要点:
- **主模型是 GLM-5.2**,不是 Claude。所以"我本地用 Claude"本质是「用 Claude Code 这个壳,跑国产模型」。好处是成本可控、长上下文(1M)、走公司网关。
- **不同子任务路由到不同模型**:识图交给 Sonnet(MiniMax-M3,主模型不识图)、子 agent 用 DeepSeek-V4-Pro、轻量任务用豆包。
- `defaultMode: auto` + `Bash` 已全局 allow,日常很少被权限弹窗打断。

---

## 2. MCP 服务器

MCP 是扩展 Claude 能力的标准协议。我本地**当前会话实际连接 4 个**,另有 2 个已配置/已退役:

### 2.1 常驻生效

| MCP | 作用 | 常用度 |
|---|---|---|
| **agentmemory** | 跨会话长期记忆系统。actions(任务依赖图)/ memories / lessons / crystals / signals / slots / sentinels。会话收尾自动复盘写入,SessionStart 自动 recall 注入最近记忆。**我复利式积累工程经验的核心。** | ★★★★★ |
| **codebase-memory-mcp** | 代码知识图谱。把仓库索引成图,支持 `search_graph` / `trace_path`(调用链)/ `query_graph`(Cypher)/ `get_architecture`。SessionStart hook 强制「代码探索先用图谱,再 grep」。 | ★★★★ |
| **semble** | 即时代码搜索。给任意本地/远程 git 仓库,一次 `search` 直接定位到文件+行号,`find_related` 找相似代码。比 grep 快且带语义。 | ★★★★ |
| **blender** | Blender 3D 遥控。下载 Polyhaven / Sketchfab 资产、Hunyuan3D / Hyper3D 文生/图生 3D、执行 Python 脚本、截视口。做 3D 相关实验时用。 | ★★ |

### 2.2 已配置但当前未启用 / 已退役

- `code-review-graph`(`~/.claude/.mcp.json`):代码审查图谱服务,已配但本会话未连接。
- `ddg-search`(`~/.claude/mcp.json`):DuckDuckGo 搜索 MCP,**已退役**——CLAUDE.md 明确禁用内置 WebSearch/WebFetch 与 ddg,统一改用 Exa(见 §6.1)。

---

## 3. 插件 (Plugins)

共安装 **16 个插件**,来自 13 个 marketplace。启用状态(`settings.json` 的 `enabledPlugins`)如下:

### 3.1 启用中 (10 个)

| 插件 | 版本 | 来源 | 作用 |
|---|---|---|---|
| **superpowers** | 6.2.0 | anthropics/claude-plugins-official | 工程流程骨架。brainstorming / systematic-debugging / TDD / writing-plans / subagent-driven-development / requesting & receiving code-review 等。**强制:任何创作类任务先 brainstorm,任何 bug 先 systematic-debugging。** |
| **ponytail** | 4.8.3 | DietrichGebert/ponytail | "懒 Senior 开发者"原则。YAGNI 阶梯(能不能不写 / 复用 / stdlib / 一行搞定 / 才写最小代码)、最短 diff、删除优先。SessionStart 注入,full 级别常驻。 |
| **i-have-adhd** | 0.1.0 | ayghri/i-have-adhd | 输出适配 ADHD 阅读:第一行=下一步动作、多步任务编号、每轮重述状态、列表≤5、给具体时间估算、错误就事论事。always-on。 |
| **andrej-karpathy-skills** | 1.0.0 | forrestchang/andrej-karpathy-skills | karpathy 四原则:显式假设 / 最小代码 / 外科式改动 / 可验证目标。是我执行 pipeline 的第 1+4 步。 |
| **frontend-design** | — | anthropics/claude-plugins-official | 前端视觉设计指南,反"AI 模板感"。 |
| **oh-my-mermaid** | 0.2.0 | oh-my-mermaid/oh-my-mermaid | Mermaid 图表增强:scan 架构生成 `.omm/` 文档、push、view。 |
| **skill-creator** | — | anthropics/claude-plugins-official | 创建/编辑/评测 Skill。我自己写 skill 时用。 |
| **rust-analyzer-lsp** | 1.0.0 | anthropics/claude-plugins-official | Rust LSP 集成。 |
| **warp** | 2.1.0 | warpdotdev/claude-code-warp | Warp 终端集成。 |
| **kami** | 1.12.0 | tw93/kami | 文档排版设计系统(暖纸+墨蓝+衬线)。**严格触发**:仅当用户明确说"Kami"才用。 |

### 3.2 已安装但禁用 (3 个)

- `caveman`(极简输出风格)、`everything-claude-code`(全家桶)、`ralph-loop`(循环 agent)——装了但 `enabled: false`,按需开。

### 3.3 其余已安装(未在 enabled 列表,marketplace 已加)

`compound-engineering`、`academic-research-skills`、`swift-lsp`、`anthropic-agent-skills`、`addy-agent-skills`——marketplace 已订阅,可随时启用。

---

## 4. Skills(技能,共 100+)

Skills 是按需加载的领域能力。数量很多,下面**按用途分组**,带 ★ 的是我高频用的,只给一句话说明;不常用的仅列名。

### 4.1 工程流程与代码质量 ★

- ★ **karpathy-guidelines** — 显式假设+可验证目标,执行 pipeline 第 1 步。
- ★ **ponytail / ponytail-review / ponytail-audit / ponytail-debt** — 懒开发+债务审计。
- ★ **spec** — 模糊意图 → 精确可执行 spec,五阶段。
- ★ **ship** — 一键发版:合并 base / 跑测 / review diff / bump VERSION / CHANGELOG / commit / push / 开 PR。
- ★ **review / code-review / simplify** — PR 预审、diff 找 bug、diff 做简化清理。
- ★ **investigate / systematic-debugging** — 根因式系统调试。
- ★ **qa / qa-only** — 系统化 QA 测 web app(qa-only 只报不修)。
- ★ **verify** — 端到端验证改动确实生效,不只跑测试。
- ★ **requesting-code-review / receiving-code-review** — 完成后主动求审 / 收到 review 时理性验证不盲从。
- **superpowers 系**:brainstorming、writing-plans、executing-plans、subagent-driven-development、dispatching-parallel-agents、finishing-a-development-branch、using-git-worktrees、test-driven-development、verification-before-completion、using-superpowers、writing-skills。
- **gstack 工程系**:autoplan(自动跑 CEO/设计/工程/DX 四审)、careful / guard / freeze / unfreeze(安全护栏+目录锁定)、context-save / context-restore、retro、health、benchmark、investigate、office-hours、plan-ceo-review / plan-design-review / plan-eng-review / plan-devex-review / plan-tune。

### 4.2 调研与搜索 ★

- ★ **agent-reach** — 13 平台全网调研路由(小红书/推特/B站/Reddit/V2EX/LinkedIn/YouTube/GitHub/RSS/播客…),多后端。**我全网调研首选。**
- ★ **deep-research** — 多源扇出搜索 + 抓取 + 对抗式事实核查 + 引用报告。
- ★ **research-to-pdf** — 完整 deep-research 流水线,产出本地 PDF(可选发邮件),留学/选校/技术调研都走它。
- ★ **follow-builders** — 监控顶级 AI builder(X/YouTube 播客)内容摘要。
- **book-to-skill / scrape / browse / connect-chrome / setup-browser-cookies / pair-agent** — 抓页/无头浏览器/cookie 导入/远程 agent 配对浏览器。

### 4.3 文档与排版 ★

- ★ **tech-report** — techreport LaTeX 模板生成中文技术报告 PDF(封面/双页码/公式/流程图/GB-T 7714 参考文献)。
- ★ **make-pdf** — markdown → 出版级 PDF。
- ★ **ppt-master** — 源文档(PDF/DOCX/URL/MD)→ 多角色协作生成 SVG PPT 页 → PPTX。
- ★ **guizang-ppt-skill** — 横向翻页网页 PPT(单 HTML),电子杂志风 / 瑞士国际主义风。
- ★ **kami** — 衬线+暖纸+墨蓝的排版系统(简历/一页纸/白皮书/landing page),仅"Kami"关键词触发。
- ★ **graphify** — 任意输入(代码/文档/论文/图片)→ 知识图谱 → 聚类社区 → HTML+JSON+审计报告。
- ★ **archify** — 架构/流程/时序/数据流/状态机图,独立可探索 HTML。
- ★ **excalidraw-diagram-generator** — 自然语言 → Excalidraw 图(流程图/思维导图/架构图)。
- ★ **diagram / oh-my-mermaid(omm-scan/omm-push/omm-view)** — 图表三联(源+可编辑+渲染)/ Mermaid 架构扫描。
- **codebase-to-course** — 代码库 → 交互式单页 HTML 课程。
- **document-generate / document-release** — 从零生成 / 发版后更新文档。

### 4.4 前端与视觉设计

- **设计语言类**:brandkit(品牌系统)、design-taste-frontend、gpt-taste、high-end-visual-design、minimalist-ui、industrial-brutalist-ui、stitch-design-taste、ui-ux-pro-max(50+ 风格/161 配色/57 字体对/161 产品类型)。
- **图生代码**:image-to-code、imagegen-frontend-web、imagegen-frontend-mobile。
- **GSAP 动画系(9 个官方 skill)**:gsap-core / -react / -frameworks / -timeline / -scrolltrigger / -plugins / -performance / -utils。
- **设计流程(gstack)**:design-consultation、design-html、design-review、design-shotgun、plan-design-review。
- **redesign-existing-projects / scroll-world / setup-deploy / setup-gbrain / sync-gbrain**。

### 4.5 装箱/物流业务(我的工作主线)★

- ★ **3d-packing-master** — 三维装箱(3D-BPP/CLP)技术选型顾问,诊断式提问定位问题,基于 24 个已核验开源库给 ranked 选型。
- ★ **diagnose-packing-issues** — 业务问"为什么 A 箱装不下/为什么用了 B 箱"时定位。
- ★ **packing-app-prod-issue-query** — 按订单号查包装生产状态、诊断打包异常、追规则与 RPC 调用链(只读)。
- ★ **packing-smart-diagnose** — 一站式:订单号 → 数据获取(CDBI+OSS)→ 装箱诊断报告(只读)。
- ★ **starbucks-replenishment** — 星巴克 ARP 补货模型知识库((R,S)模型/newsvendor/ABC-XYZ/安全库存/BCP/KPI)。

### 4.6 建模与规划

- ★ **domain-dive** — 4 阶段 DDD 领域建模追问,嵌 5 条 DDD 规则+领域配置(供应链/仓网)。
- ★ **planning-with-files-zh** — Manus 风格文件规划系统(task_plan.md / findings.md / progress.md),支持 /clear 后会话恢复。

### 4.7 其他工具型

- **full-output-enforcement** — 覆盖默认截断,强制完整代码生成、禁占位符。
- **stop-slop-main** — 去除 AI 写作味。
- **learn / skillify / skill-creator** — 项目学习记录 / 把东西固化成 skill。
- **codex / connect-chrome / open-gstack-browser / ios-\*(clean/qa/sync/fix/design-review)** — Codex CLI 包装 / 浏览器 / iOS 工具链。
- **agent-reach / agently-mail** — 邮件命令行操作。

---

## 5. Hooks 与自动化

`settings.json` 里挂了**二十多个 Hook**,把会话生命周期的每个事件焊到外部工具。这是我「无人值守跑长任务」的关键:

| 事件 | Hook 做什么 |
|---|---|
| **SessionStart** | gstack 会话更新、agentmemory recall 注入最近记忆、cbm-session-reminder(代码图谱提醒)、jcode 热键、Otty 状态、Agent-Monitor 上报 |
| **UserPromptSubmit** | Agent-Monitor / Otty / orca 上报当前状态 |
| **PreToolUse** | pixtuoid-hook、**cbm-code-discovery-gate**(Grep/Glob 前强制先走代码图谱)、Agent-Monitor |
| **PostToolUse** | pixtuoid、Agent-Monitor、Otty processing |
| **Notification** | **terminal-notifier 弹窗**("💬 Claude 需要输入")+ ntfy 推送 |
| **Stop / SessionEnd** | ntfy 推送、**tokentracker token 通知**、Agent-Monitor 收尾 |
| **SubagentStart/Stop** | orca / Agent-Monitor 上报 |

外部集成对象:
- **ntfy** — 任务完成/需要输入时手机推送(`~/.claude/hooks/ntfy-notify.sh`)。
- **Otty / orca** — 终端 agent GUI 的状态同步。
- **Agent-Monitor**(`Claude-Code-Agent-Monitor/scripts/hook-handler.js`)— 自建的会话监控面板。
- **pixtuoid-hook** — 旁路统计/审计。
- **tokentracker** — token 用量追踪与会话结束通知。

---

## 6. 自建基础设施(不在插件/MCP 里,但同等重要)

### 6.1 Exa 搜索(`~/.claude/webtool.py`)★
- CLAUDE.md **禁用内置 WebSearch/WebFetch**,统一走 Exa(`exa-py`)。
- 全局脚本:`python3 ~/.claude/webtool.py search "q" N [dom1,dom2]` / `deep` / `fetch "url"` / `fresh`。
- 密钥读 `~/.exa_key`(chmod 600,跨项目共用,不进 repo)。

### 6.2 image-reader 子 agent(识图)★
- 主模型 GLM-5.2 **不识图**。CLAUDE.md 硬性规定:凡涉及看图,派 `subagent_type=image-reader`(跑 Sonnet=MiniMax-M3)去看图返回文字,主 agent 只收文字结论。
- 回退:若该 agent 异常,改用 haiku(豆包)再派一个只读识图子 agent。

### 6.3 agentmemory 跨会话记忆 ★
- MCP 工具 `mcp__agentmemory__*`,数据落 `~/.agentmemory/`。
- SessionStart hook `~/.claude/hooks/agentmemory-recall` 自动注入最近 12 条记忆。
- 会话收尾走「回顾→有效→弯路→提炼→分类→写入」,全局经验存 `project:global`,项目专属存对应 project。

### 6.4 执行 pipeline(顺序固定)
每个实质任务:`思考(karpathy 假设+可验证目标) → 写码(ponytail 最小 diff) → 子agent 审查(主 agent 禁自审) → 测试(run-until-pass) → 如实报结论 → 复盘(agentmemory)`。

### 6.5 其他自建/配置
- **statusLine** — orca 状态栏脚本。
- **agents/** — 自定义子 agent(image-reader / reviewer / Explore / Plan 等)。
- **plugins/marketplaces** — 13 个订阅源,可随时拉新插件。

---

## 7. 我日常最常用的 Top 10

如果只看高频,就是这些:

1. **agentmemory** — 跨会话记忆复利
2. **Exa webtool** — 一切联网搜索
3. **image-reader 子 agent** — 识图(主模型不识图)
4. **research-to-pdf / deep-research** — 调研出报告
5. **agent-reach** — 全网社媒/平台调研
6. **ponytail + karpathy-guidelines** — 写码守最小 diff
7. **superpowers(brainstorming / systematic-debugging)** — 创作前先想、bug 先定位根因
8. **3d-packing-master / packing-smart-diagnose** — 装箱工作主线
9. **tech-report / make-pdf / ppt-master** — 文档/报告/PPT 产出
10. **ship / review** — 发版与审查

---

## 8. 复制这套配置的最小路径

想复刻我这套,按优先级:

1. 装 superpowers + ponytail + i-have-adhd + karpathy-skills 四个插件,拿到工程纪律骨架。
2. 配 Exa(`~/.exa_key` + `webtool.py`),替换内置搜索。
3. 装 agentmemory MCP,配 SessionStart recall hook,建立跨会话记忆。
4. 走自建模型网关接入国产模型(或直接用官方 API)。
5. 按工作领域加 skill:前端 → frontend-design + GSAP 系;调研 → agent-reach + deep-research;文档 → tech-report + ppt-master + kami。
6. 最后按需加 Hook(ntfy 推送 + Agent-Monitor 监控),把长任务变无人值守。

> 完整配置文件:`~/.claude/settings.json`、`~/.claude/CLAUDE.md`、`~/.claude/.mcp.json`、`~/.claude/plugins/installed_plugins.json`。
