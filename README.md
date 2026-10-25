# dsh-session-title-fix

DSH 会话标题生成修复插件。侧栏「插件」页 → 本插件 bundle 详情 → 配置区（`plugins.bundle.config` 席位）。

## 问题

第三方模型（`llm-pi-ai` 路由）的标题请求不带任何思考参数，64 token 的 `maxOutputTokens` 被 `reasoning_content` 吃光，`finish=length` 且正文为空 ⇒ `session-title-llm` 抛 `reached maxOutputTokens` ⇒ 标题永远停在 fallback（首句截断）。
官方 `dsh-llm-deepseek` 有 `purpose === 'session-title'` 强制关思考的分支，`dsh-llm-pi-ai` 没有。

## 三种处置

| 方案 | 做法 | 代价 |
|---|---|---|
| **A（推荐）** | 源 provider 任意可选（含**官方模型**）：pi-ai 路由派生 `<provider>-title`（模型加 `reasoningEfforts{off:null,low,medium,high}`，`api` 为 `openai-completions` 时再加 `compat.thinkingFormat: deepseek`）；官方等适配器已自带标题关思考，**直连**不派生。把 `session-title-llm` 指过去 | 禁思考生效时零额外 token；主对话路由不动 |
| **B** | 只改 `session-title-llm` 的 `maxOutputTokens` / `timeoutMs`。**A/B 可同时启用**（`ab`）：A 管参数、B 管兜底预算 | 上限不是开销（按实际产出计费）；禁不掉思考的网关靠它出标题 |
| **C** | 源码级：改 `dsh-llm-pi-ai` 的 `streamWithSnapshot` 加 `purpose` 分支 | **本插件不可启用**，仅展示教程；改的是 npm 包产物，升级即失效 |

## 安装

作为 bundle 装进目标 profile（`dsh.profile.bundles` 出现本包名后，插件页才有本 bundle 的配置区）：

```powershell
dsh plugin --profile <profile> add link:C:/Users/53518/dsh-plugins/dsh-session-title-fix
```

安装后需重启该实例。**安装与运行都需重启**；配置项的应用不需要。

## 运行时行为

- 应用 = `loader.update('llm-pi-ai'|'session-title-llm', {config})`，被改条目 fiber 重启，**立即生效、无需重启实例**；正在生成的回复可能中断。
- 选择存 `$DSH_HOME/session-title-fix.json`；`cordis.yml` 是只读 patch 树（运行时改动不跨重启），因此**启动后 5 秒与 12 秒各重放一次**（幂等；启动早期会被 patch 层打回，第二次兜底校验）。`GET /state` 的 `replay` 字段给出重放结果。
- A 的候选路由来自 `ctx.llm.listProviders()`：pi-ai 路由可派生（`derivable=true`），官方等适配器走直连（`derivable=false`，不派生）。
- **同名 `<source>-title` 已存在时不覆盖**：只接受「每个模型都带 `reasoningEfforts`」的形态，否则 `POST /apply` 返回 500 并说明原因。
- 归属只判一次并记进 `snapshot.providerRoutes`：`created` = 本插件新建（`还原` 会删）、`keep` = 装前就有（`还原` 保留）；被快照标题配置引用的派生路由也保留。
- 选择存在 `$DSH_HOME/session-title-fix.json`，**所有实例共用**：在 A 实例改、B 实例只读到选择不动运行态。界面底部显示「本实例：已应用/未应用」，点**刷新**即可把本实例拉平（等价于手动重放）。
- `还原` 把标题配置回快照，并只删 `created` 的派生路由。
- B 参数上界：`maxOutputTokens ≤ 65536`、`timeoutMs ≤ 2147483647`；越界直接 500，不写文件。

## 判据

| 现象 | 含义 |
|---|---|
| `GET /session-title-fix/api/state` 的 `error` 非空 | loader 条目解析失败（id 变更） |
| 会话日志 `session/title` 出现 `source.kind = provider` | 标题由模型概括（成功） |
| 只有 `kind = fallback` | 标题失败（回退首句） |
| `kind = user` | 用户手动改名，非 LLM 成功 |

## HTTP API（同源）

| 方法 路径 | 作用 |
|---|---|
| `GET /session-title-fix/api/state` | 运行态、可选 provider/模型、保存的选择 |
| `GET /session-title-fix/api/route?name=<provider>` | 读某 provider 的原始声明（验证 A 写入的 `reasoningEfforts`/`compat`） |
| `GET /session-title-fix/api/entries` | 当前 loader 条目 id 列表（排查 id 变更） |
| `POST /session-title-fix/api/apply` | `{mode:'a'|'b'|'ab'|'off', source?, maxOutputTokens?, timeoutMs?}`；`a` 用 64/60000，`b` 只改预算，`ab` 两者合并写入，`off` 等同 reset |
| `POST /session-title-fix/api/refresh` | 把**本实例**运行态拉到与保存的选择一致（幂等，等价于手动重放）；返回最新 state |
| `POST /session-title-fix/api/reset` | 标题配置回快照；只删本插件新建的派生路由 |

## 构建与测试

```powershell
npm install
npx tsc -p tsconfig.json     # host → lib/index.js
npx tsdown                   # client → lib/client.js
node tests/client-contract.mjs
```

## 边界

1. 禁不掉思考的网关（如 `dots3-note-prev` 忽略 `thinking` 参数）A 无效，只能靠 B 给足预算。
2. `maxOutputTokens` 是全局配置，A 下写 64 即可；B 下建议 ≥1024（`qwen3.8-flash` 实测思考 295–549 token）。
3. 切主模型到别的 provider 时，标题路由不自动跟随，需在配置区重新选一次源 provider。
4. `neohorse-1-9b` / `NeoHorse-Jev-4B` 在本机为灰度限制（HTTP 403 `MODEL_ACCESS_DENIED`），与标题无关。
