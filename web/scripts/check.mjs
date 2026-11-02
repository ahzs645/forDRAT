import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const web = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = resolve(web, '..')
const output = resolve(root, 'docs')
const builtModule = await readFile(resolve(output, 'js/published.js'), 'utf8')
const api = await import(`data:text/javascript;base64,${Buffer.from(builtModule).toString('base64')}`)
const sourceBytes = await readFile(resolve(root, 'data/forDrat.csv'))
const builtBytes = await readFile(resolve(output, 'data/forest-drought/fordrat.csv'))
assert.deepEqual(builtBytes, sourceBytes, 'Build must preserve the exact upstream CSV bytes')
assert.equal(createHash('sha256').update(builtBytes).digest('hex'), api.PUBLISHED_SOURCE.sha256)
assert.equal(createHash('sha1').update(`blob ${builtBytes.length}\0`).update(builtBytes).digest('hex'), api.PUBLISHED_SOURCE.gitBlobSha)
assert.equal(builtBytes.length, 338744)

const source = builtBytes.toString('utf8')
const dataset = api.parsePublishedCsv(source)
assert.equal(dataset.rows.length, 6120)
assert.equal(dataset.bgcUnits.length, 204)
assert.equal(new Set(dataset.rows.map(({ bgc, period, smr }) => `${bgc}|${period}|${smr}`)).size, 6120)
const series = api.publishedSeries(dataset, 'SBSmk1', 1)
assert.deepEqual(series.map(({ period }) => period), ['1961-1990', '1971-2000', '1981-2010', '2020', '2050', '2080'])
assert.deepEqual(series.map(({ aetPet }) => aetPet), [0.900684489, 0.893297542, 0.884785327, 0.847155466, 0.821917801, 0.802222625])
assert.deepEqual(series.map(({ risks }) => risks.Bl), ['M', 'M', 'M', 'H', 'VH', 'VH'])
assert.equal(api.resolvePublishedBgc('SBS mk1', dataset.bgcUnits), null)
assert.equal(api.resolvePublishedBgc('SBSmk', dataset.bgcUnits), null)
assert.equal(api.resolvePublishedBgc(' SBSmk1 ', dataset.bgcUnits), 'SBSmk1')
assert.equal(api.resolvePublishedBgc('SBSwk3a', dataset.bgcUnits), 'SBSwk3a')
assert.equal(api.publishedSeries(dataset, 'missing', 4).length, 0)
assert.deepEqual(api.parsePublishedCsv(api.exportPublishedCsv(dataset.rows)).rows, dataset.rows)
assert.match(api.exportPublishedCsv(series), /SBSmk1,2080,xeric,1,0\.802222625,M,H,L,VH,M,M,L,L,VH,M/)
const lines = source.trimEnd().split('\n')
assert.throws(() => api.parsePublishedCsv([...lines, lines[1]].join('\n')), /duplicate/)
assert.throws(() => api.parsePublishedCsv(lines.slice(0, -1).join('\n')), /incomplete/)
assert.throws(() => api.parsePublishedCsv(source.replace('AET_PET', 'RATIO')), /header/)
assert.throws(() => api.parsePublishedCsv(source.replace(',mesic,4,1,', ',mesic,4,NaN,')), /AET\/PET/)

const manifest = JSON.parse(await readFile(resolve(output, 'data/forest-drought/manifest.json'), 'utf8'))
assert.equal(manifest.source.commit, api.PUBLISHED_SOURCE.commit)
assert.equal(manifest.source.sha256, api.PUBLISHED_SOURCE.sha256)
assert.deepEqual(manifest.species, api.TREE_SPECIES)
assert.deepEqual(manifest.periods, api.PUBLISHED_PERIODS.map(({ id, kind, years }) => ({ id, kind, years })))
assert.equal(manifest.model.becVersion, 11)
assert.equal(manifest.model.reproducedByLegacyCalculator, false)
assert.deepEqual(await readFile(resolve(output, 'data/forest-drought/LICENSE-fordrat.md')), await readFile(resolve(root, 'LICENSE.md')))

for (const asset of ['index.html', 'style.css', 'app.mjs', '.nojekyll', 'data/forest-drought/NOTICE.md']) {
  assert.ok((await stat(resolve(output, asset))).isFile(), `Missing built asset: ${asset}`)
}
const html = await readFile(resolve(output, 'index.html'), 'utf8')
assert.match(html, /id="bgc"[^>]*required[^>]*disabled/)
assert.match(html, /id="soil"[^>]*required[^>]*disabled/)
assert.match(html, /Content-Security-Policy/)
assert.doesNotMatch(html, /<(?:script|link)[^>]+(?:src|href)="https?:\/\//, 'No remote scripts or stylesheets')
assert.doesNotMatch(html, /\son[a-z]+\s*=/i, 'No inline event handlers')
for (const match of html.matchAll(/(?:src|href)="(\.\/[^"?#]+)"/g)) {
  assert.ok((await stat(resolve(output, match[1]))).isFile(), `Missing relative link: ${match[1]}`)
}
const app = await readFile(resolve(output, 'app.mjs'), 'utf8')
assert.match(app, /from '\.\/js\/published\.js'/)
assert.doesNotMatch(app, /fetch\(['"]https?:\/\//, 'Data loads must be local static requests')
const syntax = spawnSync(process.execPath, ['--check', resolve(output, 'app.mjs')], { stdio: 'inherit' })
assert.equal(syntax.status, 0, 'Built browser script must parse')

console.log('Passed: exact source bytes, 6,120-row grid, pinned source values, risk classifications, BGC matching, CSV exports, invalid inputs, metadata, licences, static assets and browser-script syntax.')
