// client 契约测试：模拟 __ModuleLoader__ 加载 lib/client.js，断言 slot 注册参数正确。
// node tests/client-contract.mjs
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const code = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
const PKG = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

let exported
const sandbox = {
  window: {
    __ModuleLoader__: {
      load: ({ id, factory }) => {
        if (id !== PKG.name) throw new Error(`banner id 应为包名，实为 ${id}`)
        exported = factory((spec) => require(spec))
      },
    },
  },
  module: { exports: {} },
  exports: {},
  console,
  process: { env: { NODE_ENV: 'production' } },
  setTimeout,
  clearTimeout,
}
sandbox.globalThis = sandbox
vm.createContext(sandbox)
vm.runInContext(code, sandbox, { filename: 'client.js' })

const failures = []
const check = (name, ok, detail) => { if (!ok) failures.push(`${name}${detail ? '：' + detail : ''}`) }

check('factory 返回 exports', !!exported)
check('导出 apply', typeof exported?.apply === 'function')
check('导出 inject 含 slots', Array.isArray(exported?.inject) && exported.inject.includes('slots'))

let captured
const ctx = {
  slots: {
    inject: (name, run) => { if (name !== 'plugins.bundle.config') failures.push('inject 的 slot 名不是 plugins.bundle.config'); run() },
    register: (options, component) => { captured = { options, component }; return () => {} },
  },
}
exported.apply(ctx)

check('register 的 name', captured?.options?.name === 'plugins.bundle.config', String(captured?.options?.name))
check('register 的 key 为包名', captured?.options?.key === PKG.name, String(captured?.options?.key))
check('组件是函数', typeof captured?.component === 'function')

if (failures.length) {
  console.log('FAIL\n- ' + failures.join('\n- '))
  process.exit(1)
}
console.log('PASS client contract: apply/inject/slot 注册全部符合契约')
