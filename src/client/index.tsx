/** @dsh-external/dsh-session-title-fix — 客户端设置页（占用 plugins.bundle.config 席位）。 */
import { useEffect, useMemo, useState, type ReactElement } from 'react'
import type { SlotsService } from '@deepseek-ai/dsh-client-ui-slots'

type ClientContext = { slots: SlotsService }

export const inject = ['slots']

const API = '/session-title-fix/api'
const PLUGIN_ID = '@dsh-external/dsh-session-title-fix'

interface Provider { name: string; displayName: string; models: string[]; derivable?: boolean }
interface State {
  ok?: boolean
  mode?: 'off' | 'a' | 'b' | 'ab'
  providers?: Provider[]
  titleConfig?: { provider?: string; model?: string; maxOutputTokens?: number; timeoutMs?: number }
  derived?: string[]
  applied?: boolean
  saved?: { source?: string; maxOutputTokens?: number; timeoutMs?: number }
  error?: string
}

const styles = `
.tsf{font-size:14px;line-height:1.55;padding:12px 14px;max-width:820px;color:var(--dsw-alias-label-primary)}
.tsf h3{margin:0 0 4px;font-size:15px}
.tsf .desc{color:var(--dsw-alias-label-secondary);font-size:12px;margin:0 0 10px}
.tsf .plan{display:flex;align-items:flex-start;gap:8px;padding:7px 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);margin-bottom:6px}
.tsf .plan.picked{border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 1px var(--dsw-alias-state-business-primary) inset}
.tsf .tag{flex:0 0 auto;width:18px;height:18px;border-radius:4px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-brand-primary);font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;margin-top:1px}
.tsf .body{flex:1 1 auto;min-width:0}
.tsf .body b{font-size:13px;font-weight:600}
.tsf .hint{display:block;font-size:12px;color:var(--dsw-alias-label-tertiary);margin-top:1px}
.tsf .params{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:5px}
.tsf .params label{font-size:12px;color:var(--dsw-alias-label-secondary)}
.tsf select,.tsf input{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:5px;padding:3px 6px;font-size:12px;font-family:inherit}
.tsf input[type=number]{width:76px}
.tsf .btn{flex:0 0 auto;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);border-radius:5px;padding:4px 10px;font-size:12px;cursor:pointer;font-family:inherit}
.tsf .btn.on{background:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-label-primary-foreground)}
.tsf .btn:disabled{opacity:.45;cursor:not-allowed}
.tsf .btn.primary{background:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-label-primary-foreground);font-weight:600}
.tsf .actions{display:flex;align-items:center;gap:6px;margin:10px 0 6px;flex-wrap:wrap}
.tsf .status{font-size:12px;color:var(--dsw-alias-label-tertiary)}
.tsf .status.err{color:var(--dsw-alias-state-error-primary)}
.tsf .status.ok{color:var(--dsw-alias-state-success-primary)}
.tsf code{font-family:var(--ds-font-family-code);font-size:12px;color:var(--dsw-alias-brand-primary)}
.tsf pre{margin:5px 0 0;padding:7px 8px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;font-size:11.5px;line-height:1.5;overflow:auto;white-space:pre-wrap;color:var(--dsw-alias-label-secondary)}
.tsf .now{font-size:12px;color:var(--dsw-alias-label-tertiary);margin-top:8px}
`

const SOURCE_TUTORIAL = `文件：C:\\dsh-runtime\\0.2.0-rc.2\\node_modules\\@deepseek-ai\\dsh-llm-pi-ai\\lib\\index.js
位置：PiAiAdapter.streamWithSnapshot，约第 1851 行

把
  const reasoning = resolveReasoningLevel(model, options.reasoningEffort ?? profile.reasoning);
改成
  const forceOff = options.purpose === 'session-title';
  const titled = forceOff ? { ...model, reasoning: true, thinkingLevelMap: { ...(model.thinkingLevelMap ?? {}), off: 'none' } } : model;
  const reasoning = resolveReasoningLevel(titled, forceOff ? 'off' : (options.reasoningEffort ?? profile.reasoning));

前提：该 provider 的模型必须声明 compat.thinkingFormat（deepseek / qwen / openrouter），
否则 pi-ai 在 "off" 下只是「省略思考参数」，网关仍会思考。
代价：改的是 npm 包产物，dsh 升级/重装即失效，需要重新打补丁。`

async function call(path: string, init?: RequestInit): Promise<State & { error?: string }> {
  const res = await fetch(API + path, init)
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(res.ok ? '返回不是 JSON' : `HTTP ${res.status}：${text.slice(0, 120)}`)
  }
}

function Panel(): ReactElement {
  const [state, setState] = useState<State>({})
  const [route, setRoute] = useState(true)
  const [budget, setBudget] = useState(true)
  const [source, setSource] = useState('')
  const [maxOutputTokens, setMax] = useState(1024)
  const [timeoutMs, setTimeoutMs] = useState(60000)
  const [status, setStatus] = useState<{ text: string; kind: 'ok' | 'err' | '' }>({ text: '', kind: '' })
  const [busy, setBusy] = useState(false)

  const load = async (): Promise<void> => {
    try {
      const next = await call('/state')
      setState(next)
      const usable = (next.providers ?? []).filter((p) => !p.name.endsWith('-title'))
      const savedSource = next.saved?.source
      setSource((current) => current || (savedSource && usable.some((p) => p.name === savedSource) ? savedSource : usable[0]?.name ?? ''))
      if (next.mode) {
        setRoute(next.mode.includes('a'))
        setBudget(next.mode.includes('b'))
      }
      if (typeof next.saved?.maxOutputTokens === 'number') setMax(next.saved.maxOutputTokens)
      if (typeof next.saved?.timeoutMs === 'number') setTimeoutMs(next.saved.timeoutMs)
      if (next.error) setStatus({ text: next.error, kind: 'err' })
    } catch (cause) {
      setStatus({ text: `读取失败：${(cause as Error).message}`, kind: 'err' })
    }
  }

  useEffect(() => { void load() }, [])

  const usable = useMemo(() => (state.providers ?? []).filter((p) => !p.name.endsWith('-title')), [state.providers])
  const currentModel = useMemo(() => {
    const provider = state.titleConfig?.provider
    const model = state.titleConfig?.model
    return provider ? `${provider} / ${model ?? '?'}` : '—'
  }, [state.titleConfig])

  const apply = async (): Promise<void> => {
    setBusy(true)
    setStatus({ text: '应用中…', kind: '' })
    try {
      const chosen = `${route ? 'a' : ''}${budget ? 'b' : ''}` || 'off'
      const body = chosen === 'off'
        ? { mode: 'off' }
        : { mode: chosen, ...(route ? { source } : {}), ...(budget ? { maxOutputTokens, timeoutMs } : {}) }
      const next = await call('/apply', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      if (next.error) throw new Error(next.error)
      setState(next)
      setStatus({ text: chosen === 'off' ? '已全部关闭：标题配置回快照' : `已应用（${chosen.toUpperCase()}）：标题请求即刻按新配置发出`, kind: 'ok' })
    } catch (cause) {
      setStatus({ text: `应用失败：${(cause as Error).message}`, kind: 'err' })
    } finally {
      setBusy(false)
    }
  }

  const reset = async (): Promise<void> => {
    setBusy(true)
    setStatus({ text: '还原中…', kind: '' })
    try {
      const next = await call('/reset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      if (next.error) throw new Error(next.error)
      setState(next)
      setStatus({ text: '已还原（派生路由已删除，标题配置回到快照）', kind: 'ok' })
    } catch (cause) {
      setStatus({ text: `还原失败：${(cause as Error).message}`, kind: 'err' })
    } finally {
      setBusy(false)
    }
  }

  const refresh = async (): Promise<void> => {
    setBusy(true)
    setStatus({ text: '刷新中…', kind: '' })
    try {
      const next = await call('/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      if (next.error) throw new Error(next.error)
      setState(next)
      const note = next.replay?.note ?? ''
      setStatus({ text: `已刷新本实例${note ? '：' + note : ''}`, kind: next.applied === false ? 'err' : 'ok' })
    } catch (cause) {
      setStatus({ text: `刷新失败：${(cause as Error).message}`, kind: 'err' })
    } finally {
      setBusy(false)
    }
  }

  const derivedName = source ? `${source}-title` : '<provider>-title'
  const picked = usable.find((provider) => provider.name === source)
  const direct = picked?.derivable === false

  return (
    <div className="tsf">
      <style>{styles}</style>
      <h3>会话标题生成修复</h3>
      <p className="desc">第三方模型标题回退首句：思考吃光 maxOutputTokens 预算。A/B 可**同时启用**（A 管参数、B 管兜底预算）。点「应用」即时生效（会重启被改的插件，正在生成的回复可能中断）。</p>

      <div className={route ? 'plan picked' : 'plan'}>
        <span className="tag">A</span>
        <div className="body">
          <b>标题专用路由禁思考</b>
          <span className="hint">
            {direct
              ? <>该适配器已对标题自动关思考：标题直接使用 <code>{source}</code>，不派生路由</>
              : <>派生 <code>{derivedName}</code>：标题请求发 <code>thinking:{'{'}type:disabled{'}'}</code>，主对话路由不动</>}
          </span>
          <div className="params">
            <label>源 provider</label>
            <select value={source} onChange={(event) => setSource(event.target.value)}>
              {usable.length === 0 ? <option value="">（无可用 provider）</option> : null}
              {usable.map((provider) => (
                <option key={provider.name} value={provider.name}>
                  {provider.name}（{provider.displayName}{provider.derivable === false ? ' · 直连' : ' · 派生'}）
                </option>
              ))}
            </select>
          </div>
        </div>
        <button type="button" className={route ? 'btn on' : 'btn'} onClick={() => setRoute(!route)}>{route ? 'A 已启用' : '启用 A'}</button>
      </div>

      <div className={budget ? 'plan picked' : 'plan'}>
        <span className="tag">B</span>
        <div className="body">
          <b>放大标题预算</b>
          <span className="hint">给「禁不掉思考」的网关兜底：思考吃掉预算但余量足够仍能出标题。上限不是开销，实际只按产出计费</span>
          <div className="params">
            <label>maxOutputTokens</label>
            <input type="number" min={1} value={maxOutputTokens} onChange={(event) => setMax(Number(event.target.value))} />
            <label>timeoutMs</label>
            <input type="number" min={1} value={timeoutMs} onChange={(event) => setTimeoutMs(Number(event.target.value))} />
          </div>
        </div>
        <button type="button" className={budget ? 'btn on' : 'btn'} onClick={() => setBudget(!budget)}>{budget ? 'B 已启用' : '启用 B'}</button>
      </div>

      <div className="plan">
        <span className="tag">C</span>
        <div className="body">
          <b>源码级修复（仅教程）</b>
          <span className="hint">改 npm 包产物，升级即失效；保存则本插件不参与，仅展示做法</span>
          <pre>{SOURCE_TUTORIAL}</pre>
        </div>
        <button type="button" className="btn" disabled title="源码方案不可由本插件启用">不可启用</button>
      </div>

      <div className="actions">
        <button type="button" className="btn primary" onClick={apply} disabled={busy || (route && !source)}>应用</button>
        <button type="button" className="btn" onClick={refresh} disabled={busy}>刷新</button>
        <button type="button" className="btn" onClick={reset} disabled={busy}>还原</button>
        <span className={status.kind === 'err' ? 'status err' : status.kind === 'ok' ? 'status ok' : 'status'}>{status.text}</span>
      </div>

      <div className="now">
        本实例：<code>{state.applied === undefined ? '未知' : state.applied ? '已应用' : '未应用（点刷新拉到保存的选择）'}</code>
        　标题路由 <code>{currentModel}</code>　maxOutputTokens <code>{String(state.titleConfig?.maxOutputTokens ?? '—')}</code>　timeoutMs <code>{String(state.titleConfig?.timeoutMs ?? '—')}</code>
        {(state.derived ?? []).length > 0 ? <>　派生路由 <code>{(state.derived ?? []).join(', ')}</code></> : null}
      </div>
    </div>
  )
}

export function apply(ctx: ClientContext): void {
  ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
    name: 'plugins.bundle.config',
    key: PLUGIN_ID,
  }, Panel))
}
