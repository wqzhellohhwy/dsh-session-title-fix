# CHANGELOG

> 面向 agent：只记现状与可执行操作。新改动追加在最上方；改了什么、怎么验证、边界在哪。

## 0.2.2 — 2026-10-20 23:10

新增「刷新」按钮，解决**跨实例共享选择**造成的「看起来改了、其实没改」。

### 行为变更

- host 新增 `POST /refresh`：执行一次 `replay()`（幂等），把**本实例**运行态拉到与 `$DSH_HOME/session-title-fix.json` 一致，然后返回最新 state。
- `GET /state` 新增 `applied`：本实例运行态是否已满足保存的选择（判定抽成 `appliedState()`，与 `replay()` 共用，避免两处逻辑漂移）。
- client：`应用 / 刷新 / 还原` 三按钮；底部显示「本实例：已应用 / 未应用（点刷新拉到保存的选择）」。

### 为什么需要

`saved` 文件在 `$DSH_HOME` 下**全实例共用**，但运行时是每实例独立的：在 experiment 点应用只改 experiment 的运行时，backup 只读到「选择」而运行态不变，界面却显示已选 ab ⇒ 用户以为改成功了。

### 验证（experiment 3084）

- `apply {a,dots}` → `applied=true`、`titleConfig={dots-title,64,60000}`。
- 伪造另一实例写 `saved={ab,dots,4096}` → `GET /state` 报 `applied=false`。
- `POST /refresh` → `applied=true`、`maxOutputTokens` 拉到 4096、`replay.note="A+B 已重投"`。
- `tsc --noEmit`、`node --check`、`client-contract.mjs` PASS。

### 已知残留（未修，已记 backlog）

在 profile 的 patch **没有** `session-title-llm` 段时（如 experiment），`reset` 删不掉运行时新建的派生路由（`derived` 仍列出），而 `apply` 的正常写入有效；patch 有该段的 profile（backup/tsf-lab）上 `reset` 正常。
## 0.2.1 — 2026-10-18 21:25

第七轮核实修复 2 项（均次要）。

### 行为变更

- **非法 `mode` 不再静默降级**：`normalizeMode()` 只接受 `a`/`b`/`ab`/`off`，其它值（`'A'`、`'a,b'`、缺省、null）一律 `HTTP 500` 并回报收到的值——此前会被当成 `off` 直接执行破坏性还原。读盘仍用宽松的 `storedMode()`（文件损坏视为 `off`）。
- **派生路径两写加回滚**：先写 `llm-pi-ai`（建路由）再写 `session-title-llm`；后者失败时撤掉刚建的路由并抛错。若回滚本身也失败，把 `providerRoutes[名]='created'` 写进保存文件，保证 `reset` 仍能清理，不产生孤儿路由。

### 验证（experiment 3084）

- `POST /apply {"mode":"A","source":"dots"}` → `HTTP 500 {"error":"mode 必须是 a / b / ab / off 之一，收到 \"A\""}`；随后 `GET /state` 仍为 `mode=ab`、`dots-title`、`2048/90000`（未被还原）。
- `{"mode":"off"}` → `off`；`{"mode":"ab",dots,2048,90000}` → 正常生效。
- `tsc --noEmit`、`node --check`、`client-contract.mjs` PASS。

## 0.2.0 — 2026-10-18 21:10

**A 与 B 不再互斥，可同时启用**（`mode: 'a' | 'b' | 'ab' | 'off'`）。

### 行为变更

- `applyMode` 按开关组合执行：`route = mode.includes('a')`、`budget = mode.includes('b')`。
  - `a`：派生/直连标题路由，预算固定 64/60000。
  - `b`：只改 `maxOutputTokens`/`timeoutMs`，不动 provider/model。
  - `ab`：路由 + 自定义预算，**一次 update 写进同一条目**（只重启标题 fiber 一次）。
  - `off`：等同 `reset`。
- `replay()` 按组合逐项校验（预算比对 + 路由形态/直连 provider），全一致才跳过；日志 `replay.note` 为 `A/B/A+B 已一致|已重投`。
- client：A、B 各一个独立开关按钮（颜色反馈，无勾选框），默认都开；`应用` 提交组合，两个都关即提交 `off`。

### 为什么需要 A+B

「路由」只是带上 `thinking:{type:disabled}`，**参数生效与否由网关决定**。禁不掉思考的网关（实测 `dots3-note-prev`）在 64/1024 下仍被吃光，必须靠预算兜底：

| dots @预算（thinking 被忽略，照常思考） | 结果 |
|---|---|
| 1024 | `finish=length`、正文空 ❌ |
| 2048 | `finish=stop`、正文「排查第三方模型标题生成失败原因」✅（18.8s） |
| 4096 | 同上 ✅（11.2s） |

### 验证（experiment 3084，逐次重启）

- `apply {ab, dots, 2048, 90000}` → `titleConfig={provider:"dots-title",model:"dots3-note-prev",2048,90000}`、`derived=["dots-title"]`。
- `apply {a, dots}` → 预算回 `64/60000`，provider 仍 `dots-title`。
- `apply {b, 512, 30000}` → 预算变 `512/30000`，provider 不动。
- 重启 → `replay.note="A+B 已一致"`（已生效则跳过）。
- `node tests/client-contract.mjs` PASS；`tsc --noEmit` PASS。

## 0.1.5 — 2026-10-18 20:05

第五轮核实修复 4 项（均次要）。

### 行为变更

- `piProvidersOf()` 返回 `{providers, ok, error}`：区分「条目缺失」与「条目存在但配置不可读」。后者时：`applyMode` 只放行运行时 `listProviders()` 确实存在的 provider（否则 500 并报原因）；`GET /state` 新增 `warning` 字段说明该情况。`/route` 也改用它，不再 500。
- 重放定时器用 `child.effect` 包裹（卸载即 `clearTimeout`），并在 **5s 与 12s 各投一次**（幂等）：首次兜 patch 覆盖，第二次兜首次被覆盖。依赖降为 `['loader','llm']`（不再要求 `webServer`，headless/tui/sdk profile 也能重放）。
- `replay()` 在投递前重读保存文件，`mode`/`source` 与开头读到的不同则跳过（避免 5 秒窗口内覆盖用户手动更改），并记 `replay.note='选择已被手动改动，跳过重放'`。

### 验证（experiment 3084）

- `apply {a, dots}` → `dots-title`；重启 → `derived=["dots-title"]`、title 指向它、`replay.note="派生已一致"`（首次已重投，第二次校验一致）。
- `reset` → `mode=off`、`derived=[]`。
- `GET /state` → `providers=3`、`warning` 与 `error` 均为空。
- `tsc --noEmit`、`node --check lib/index.js`、`client-contract.mjs` PASS。

## 0.1.4 — 2026-10-18 19:40

第四轮核实修复 2 项（1 严重 1 次要）+ 一处实测才暴露的启动时序缺陷。

### 行为变更

- `readSaved()` 读回 `direct`（此前写盘但读不回，重启后直连选择静默失效）。
- 新增 `piProvidersOf(loader)`：`llm-pi-ai` 条目缺失时返回空对象，不再让官方模型的列表与直连整体 500；`stateOf` 里重复读条目的问题一并消除（现在二次应用/列举只读一次）。
- **重放时机**：`ctx.inject(['loader','llm','webServer'], …)` + `setTimeout 5000`。启动早期 patch 层仍会覆盖运行时改动，过早重投会被打回；`replay()` 开头还 `await loader.await?.()` 等条目加载完。
- `GET /state` 新增 `replay` 字段（`{at, note|error}`）：`a 已重投`/`b 已重投`/`直连已一致`/`派生已一致`/`off`/错误原因，用于判断启动重放到底发生了什么。

### 验证（experiment 实例 3084，逐次重启）

- 直连：`apply {a, deepseek-official}` → 保存 `direct:true`；重启 → `titleConfig={provider:"deepseek-official",model:"deepseek-flash",64,60000}`、`replay.note="a 已重投"`。
- 派生：`apply {a, dots}` → `dots-title`（`created`）；重启 → `derived=["dots-title"]`、title 指向它、`reasoningEfforts{off:null,low,medium,high}` 仍在。
- `reset` → `mode=off`、`derived=[]`、`GET /route?name=dots-title` → `null`。
- 列表：`GET /state` → `dots derivable=true`、`deepseek-official/deepseek-account derivable=false`。

## 0.1.3 — 2026-10-18 19:05

A 方案的候选路由改为「全部 LLM provider」，**不再排除官方模型**。

### 行为变更

- `stateOf()` 改 async：用 `ctx.llm.listProviders()` + `ctx.llm.listModels(provider)` 枚举，返回项新增 `derivable`（`true` = pi-ai 路由，可派生 `<name>-title`；`false` = 其它适配器，直连）。`llm` 服务不可用时回退 pi-ai 配置。
- A 分两条路径：
  - `derivable=true`（pi-ai）：派生 `<source>-title` 并声明 `reasoningEfforts`（+ `openai-completions` 时 `compat.thinkingFormat`），标题指向派生路由。
  - `derivable=false`（官方等）：自身已对标题关思考，**直接**把标题指向 `source/model`，不派生路由；`saved.direct = true`。
- `replay()` 增加 direct 分支：direct 模式下只比对 `titleConfig.provider === saved.source`；非 direct 仍校验派生路由形态。
- `reset()` 对 direct 无需删路由（`derivedNames` 为空），只恢复标题配置。
- 文件头注释说明「候选取自 `ctx.llm.listProviders()`，含官方适配器，官方走直连」。
- client：`select` 选项标注「· 派生 / · 直连」；选直连 provider 时 hint 改为「该适配器已对标题自动关思考：标题直接使用 x，不派生路由」。

### 验证（experiment 实例 3084，已重启加载 0.1.3）

- `GET /state` → `dots derivable=true`、`deepseek-official derivable=false models=deepseek-flash,deepseek-v4-pro`、`deepseek-account derivable=false`。
- `POST /apply {a, deepseek-official}` → `titleConfig={provider:"deepseek-official", model:"deepseek-flash", 64, 60000}`，`saved.direct=true`，`derived=[]`。
- `POST /apply {a, dots}` → 生成 `dots-title`，其模型带 `reasoningEfforts{off:null,low,medium,high}` + `compat{thinkingFormat:"deepseek"}`，`titleConfig` 指向它。
- `POST /reset` → `mode=off`、`derived=[]`、titleConfig 回 `{64,60000}`。
- `node tests/client-contract.mjs` PASS。

## 0.1.2 — 2026-10-18 18:40

第二轮核实修复 3 项（1 严重 2 次要）。

### 行为变更

- **派生路由归属只判一次**：`mark = snapshot.providerRoutes[名] ?? (原本存在 ? 'keep' : 'created')`。二次应用同一源不再把自己新建的记成 `keep`，`还原` 因此能删掉它。
- `isDerivedShape()` 判定放宽为「每个模型都有 `reasoningEfforts`」：`compat` 只在 `provider.api === 'openai-completions'` 时注入，不再作为派生形态的判据（否则非 completions 协议建出的路由会被判非派生、二次应用与启动重放全部失效）。
- `README.md` 同步 0.1.1/0.1.2 行为（keep 规则、已存在非派生形态 → 500、参数上界）。

### 验证（临时 profile `tsf-lab`，patch 里派生路由与 session-title-llm 段已清空）

- 首次 `apply a tokenrhythm181` → `providerRoutes={"tokenrhythm181-title":"created"}`，title 64/60000。
- 二次 `apply a tokenrhythm181` → 仍 `created`（旧版会变 keep）。
- `reset` → `derived=[]`，`GET /route?name=tokenrhythm181-title` 返回 `route=null`（路由确实删掉），title 配置回快照。
- `npx tsc --noEmit`、`node tests/client-contract.mjs` PASS。

## 0.1.1 — 2026-10-18 18:20

核实后修复 8 项（1 严重 7 次要）。

### 行为变更（必须知道）

- **同名派生路由已存在时不覆盖**：只接受「每个模型都带 `reasoningEfforts` + `compat.thinkingFormat`」的形态，否则 `POST /apply` 返回 500 并说明原因（`isDerivedShape`）。避免把别人的手写配置覆盖掉。
- **reset 区分 created / keep**：`saved.snapshot.providerRoutes[名] = 'keep'` 的派生路由**不删**（它原本就存在）；只有本插件新建的才删；被 `snapshot.titleConfig.provider` 引用的也保留。
- `saved.derivedNames` 累积去重（换源后旧派生名仍可被 reset 处理）。
- `replay()` 除比对 provider 名，还校验该派生路由的声明形态；不一致才重投。
- B 参数上界：`maxOutputTokens ≤ 65536`、`timeoutMs ≤ 2147483647`（后者是 `MAX_TIMER_DELAY_MS`，超出会让目标条目配置解析失败）；越界直接 500，不写文件。
- `compat.thinkingFormat` 只在 `provider.api === 'openai-completions'` 时注入（其它协议不接受该字段）。
- 主题化：前景色改 `--dsw-alias-label-primary-foreground`，等宽字体改 `--ds-font-family-code`，无硬编码颜色/字体。
- host 注释压到文件头 3 行 + 关键函数 1 行。

### 验证（临时 profile `tsf-lab`，web 19399）

- `POST /apply {mode:'b',timeoutMs:3000000000}` → `HTTP 500 {"error":"timeoutMs 必须是 1..2147483647 的整数"}`。
- `POST /apply {mode:'b',256,90000}` → titleConfig 立即 256/90000。
- `POST /apply {mode:'a',source:'tokenrhythm181'}`（该派生已由 patch 层存在）→ 复用不覆盖，`saved.snapshot.providerRoutes = {"tokenrhythm181-title":"keep"}`，titleConfig 64/60000。
- `POST /reset` → 保留 `tokenrhythm181-title`（keep），titleConfig 回 1024/120000。
- `node tests/client-contract.mjs` PASS。

## 0.1.0 — 2026-10-18 17:55

**新增**：`@dsh-external/dsh-session-title-fix` 插件（host + client 双侧）。

### 结构

| 文件 | 作用 |
|---|---|
| `src/index.ts` | host：`loader.update()` 投射 A/B 方案、HTTP API、保存选择、启动重放 |
| `src/client/index.tsx` | client：占用 `plugins.bundle.config`（keyed，key=包名），三方案 UI |
| `lib/index.js` | tsc 产物（ESM，无运行时依赖） |
| `lib/client.js` | tsdown 产物（CJS module-loader 包，banner id=包名） |
| `tests/client-contract.mjs` | 模拟 `__ModuleLoader__` 断言 apply/inject/slot 注册参数 |

### 可执行操作

```powershell
npm install
npx tsc -p tsconfig.json
npx tsdown
node tests/client-contract.mjs   # 必须 PASS
```

安装（bundle 装配，需重启实例）：
```powershell
dsh plugin --profile <profile> add link:C:/Users/53518/dsh-plugins/dsh-session-title-fix
```

### 关键实现约束

- loader 条目 id 在 store 里带组前缀（`include:llm-pi-ai`）；`resolveId()` 先试短 id，再试 `:*` 唯一后缀，否则报候选清单。
- `loader.update()` 改的是运行时实例，`cordis.yml` 是只读 patch 树 ⇒ 改动不跨重启，`replay()` 在启动时按保存值重投一次（状态已一致则跳过）。
- `reset()` 跳过被 `snapshot.titleConfig.provider` 引用的派生路由，避免标题指向不存在的 provider。
- C（源码级）方案按钮 `disabled`，只渲染教程文本。

### 已验证（临时 profile `tsf-lab`，web 实例 19399）

- `GET /state` 200，列出 4 源 provider + 4 派生路由与当前 titleConfig。
- `POST /apply {mode:'b',128,90000}` → titleConfig 立即变 128/90000。
- 重启实例 → 启动重放把 128/90000 重新投上（patch 层给的是 1024/120000）。
- `POST /apply {mode:'a',source:'tokenrhythm181'}` → 生成 `tokenrhythm181-title`，`GET /route` 显示模型带 `reasoningEfforts{off:null,low,medium,high}` + `compat{thinkingFormat:'deepseek'}`，titleConfig 指向它、64/60000。
- `POST /reset` → 删掉 `tokenrhythm181-title`，保留快照引用的 `tokenrhythm133-title`，titleConfig 回 1024/120000。
- `node tests/client-contract.mjs` PASS。

### 未做

- 插件页 UI 未做浏览器目视验证（web 实例的 CDP 只暴露 host 进程，无页面 target）。
- 未装进任何正式 profile（backup/desktop 均未改）。
