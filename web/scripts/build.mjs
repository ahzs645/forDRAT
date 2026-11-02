import { spawnSync } from 'node:child_process'
import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const web = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = resolve(web, '..')
const output = resolve(root, 'docs')
const compiler = resolve(web, 'node_modules/typescript/bin/tsc')

await rm(output, { recursive: true, force: true })
await mkdir(resolve(output, 'js'), { recursive: true })
const compile = spawnSync(process.execPath, [
  compiler,
  resolve(web, 'src/published.ts'),
  '--target', 'ES2022',
  '--module', 'ES2022',
  '--moduleResolution', 'bundler',
  '--lib', 'ES2022,DOM',
  '--strict',
  '--skipLibCheck',
  '--noEmitOnError',
  '--rootDir', resolve(web, 'src'),
  '--outDir', resolve(output, 'js'),
  '--pretty', 'false',
], { cwd: web, stdio: 'inherit' })
if (compile.error) throw compile.error
if (compile.status !== 0) process.exit(compile.status ?? 1)

for (const file of ['index.html', 'app.mjs', 'style.css']) {
  await cp(resolve(web, 'static', file), resolve(output, file))
}
const data = resolve(output, 'data/forest-drought')
await mkdir(data, { recursive: true })
await cp(resolve(root, 'data/forDrat.csv'), resolve(data, 'fordrat.csv'))
await cp(resolve(root, 'LICENSE.md'), resolve(data, 'LICENSE-fordrat.md'))
await cp(resolve(web, 'static/manifest.json'), resolve(data, 'manifest.json'))
await cp(resolve(web, 'static/NOTICE.md'), resolve(data, 'NOTICE.md'))
await writeFile(resolve(output, '.nojekyll'), '')
console.log('Built docs/: static browser app, compiled TypeScript, pinned source data and attribution.')
