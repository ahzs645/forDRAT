import {
  PUBLISHED_PERIODS,
  PUBLISHED_SOURCE,
  RISK_LEVELS,
  SOIL_MOISTURE_REGIMES,
  TREE_SPECIES,
  exportPublishedCsv,
  parsePublishedCsv,
  publishedSeries,
  resolvePublishedBgc,
} from './js/published.js'

const $ = (id) => document.getElementById(id)
const bgcSelect = $('bgc')
const soilSelect = $('soil')
const status = $('status')
let dataset = null
let manifest = null
let selection = null
let activeLoad = null

function element(name, text, className) {
  const node = document.createElement(name)
  if (text !== undefined) node.textContent = text
  if (className) node.className = className
  return node
}

function svgElement(name, attributes = {}, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name)
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value))
  if (text !== undefined) node.textContent = text
  return node
}

function showStatus(message, error = false) {
  status.textContent = message
  status.classList.toggle('error', error)
}

function riskBadge(code) {
  const level = RISK_LEVELS.find((item) => item.code === code)
  return element('span', `${code} · ${level.label}`, `risk risk-${code.toLowerCase()}`)
}

function periodHeader() {
  const head = element('thead')
  const row = element('tr')
  const first = element('th', 'Tree species')
  first.scope = 'col'
  row.append(first)
  for (const period of PUBLISHED_PERIODS) {
    const cell = element('th')
    cell.scope = 'col'
    cell.append(element('span', period.id.replace('-', '–')))
    cell.append(element('small', period.kind === 'historical' ? 'Historical' : `${period.years[0]}–${period.years[1]}`))
    row.append(cell)
  }
  head.append(row)
  return head
}

function renderSpecies(rows) {
  const table = $('species-table')
  table.replaceChildren(element('caption', 'Drought-related mortality risk by species and climate period'), periodHeader())
  const body = element('tbody')
  for (const species of TREE_SPECIES) {
    const row = element('tr')
    const label = element('th')
    label.scope = 'row'
    label.append(element('span', species.name), element('small', species.code))
    row.append(label)
    for (const published of rows) {
      const cell = element('td')
      cell.append(riskBadge(published.risks[species.code]))
      row.append(cell)
    }
    body.append(row)
  }
  table.append(body)
  $('risk-legend').replaceChildren(...RISK_LEVELS.map(({ code }) => riskBadge(code)))
}

function renderRatios(rows) {
  const table = $('ratio-table')
  const head = element('thead')
  const headings = element('tr')
  const body = element('tbody')
  const values = element('tr')
  for (const row of rows) {
    const heading = element('th', row.period.replace('-', '–'))
    heading.scope = 'col'
    headings.append(heading)
    values.append(element('td', String(row.aetPet)))
  }
  head.append(headings)
  body.append(values)
  table.replaceChildren(element('caption', 'Exact published AET/PET values'), head, body)
}

function renderChart(rows) {
  const width = 920
  const height = 330
  const left = 60
  const right = 25
  const top = 34
  const bottom = 82
  const plotHeight = height - top - bottom
  const x = (index) => left + (index * (width - left - right)) / (rows.length - 1)
  const y = (ratio) => top + (1 - ratio) * plotHeight
  const chart = svgElement('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-labelledby': 'water-chart-title water-chart-description' })
  chart.append(svgElement('title', { id: 'water-chart-title' }, `Published AET/PET for ${selection.bgc}, ${selection.soil.label.toLowerCase()} soils`))
  chart.append(svgElement('desc', { id: 'water-chart-description' }, rows.map((row) => `${row.period}: ${row.aetPet}`).join('; ')))
  const projectedStart = (x(2) + x(3)) / 2
  chart.append(svgElement('rect', { x: projectedStart, y: top - 16, width: width - right - projectedStart + 12, height: plotHeight + 16, class: 'projection-band', rx: 8 }))
  for (const tick of [0, 0.25, 0.5, 0.75, 1]) {
    chart.append(svgElement('line', { x1: left, x2: width - right, y1: y(tick), y2: y(tick), class: 'grid-line' }))
    chart.append(svgElement('text', { x: left - 12, y: y(tick) + 4, 'text-anchor': 'end', class: 'axis-label' }, tick.toFixed(2)))
  }
  chart.append(svgElement('polyline', { points: rows.map((row, index) => `${x(index)},${y(row.aetPet)}`).join(' '), class: 'ratio-line' }))
  rows.forEach((row, index) => {
    const period = PUBLISHED_PERIODS[index]
    const point = svgElement('circle', { cx: x(index), cy: y(row.aetPet), r: 6, class: `chart-point ${period.kind}` })
    point.append(svgElement('title', {}, `${period.label}: ${row.aetPet}`))
    chart.append(point)
    chart.append(svgElement('text', { x: x(index), y: y(row.aetPet) - 14, 'text-anchor': 'middle', class: 'value-label' }, row.aetPet.toFixed(3)))
    chart.append(svgElement('text', { x: x(index), y: height - 50, 'text-anchor': 'middle', class: 'period-label' }, row.period.replace('-', '–')))
    chart.append(svgElement('text', { x: x(index), y: height - 31, 'text-anchor': 'middle', class: 'axis-label' }, period.kind === 'historical' ? 'Historical' : `${period.years[0]}–${period.years[1]}`))
  })
  $('chart').replaceChildren(chart)
}

function clearSelection() {
  selection = null
  $('results').hidden = true
  if (dataset) showStatus('Choose the BGC unit and assessed soil regime, then compare periods.')
}

function compare(event) {
  event.preventDefault()
  if (!dataset) return
  const bgc = resolvePublishedBgc(bgcSelect.value, dataset.bgcUnits)
  const soil = SOIL_MOISTURE_REGIMES.find(({ id }) => id === Number(soilSelect.value))
  if (!bgc || !soil) {
    clearSelection()
    showStatus('Select an exact published BGC unit and a soil moisture regime.', true)
    return
  }
  const rows = publishedSeries(dataset, bgc, soil.id)
  if (rows.length !== PUBLISHED_PERIODS.length) {
    clearSelection()
    showStatus('This selection does not have all six published periods. Reload the source data.', true)
    return
  }
  selection = { bgc, soil, rows }
  $('results-heading').textContent = `${bgc} · ${soil.label} soils`
  $('selection-caption').textContent = 'Six climate periods · Ten published species ratings · Soil regime selected by you'
  renderRatios(rows)
  renderChart(rows)
  renderSpecies(rows)
  $('results').hidden = false
  showStatus(`Showing ${bgc}, ${soil.label.toLowerCase()} soils. Results are published model estimates.`)
  const address = new URL(window.location.href)
  address.searchParams.set('bgc', bgc)
  address.searchParams.set('smr', String(soil.id))
  history.replaceState(null, '', address)
}

function download(text, filename, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const link = element('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function loadDataset() {
  activeLoad?.abort()
  const controller = new AbortController()
  activeLoad = controller
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, 30_000)
  dataset = null
  manifest = null
  clearSelection()
  bgcSelect.replaceChildren(new Option('Select a BGC unit', ''))
  soilSelect.replaceChildren(new Option('Select the assessed soil regime', ''))
  bgcSelect.disabled = true
  soilSelect.disabled = true
  $('compare').disabled = true
  $('retry').hidden = true
  showStatus('Loading the published dataset…')
  try {
    const [csvResponse, manifestResponse] = await Promise.all([
      fetch('./data/forest-drought/fordrat.csv', { signal: controller.signal }),
      fetch('./data/forest-drought/manifest.json', { signal: controller.signal }),
    ])
    if (!csvResponse.ok || !manifestResponse.ok) throw new Error('The published source files could not be loaded.')
    const [csvBytes, sourceManifest] = await Promise.all([csvResponse.arrayBuffer(), manifestResponse.json()])
    if (sourceManifest.source?.sha256 !== PUBLISHED_SOURCE.sha256 || sourceManifest.source?.commit !== PUBLISHED_SOURCE.commit) {
      throw new Error('The source manifest does not match this browser release.')
    }
    if (csvBytes.byteLength !== PUBLISHED_SOURCE.bytes) throw new Error('The published CSV size does not match this release.')
    if (globalThis.crypto?.subtle) {
      const digest = await crypto.subtle.digest('SHA-256', csvBytes)
      const checksum = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('')
      if (checksum !== PUBLISHED_SOURCE.sha256) throw new Error('The published CSV checksum does not match this release.')
    }
    const parsed = parsePublishedCsv(new TextDecoder().decode(csvBytes))
    if (activeLoad !== controller) return
    if (timedOut) throw new Error('Source loading exceeded the time limit.')
    manifest = sourceManifest
    dataset = parsed
    bgcSelect.replaceChildren(new Option('Select a BGC unit', ''), ...parsed.bgcUnits.map((unit) => new Option(unit, unit)))
    soilSelect.replaceChildren(new Option('Select the assessed soil regime', ''), ...SOIL_MOISTURE_REGIMES.map(({ id, label }) => new Option(`${id} · ${label}`, String(id))))
    const address = new URL(window.location.href)
    const requestedBgc = resolvePublishedBgc(address.searchParams.get('bgc') ?? '', parsed.bgcUnits)
    const requestedSoil = SOIL_MOISTURE_REGIMES.find(({ id }) => String(id) === address.searchParams.get('smr'))
    if (requestedBgc) bgcSelect.value = requestedBgc
    if (requestedSoil) soilSelect.value = String(requestedSoil.id)
    bgcSelect.disabled = false
    soilSelect.disabled = false
    $('compare').disabled = false
    showStatus(requestedBgc || requestedSoil
      ? 'Review the selection supplied in this link, including the soil regime, then compare periods.'
      : 'Published dataset ready. Select a BGC unit and assessed soil regime to begin.')
  } catch (error) {
    if (activeLoad !== controller) return
    controller.abort()
    showStatus(timedOut
      ? 'The published data did not load within 30 seconds. Check your connection and retry.'
      : `${error instanceof Error ? error.message : 'Unable to load the source data.'} Use an HTTP server or the hosted browser app.`, true)
    $('retry').hidden = false
  } finally {
    clearTimeout(timeout)
    if (activeLoad === controller) activeLoad = null
  }
}

$('site-form').addEventListener('submit', compare)
bgcSelect.addEventListener('change', clearSelection)
soilSelect.addEventListener('change', clearSelection)
$('retry').addEventListener('click', loadDataset)
$('download-csv').addEventListener('click', () => {
  if (!selection) return
  download(exportPublishedCsv(selection.rows), `fordrat-${selection.bgc}-${selection.soil.label.toLowerCase()}.csv`, 'text/csv;charset=utf-8')
})
$('download-metadata').addEventListener('click', () => {
  if (!selection || !manifest) return
  const metadata = {
    ...manifest,
    browserExport: {
      bgc: selection.bgc,
      relativeSoilMoistureRegime: selection.soil.id,
      soilLabel: selection.soil.label,
      soilSource: 'User-selected assumption; not inferred from BGC',
      periods: selection.rows.map(({ period }) => period),
      exportedAt: new Date().toISOString(),
    },
  }
  download(`${JSON.stringify(metadata, null, 2)}\n`, `fordrat-${selection.bgc}-source-metadata.json`, 'application/json')
})

void loadDataset()
