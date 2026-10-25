window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-session-title-fix",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/index.tsx
		/** @dsh-external/dsh-session-title-fix — 客户端设置页（占用 plugins.bundle.config 席位）。 */
		const inject = ["slots"];
		const API = "/session-title-fix/api";
		const PLUGIN_ID = "@dsh-external/dsh-session-title-fix";
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
`;
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
代价：改的是 npm 包产物，dsh 升级/重装即失效，需要重新打补丁。`;
		async function call(path, init) {
			const res = await fetch(API + path, init);
			const text = await res.text();
			try {
				return JSON.parse(text);
			} catch {
				throw new Error(res.ok ? "返回不是 JSON" : `HTTP ${res.status}：${text.slice(0, 120)}`);
			}
		}
		function Panel() {
			const [state, setState] = (0, react.useState)({});
			const [route, setRoute] = (0, react.useState)(true);
			const [budget, setBudget] = (0, react.useState)(true);
			const [source, setSource] = (0, react.useState)("");
			const [maxOutputTokens, setMax] = (0, react.useState)(1024);
			const [timeoutMs, setTimeoutMs] = (0, react.useState)(6e4);
			const [status, setStatus] = (0, react.useState)({
				text: "",
				kind: ""
			});
			const [busy, setBusy] = (0, react.useState)(false);
			const load = async () => {
				try {
					const next = await call("/state");
					setState(next);
					const usable = (next.providers ?? []).filter((p) => !p.name.endsWith("-title"));
					const savedSource = next.saved?.source;
					setSource((current) => current || (savedSource && usable.some((p) => p.name === savedSource) ? savedSource : usable[0]?.name ?? ""));
					if (next.mode) {
						setRoute(next.mode.includes("a"));
						setBudget(next.mode.includes("b"));
					}
					if (typeof next.saved?.maxOutputTokens === "number") setMax(next.saved.maxOutputTokens);
					if (typeof next.saved?.timeoutMs === "number") setTimeoutMs(next.saved.timeoutMs);
					if (next.error) setStatus({
						text: next.error,
						kind: "err"
					});
				} catch (cause) {
					setStatus({
						text: `读取失败：${cause.message}`,
						kind: "err"
					});
				}
			};
			(0, react.useEffect)(() => {
				load();
			}, []);
			const usable = (0, react.useMemo)(() => (state.providers ?? []).filter((p) => !p.name.endsWith("-title")), [state.providers]);
			const currentModel = (0, react.useMemo)(() => {
				const provider = state.titleConfig?.provider;
				const model = state.titleConfig?.model;
				return provider ? `${provider} / ${model ?? "?"}` : "—";
			}, [state.titleConfig]);
			const apply = async () => {
				setBusy(true);
				setStatus({
					text: "应用中…",
					kind: ""
				});
				try {
					const chosen = `${route ? "a" : ""}${budget ? "b" : ""}` || "off";
					const body = chosen === "off" ? { mode: "off" } : {
						mode: chosen,
						...route ? { source } : {},
						...budget ? {
							maxOutputTokens,
							timeoutMs
						} : {}
					};
					const next = await call("/apply", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify(body)
					});
					if (next.error) throw new Error(next.error);
					setState(next);
					setStatus({
						text: chosen === "off" ? "已全部关闭：标题配置回快照" : `已应用（${chosen.toUpperCase()}）：标题请求即刻按新配置发出`,
						kind: "ok"
					});
				} catch (cause) {
					setStatus({
						text: `应用失败：${cause.message}`,
						kind: "err"
					});
				} finally {
					setBusy(false);
				}
			};
			const reset = async () => {
				setBusy(true);
				setStatus({
					text: "还原中…",
					kind: ""
				});
				try {
					const next = await call("/reset", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: "{}"
					});
					if (next.error) throw new Error(next.error);
					setState(next);
					setStatus({
						text: "已还原（派生路由已删除，标题配置回到快照）",
						kind: "ok"
					});
				} catch (cause) {
					setStatus({
						text: `还原失败：${cause.message}`,
						kind: "err"
					});
				} finally {
					setBusy(false);
				}
			};
			const refresh = async () => {
				setBusy(true);
				setStatus({
					text: "刷新中…",
					kind: ""
				});
				try {
					const next = await call("/refresh", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: "{}"
					});
					if (next.error) throw new Error(next.error);
					setState(next);
					const note = next.replay?.note ?? "";
					setStatus({
						text: `已刷新本实例${note ? "：" + note : ""}`,
						kind: next.applied === false ? "err" : "ok"
					});
				} catch (cause) {
					setStatus({
						text: `刷新失败：${cause.message}`,
						kind: "err"
					});
				} finally {
					setBusy(false);
				}
			};
			const derivedName = source ? `${source}-title` : "<provider>-title";
			const direct = usable.find((provider) => provider.name === source)?.derivable === false;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "tsf",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("style", { children: styles }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: "会话标题生成修复" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "desc",
						children: "第三方模型标题回退首句：思考吃光 maxOutputTokens 预算。A/B 可**同时启用**（A 管参数、B 管兜底预算）。点「应用」即时生效（会重启被改的插件，正在生成的回复可能中断）。"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: route ? "plan picked" : "plan",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "tag",
								children: "A"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "body",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: "标题专用路由禁思考" }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "hint",
										children: direct ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
											"该适配器已对标题自动关思考：标题直接使用 ",
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: source }),
											"，不派生路由"
										] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
											"派生 ",
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: derivedName }),
											"：标题请求发 ",
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("code", { children: [
												"thinking:",
												"{",
												"type:disabled",
												"}"
											] }),
											"，主对话路由不动"
										] })
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "params",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", { children: "源 provider" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
											value: source,
											onChange: (event) => setSource(event.target.value),
											children: [usable.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "",
												children: "（无可用 provider）"
											}) : null, usable.map((provider) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
												value: provider.name,
												children: [
													provider.name,
													"（",
													provider.displayName,
													provider.derivable === false ? " · 直连" : " · 派生",
													"）"
												]
											}, provider.name))]
										})]
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: route ? "btn on" : "btn",
								onClick: () => setRoute(!route),
								children: route ? "A 已启用" : "启用 A"
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: budget ? "plan picked" : "plan",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "tag",
								children: "B"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "body",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: "放大标题预算" }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "hint",
										children: "给「禁不掉思考」的网关兜底：思考吃掉预算但余量足够仍能出标题。上限不是开销，实际只按产出计费"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "params",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", { children: "maxOutputTokens" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												type: "number",
												min: 1,
												value: maxOutputTokens,
												onChange: (event) => setMax(Number(event.target.value))
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", { children: "timeoutMs" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												type: "number",
												min: 1,
												value: timeoutMs,
												onChange: (event) => setTimeoutMs(Number(event.target.value))
											})
										]
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: budget ? "btn on" : "btn",
								onClick: () => setBudget(!budget),
								children: budget ? "B 已启用" : "启用 B"
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "plan",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "tag",
								children: "C"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "body",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: "源码级修复（仅教程）" }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "hint",
										children: "改 npm 包产物，升级即失效；保存则本插件不参与，仅展示做法"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", { children: SOURCE_TUTORIAL })
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "btn",
								disabled: true,
								title: "源码方案不可由本插件启用",
								children: "不可启用"
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "actions",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "btn primary",
								onClick: apply,
								disabled: busy || route && !source,
								children: "应用"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "btn",
								onClick: refresh,
								disabled: busy,
								children: "刷新"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "btn",
								onClick: reset,
								disabled: busy,
								children: "还原"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: status.kind === "err" ? "status err" : status.kind === "ok" ? "status ok" : "status",
								children: status.text
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "now",
						children: [
							"本实例：",
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: state.applied === void 0 ? "未知" : state.applied ? "已应用" : "未应用（点刷新拉到保存的选择）" }),
							"标题路由 ",
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: currentModel }),
							"　maxOutputTokens ",
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: String(state.titleConfig?.maxOutputTokens ?? "—") }),
							"　timeoutMs ",
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: String(state.titleConfig?.timeoutMs ?? "—") }),
							(state.derived ?? []).length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: ["　派生路由 ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: (state.derived ?? []).join(", ") })] }) : null
						]
					})
				]
			});
		}
		function apply(ctx) {
			ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
				name: "plugins.bundle.config",
				key: PLUGIN_ID
			}, Panel));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
