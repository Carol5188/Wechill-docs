# Codex 工作区总索引

更新时间：2026-06-26

这个文件用于让 Codex 快速理解当前工作区，不再每次从线程历史里重新拼上下文。开始新任务时，建议先让 Codex 读取本文件，再读取对应模块的 `PROJECT_INDEX.md`。

## 当前工作区

| 模块 | 索引 | 当前定位 |
|---|---|---|
| 幸运礼物 | [幸运礼物/PROJECT_INDEX.md](幸运礼物/PROJECT_INDEX.md) | 幸运礼物玩法、共享奖池、RTP、后台配置原型 |
| 游戏房 | [游戏房/PROJECT_INDEX.md](游戏房/PROJECT_INDEX.md) | 三方休闲游戏接入、房间内调起、客户端/后台原型 |
| 公会 | [公会/PROJECT_INDEX.md](公会/PROJECT_INDEX.md) | 公会薪资、结算、提现账户、本期盈余、数据看板 |
| 风控 | [风控/PROJECT_INDEX.md](风控/PROJECT_INDEX.md) | 设备/充值/账号封禁、用户分类、风控后台 |
| 红包 | [红包/PROJECT_INDEX.md](红包/PROJECT_INDEX.md) | 红包返奖、风控、领取记录、配置后台 |

其他目录：`龙蛋/`、`首充活动/`、`签到活动/`、`归档/`、`outputs/`、`wechill-prd-diagrams/`。

## 旧路径兼容

历史工作目录 `/Users/xinyintiaodong/Documents/New project` 已收口为指向当前工作区的软链接：

```text
/Users/xinyintiaodong/Documents/New project -> /Users/xinyintiaodong/Documents/幸运礼物
```

旧目录中的有效文件已与当前工作区做内容级去重；旧相对路径若在当前工作区没有同名位置，已补软链接指向当前归档位置。以后 Codex 旧卡片指向 `New project/...` 时，应自动落到当前工作区，不再继续维护旧目录副本。

迁移记录见 [Codex工作流/旧目录迁移去重报告-20260627.md](Codex工作流/旧目录迁移去重报告-20260627.md)。

## 推荐工作流

1. 先读总索引和模块索引。
2. 确认本次任务属于哪条产物线：`PRD评审版`、`HTML原型`、`多语言文案`、`QA评审补漏`、`归档同步`。
3. 复杂任务默认使用子代理并行评审，主线程只做裁决和合并。
4. 交付前使用 [Codex工作流/05-QA评审清单.md](Codex工作流/05-QA评审清单.md)。
5. 新产物按 [Codex工作流/07-命名与版本收口规范.md](Codex工作流/07-命名与版本收口规范.md) 命名。

## 常用模板

| 模板 | 用途 |
|---|---|
| [Codex工作流/01-项目索引模板.md](Codex工作流/01-项目索引模板.md) | 新模块建立 `PROJECT_INDEX.md` |
| [Codex工作流/02-PRD评审版模板.md](Codex工作流/02-PRD评审版模板.md) | 生成可评审 PRD |
| [Codex工作流/03-HTML原型任务模板.md](Codex工作流/03-HTML原型任务模板.md) | 生成或优化 HTML 原型 |
| [Codex工作流/04-多语言与弹窗文案模板.md](Codex工作流/04-多语言与弹窗文案模板.md) | 拆文案、弹窗、Toast、多语言 |
| [Codex工作流/05-QA评审清单.md](Codex工作流/05-QA评审清单.md) | 交付前查漏 |
| [Codex工作流/06-子代理并行分工.md](Codex工作流/06-子代理并行分工.md) | 复杂任务分派给子代理 |
| [Codex工作流/07-命名与版本收口规范.md](Codex工作流/07-命名与版本收口规范.md) | 文件命名、版本、current 收口 |
| [Codex工作流/08-agent-memory模板.md](Codex工作流/08-agent-memory模板.md) | 沉淀 Codex 下次必须记住的口径 |

## 给 Codex 的启动提示

```text
先读 PROJECT_INDEX.md 和本模块 PROJECT_INDEX.md。
本次任务属于【PRD评审版 / HTML原型 / 多语言文案 / QA评审补漏 / 归档同步】。
请先识别当前版文件和 agent-memory，不要误改历史版本；复杂规则请启动子代理做产品/研发/风控/财务/文案评审。
交付前按 Codex工作流/05-QA评审清单.md 自检。
```
