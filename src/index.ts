/**
 * 会话标题生成修复（host）。三种处置：A 标题路由禁思考 / B 放大预算 / C 源码级（仅教程，不实现）。
 * A 的可选路由来自 ctx.llm.listProviders()，**含官方适配器**：pi-ai 路由派生 `<provider>-title` 并声明思考能力
 * （无 effort 时发 thinking:disabled）；官方等其它适配器自身已对标题关思考，直接指向（direct，不派生）。
 * 生效：loader.update(id, {config}) 改目标条目，fiber 重启即生效；选择存 $DSH_HOME/session-title-fix.json，启动时重放。
 * HTTP：GET state|route|entries，POST apply|reset，前缀 /session-title-fix/api。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'

export const name = '@dsh-external/dsh-session-title-fix'
export const inject: string[] = []

type Mode = 'off' | 'a' | 'b' | 'ab'

interface Saved {
  mode: Mode
  source?: string
  direct?: boolean
  maxOutputTokens?: number
  timeoutMs?: number
  derivedNames?: string[]
  snapshot?: {
    titleConfig?: Record<string, unknown>
    providerRoutes?: Record<string, 'created' | 'keep'>
  }
}

interface LoaderLike {
  resolve(id: string): { options?: { config?: Record<string, any> } }
  update(id: string, options: { config?: Record<string, unknown> }): Promise<void>
  entries(): Generator<{ id: string }, void, void>
  await?(): Promise<void>
}

type AppContext = {
  get?: (name: string) => unknown
  inject?: (deps: string[], run: (child: AppContext) => void) => void
  effect?: (run: () => (() => void) | void) => void
}

const EFFORTS = { off: null, low: 'low', medium: 'medium', high: 'high' }
const THINKING_FORMAT = { thinkingFormat: 'deepseek' }
const TITLE_ENTRY = 'session-title-llm'
const LLM_ENTRY = 'llm-pi-ai'
const MAX_TIMEOUT_MS = 2147483647
const MAX_OUTPUT_TOKENS = 65536

let replayStatus: { at: number; note?: string; error?: string } | undefined

function storePath(): string {
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  return join(home, 'session-title-fix.json')
}

function readSaved(): Saved {
  try {
    const raw = JSON.parse(readFileSync(storePath(), 'utf8'))
    const mode: Mode = storedMode(raw?.mode)
    return { mode, source: raw?.source, direct: raw?.direct === true, maxOutputTokens: raw?.maxOutputTokens, timeoutMs: raw?.timeoutMs, derivedNames: raw?.derivedNames, snapshot: raw?.snapshot }
  } catch {
    return { mode: 'off' }
  }
}

function writeSaved(saved: Saved): void {
  mkdirSync(dirname(storePath()), { recursive: true })
  writeFileSync(storePath(), JSON.stringify(saved, null, 2), 'utf8')
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function loaderOf(ctx: AppContext): LoaderLike {
  const loader = ctx.get?.('loader') as LoaderLike | undefined
  if (!loader || typeof loader.resolve !== 'function' || typeof loader.update !== 'function') throw new Error('loader 服务不可用')
  return loader
}

function entryIds(loader: LoaderLike): string[] {
  const ids: string[] = []
  for (const entry of loader.entries()) ids.push(entry.id)
  return ids
}

/** patch 层用短 id，loader store 用组内全 id（`include:llm-pi-ai`）。 */
function resolveId(loader: LoaderLike, want: string): string {
  const ids = entryIds(loader)
  if (ids.includes(want)) return want
  const tails = ids.filter((id) => id.endsWith(`:${want}`))
  if (tails.length === 1) return tails[0]
  throw new Error(`找不到条目 ${want}（候选：${tails.join(', ') || '无'}）`)
}

function entryConfig(loader: LoaderLike, want: string): Record<string, any> {
  const config = loader.resolve(resolveId(loader, want))?.options?.config
  if (!config || typeof config !== 'object') throw new Error(`条目 ${want} 没有可读的 config`)
  return config
}

/** llm-pi-ai 的路由。`ok=false` 表示条目存在但配置不可读（与「profile 没装该条目」区分开）。 */
function piProvidersOf(loader: LoaderLike): { providers: Record<string, any>; ok: boolean; error?: string } {
  try {
    const config = entryConfig(loader, LLM_ENTRY)
    return { providers: isRecord(config.providers) ? config.providers : {}, ok: true }
  } catch (cause) {
    return { providers: {}, ok: false, error: (cause as Error)?.message ?? String(cause) }
  }
}

/** 派生路由形态：每个模型都声明了 reasoningEfforts（compat 仅在 openai-completions 协议下注入，不作条件）。 */
function isDerivedShape(route: unknown): boolean {
  if (!isRecord(route) || !Array.isArray(route.models) || route.models.length === 0) return false
  return route.models.every((model: any) => isRecord(model?.reasoningEfforts))
}

function deriveProvider(base: Record<string, any>, source: string): Record<string, any> {
  const completions = base.api === 'openai-completions'
  return {
    ...base,
    displayName: `${String(base.displayName ?? source)}（标题专用·禁思考）`,
    models: (Array.isArray(base.models) ? base.models : []).map((model: any) => ({
      ...model,
      reasoningEfforts: { ...EFFORTS },
      ...completions ? { compat: { ...(isRecord(model?.compat) ? model.compat : {}), ...THINKING_FORMAT } } : {},
    })),
  }
}

function snapshotOf(loader: LoaderLike, saved: Saved): Saved {
  if (saved.snapshot?.titleConfig) return saved
  const titleConfig = entryConfig(loader, TITLE_ENTRY)
  return { ...saved, snapshot: { ...(saved.snapshot ?? {}), titleConfig: JSON.parse(JSON.stringify(titleConfig)) } }
}

function positiveInteger(value: unknown, name: string, max: number): number {
  const number = Number(value)
  if (!Number.isInteger(number) || number < 1 || number > max) throw new Error(`${name} 必须是 1..${max} 的整数`)
  return number
}

/** `mode` 是 A/B 的开关组合：`a` 路由、`b` 预算、`ab` 两者同时、`off` 全关。 */
function normalizeMode(value: unknown): Mode {
  if (value === 'a' || value === 'b' || value === 'ab' || value === 'off') return value
  throw new Error(`mode 必须是 a / b / ab / off 之一，收到 ${JSON.stringify(value ?? null)}`)
}

/** 读盘用的宽松解析：文件损坏或旧值一律视为 off（不能在这里抛）。 */
function storedMode(value: unknown): Mode {
  return value === 'a' || value === 'b' || value === 'ab' ? value : 'off'
}

/** A/B 独立开关，可同时启用：路由负责参数、预算负责兜底，互不排斥。 */
async function applyMode(ctx: AppContext, body: Record<string, any>): Promise<Saved> {
  const mode = normalizeMode(body?.mode)
  if (mode === 'off') return resetAll(ctx, readSaved())

  const route = mode.includes('a')
  const budget = mode.includes('b')
  const loader = loaderOf(ctx)
  let saved = snapshotOf(loader, readSaved())

  const titleConfig = entryConfig(loader, TITLE_ENTRY)
  const maxOutputTokens = budget ? positiveInteger(body?.maxOutputTokens, 'maxOutputTokens', MAX_OUTPUT_TOKENS) : 64
  const timeoutMs = budget ? positiveInteger(body?.timeoutMs, 'timeoutMs', MAX_TIMEOUT_MS) : 60000
  // 预算与路由写进同一次 update：只重启标题条目一次。
  const titleNext: Record<string, any> = { ...titleConfig, maxOutputTokens, timeoutMs }

  if (!route) {
    await loader.update(resolveId(loader, TITLE_ENTRY), { config: titleNext })
    const next: Saved = { ...saved, mode: 'b', maxOutputTokens, timeoutMs }
    writeSaved(next)
    return next
  }

  const source = String(body?.source ?? '')
  const pi = piProvidersOf(loader)
  const providers = pi.providers
  if (source.endsWith('-title')) throw new Error(`"${source}" 是派生路由，请选择原始 provider`)
  // pi-ai 配置不可读时无法区分「官方路由」与「pi-ai 路由」：只放行运行时确实存在的 provider。
  if (!pi.ok && !llmOf(ctx)?.listProviders().some((info) => info.id === source)) {
    throw new Error(`llm-pi-ai 配置不可读（${pi.error ?? '未知原因'}），无法确认 provider "${source}"`)
  }

  // 非 pi-ai 路由（官方等其它适配器）：自身已对标题关思考，直接指向，不派生路由。
  if (!isRecord(providers[source])) {
    const models = await modelsOf(ctx, source, providers)
    if (models.length === 0) throw new Error(`provider "${source}" 不存在或没有可用模型`)
    const model = typeof titleConfig.model === 'string' && models.includes(titleConfig.model) ? titleConfig.model : models[0]
    await loader.update(resolveId(loader, TITLE_ENTRY), { config: { ...titleNext, provider: source, model } })
    const next: Saved = { ...saved, mode, source, direct: true, maxOutputTokens, timeoutMs }
    writeSaved(next)
    return next
  }

  const derivedName = `${source}-title`
  const llmConfig = entryConfig(loader, LLM_ENTRY)
  const existing = providers[derivedName]
  // 同名路由已存在：只接受带 reasoningEfforts 的派生形态，避免覆盖别人的手写配置。
  if (existing !== undefined && !isDerivedShape(existing)) {
    throw new Error(`路由 ${derivedName} 已存在且不是派生形态（模型缺 reasoningEfforts）；先处理它再应用`)
  }
  // 归属只判一次：已记录过就沿用，否则按「原本是否存在」定性，避免二次应用把自己建的记成 keep。
  const mark: 'created' | 'keep' = saved.snapshot?.providerRoutes?.[derivedName] ?? (existing === undefined ? 'created' : 'keep')

  const base = providers[source]
  const models = Array.isArray(base.models) ? base.models : []
  const model = typeof titleConfig.model === 'string' && models.some((item: any) => item?.id === titleConfig.model) ? titleConfig.model : models[0]?.id
  if (typeof model !== 'string') throw new Error(`provider "${source}" 没有可用模型`)

  const derivedNames = [...new Set([...(saved.derivedNames ?? []), derivedName])]
  const created = existing === undefined
  const routeSnapshot = { ...(saved.snapshot?.providerRoutes ?? {}), [derivedName]: mark }
  if (created) {
    await loader.update(resolveId(loader, LLM_ENTRY), { config: { ...llmConfig, providers: { ...providers, [derivedName]: deriveProvider(base, source) } } })
  }
  try {
    await loader.update(resolveId(loader, TITLE_ENTRY), { config: { ...titleNext, provider: derivedName, model } })
  } catch (cause) {
    // 标题写失败：撤掉刚建的路由，避免留下没人认领的孤儿路由。
    if (created) {
      try {
        await loader.update(resolveId(loader, LLM_ENTRY), { config: { ...llmConfig, providers } })
      } catch {
        writeSaved({ ...saved, derivedNames, snapshot: { ...(saved.snapshot ?? {}), providerRoutes: routeSnapshot } })
      }
    }
    throw cause
  }

  const next: Saved = {
    ...saved,
    mode,
    source,
    direct: false,
    derivedNames,
    maxOutputTokens,
    timeoutMs,
    snapshot: { ...(saved.snapshot ?? {}), providerRoutes: routeSnapshot },
  }
  writeSaved(next)
  return next
}

/** 还原：删本插件新建的派生路由、标题配置回快照；被快照引用或已存在的路由保留。 */
async function resetAll(ctx: AppContext, saved: Saved): Promise<Saved> {
  const loader = loaderOf(ctx)
  const kept = saved.snapshot?.providerRoutes ?? {}
  const referenced = isRecord(saved.snapshot?.titleConfig) ? String(saved.snapshot.titleConfig.provider ?? '') : ''
  const removable = (saved.derivedNames ?? []).filter((key) => key.endsWith('-title') && kept[key] !== 'keep' && key !== referenced)

  if (removable.length > 0) {
    const llmConfig = entryConfig(loader, LLM_ENTRY)
    const providers = isRecord(llmConfig.providers) ? { ...llmConfig.providers } : {}
    let touched = false
    for (const key of removable) {
      if (!(key in providers)) continue
      delete providers[key]
      touched = true
    }
    if (touched) await loader.update(resolveId(loader, LLM_ENTRY), { config: { ...llmConfig, providers } })
  }

  const snapshotTitle = saved.snapshot?.titleConfig
  if (isRecord(snapshotTitle)) await loader.update(resolveId(loader, TITLE_ENTRY), { config: { ...snapshotTitle } })

  const next: Saved = { mode: 'off' }
  writeSaved(next)
  return next
}

/** 本实例运行态是否已满足保存的选择（replay 与界面共用同一判定）。 */
function appliedState(loader: LoaderLike, saved: Saved): { applied: boolean; label: string } {
  const label = saved.mode.includes('a') && saved.mode.includes('b') ? 'A+B' : saved.mode.includes('a') ? 'A' : saved.mode.includes('b') ? 'B' : 'off'
  if (saved.mode === 'off') return { applied: true, label }
  const titleConfig = entryConfig(loader, TITLE_ENTRY)
  let applied = true
  if (saved.mode.includes('b') && (titleConfig.maxOutputTokens !== saved.maxOutputTokens || titleConfig.timeoutMs !== saved.timeoutMs)) applied = false
  if (saved.mode.includes('a')) {
    if (!saved.source) applied = false
    else if (saved.direct === true) {
      if (titleConfig.provider !== saved.source) applied = false
    } else {
      const want = `${saved.source}-title`
      if (titleConfig.provider !== want || !isDerivedShape(piProvidersOf(loader).providers[want])) applied = false
    }
  }
  return { applied, label }
}

/** 启动重放：运行时改动不跨重启（cordis.yml 是只读 patch 树）；运行态已符合则跳过。 */
async function replay(ctx: AppContext): Promise<void> {
  const saved = readSaved()
  if (saved.mode === 'off') {
    replayStatus = { at: Date.now(), note: 'off' }
    return
  }
  try {
    const loader = loaderOf(ctx)
    // inject 只保证服务存在，条目的 config 可能还没加载完。
    const wait = (loader as { await?: () => Promise<void> }).await
    if (typeof wait === 'function') await wait.call(loader)
  } catch {
    // 等待失败仍然尝试一次。
  }
  try {
    const loader = loaderOf(ctx)
    // 与手动 apply 竞争：投递前重读，盘上已被改过就放弃（否则会用旧值覆盖用户新选择）。
    const latest = readSaved()
    if (latest.mode !== saved.mode || latest.source !== saved.source) {
      replayStatus = { at: Date.now(), note: '选择已被手动改动，跳过重放' }
      return
    }
    const { applied, label } = appliedState(loader, saved)
    if (applied) {
      replayStatus = { at: Date.now(), note: `${label} 已一致` }
      return
    }
    await applyMode(ctx, { mode: saved.mode, source: saved.source, maxOutputTokens: saved.maxOutputTokens, timeoutMs: saved.timeoutMs })
    replayStatus = { at: Date.now(), note: `${label} 已重投` }
  } catch (cause) {
    replayStatus = { at: Date.now(), error: (cause as Error)?.message ?? String(cause) }
  }
}

type LlmLike = {
  listProviders(): Array<{ id: string; name: string }>
  listModels(provider: string): Promise<Array<{ id: string; name: string }>>
}

function llmOf(ctx: AppContext): LlmLike | undefined {
  const llm = ctx.get?.('llm') as LlmLike | undefined
  return llm && typeof llm.listProviders === 'function' && typeof llm.listModels === 'function' ? llm : undefined
}

/** 某 provider 的可选模型：优先运行时列举（覆盖官方适配器），无果时回退 pi-ai 配置。 */
async function modelsOf(ctx: AppContext, provider: string, piProviders: Record<string, any>): Promise<string[]> {
  const llm = llmOf(ctx)
  if (llm) {
    try {
      if (llm.listProviders().some((info) => info.id === provider)) {
        const models = (await llm.listModels(provider)).map((model) => String(model.id))
        if (models.length > 0) return models
      }
    } catch {
      // 列举失败回退配置值。
    }
  }
  const configured = piProviders[provider]
  return Array.isArray(configured?.models) ? configured.models.map((model: any) => String(model?.id ?? '')) : []
}

async function stateOf(ctx: AppContext): Promise<Record<string, unknown>> {
  const saved = readSaved()
  let providers: Array<{ name: string; displayName: string; models: string[]; derivable: boolean }> = []
  let titleConfig: Record<string, unknown> = {}
  let applied: boolean | undefined
  let error: string | undefined
  let warning: string | undefined
  try {
    const loader = loaderOf(ctx)
    const pi = piProvidersOf(loader)
    const piProviders = pi.providers
    if (!pi.ok) warning = `llm-pi-ai 配置不可读：${pi.error ?? '未知原因'}（pi-ai 路由会判为直连，A 可能不派生）`
    const llm = llmOf(ctx)
    const seen = new Set<string>()
    if (llm) {
      for (const info of llm.listProviders()) {
        seen.add(info.id)
        const models = await modelsOf(ctx, info.id, piProviders)
        providers.push({ name: info.id, displayName: info.name, models, derivable: isRecord(piProviders[info.id]) })
      }
    }
    for (const key of Object.keys(piProviders)) {
      if (seen.has(key)) continue
      providers.push({
        name: key,
        displayName: String(piProviders[key]?.displayName ?? key),
        models: Array.isArray(piProviders[key]?.models) ? piProviders[key].models.map((model: any) => String(model?.id ?? '')) : [],
        derivable: true,
      })
    }
    titleConfig = entryConfig(loader, TITLE_ENTRY)
    applied = appliedState(loader, saved).applied
  } catch (cause) {
    error = (cause as Error)?.message ?? String(cause)
  }
  return {
    ok: true,
    mode: saved.mode,
    saved,
    providers,
    applied,
    titleConfig: {
      provider: titleConfig.provider,
      model: titleConfig.model,
      maxOutputTokens: titleConfig.maxOutputTokens,
      timeoutMs: titleConfig.timeoutMs,
    },
    derived: providers.filter((provider) => provider.name.endsWith('-title')).map((provider) => provider.name),
    replay: replayStatus,
    error,
    warning,
  }
}

function json(res: any, status: number, value: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(value))
}

async function readBody(req: any): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

export function apply(ctx: AppContext): void {
  const run = (child: AppContext): void => {
    const webServer = child.get?.('webServer') as
      | { register(route: { kind: 'prefix'; path: string; handler: (req: any, res: any) => unknown }): () => void }
      | undefined
    if (!webServer) return
    const register = () => webServer.register({
      kind: 'prefix',
      path: '/session-title-fix/api',
      handler: async (req: any, res: any) => {
        try {
          const url = new URL(req.url ?? '/', 'http://localhost')
          const path = url.pathname.replace(/^\/session-title-fix\/api/, '') || '/'
          const method = String(req.method ?? 'GET').toUpperCase()
          if (method === 'GET' && path === '/state') return json(res, 200, await stateOf(ctx))
          if (method === 'GET' && path === '/entries') {
            const loader = loaderOf(ctx)
            return json(res, 200, { ok: true, entries: entryIds(loader) })
          }
          if (method === 'GET' && path === '/route') {
            const providers = piProvidersOf(loaderOf(ctx)).providers
            const wanted = url.searchParams.get('name') ?? ''
            return json(res, 200, { ok: true, name: wanted, route: isRecord(providers[wanted]) ? providers[wanted] : null })
          }
          if (method === 'POST' && path === '/refresh') {
            // 手动刷新：把本实例运行态拉到与保存的选择一致（幂等）。
            await replay(ctx)
            return json(res, 200, await stateOf(ctx))
          }
          if (method === 'POST' && path === '/apply') {
            const saved = await applyMode(ctx, JSON.parse((await readBody(req)) || '{}'))
            return json(res, 200, { ...(await stateOf(ctx)), saved })
          }
          if (method === 'POST' && path === '/reset') {
            const saved = await resetAll(ctx, readSaved())
            return json(res, 200, { ...(await stateOf(ctx)), saved })
          }
          return json(res, 404, { ok: false, error: `未知路由 ${method} ${path}` })
        } catch (cause) {
          return json(res, 500, { ok: false, error: (cause as Error)?.message ?? String(cause) })
        }
      },
    })
    if (typeof child.effect === 'function') child.effect(register)
    else register()
  }

  if (typeof ctx.inject === 'function') {
    // 两次延时重放（幂等）：启动早期 patch 层仍会覆盖运行时改动，第二次兜底校验。
    ctx.inject(['loader', 'llm'], (child) => {
      const run = (): void => {
        if (typeof child.effect === 'function') {
          child.effect(() => {
            const timers = [setTimeout(() => { void replay(child) }, 5000), setTimeout(() => { void replay(child) }, 12000)]
            return () => { for (const timer of timers) clearTimeout(timer) }
          })
        } else {
          setTimeout(() => { void replay(child) }, 5000)
        }
      }
      run()
    })
    ctx.inject(['webServer'], run)
  } else {
    run(ctx)
  }
}
