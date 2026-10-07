// Enriches supabase/functions/_shared/game/cars.json from open sources:
//   - Wikipedia (REST summary): confirms the article exists and finds its lead image
//   - Wikimedia Commons: image license and author (only free licenses are accepted)
//   - Wikidata: production year and country, compared with the draft (differences are reported, never applied)
// A photo is only accepted when its file name matches the car (chassis code such as R34 or E30, or the
// optional `photoMatch` regex in cars.json). Candidates: Wikipedia lead image, Wikidata image, then a
// Commons search (`photoQuery`, default "make model gen"). No match means no photo, never a wrong one.
// Only photoUrl / photoCredit are written. Specs, tiers and values stay under human control.
//
//   npm run cars:enrich             fill in missing photos and print a report
//   npm run cars:enrich -- --force  redo photos for every car
//   npm run cars:enrich -- ferrari-f40 mclaren-f1   only these ids
//
// Also writes data/review.html, a contact sheet to check photos, credits and specs by eye.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const file = join(root, 'supabase/functions/_shared/game/cars.json')
const cars = JSON.parse(readFileSync(file, 'utf8'))
const args = process.argv.slice(2)
const force = args.includes('--force')
const only = args.filter(a => !a.startsWith('--'))

const UA = { 'User-Agent': 'marque-catalog-script/0.1 (https://github.com/Tonoplas909/car-collection)' }
const FREE = /^(CC0|CC BY(-SA)?( \d(\.\d)?)?|Public domain|PD|GFDL|Attribution)/i
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function getJson(url) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url, { headers: UA })
    if (r.status === 429) { await sleep(2000 * (i + 1)); continue }
    if (!r.ok) return null
    return r.json()
  }
  return null
}

const strip = html => (html ?? '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim()

async function wikipedia(title) {
  const s = await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`)
  if (!s) return { error: 'article not found' }
  if (s.type === 'disambiguation') return { error: 'title is a disambiguation page' }
  return { url: s.content_urls?.desktop?.page, image: s.originalimage?.source ?? s.thumbnail?.source, canonical: s.title, qid: s.wikibase_item }
}

/** Commons file name from an upload.wikimedia.org URL, or null when the file is not on Commons. */
function commonsName(imageUrl) {
  if (!imageUrl?.includes('upload.wikimedia.org/wikipedia/commons')) return null
  const path = new URL(imageUrl).pathname.split('/').filter(Boolean)
  return decodeURIComponent(imageUrl.includes('/thumb/') ? path[path.length - 2] : path[path.length - 1])
}

/** Free-license info for a Commons file name, or { error }. */
async function commons(name) {
  const j = await getJson(`https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent('File:' + name)}&prop=imageinfo&iiprop=extmetadata|size&format=json&origin=*`)
  const page = j && Object.values(j.query.pages)[0]
  const info = page?.imageinfo?.[0]
  const meta = info?.extmetadata
  if (!meta) return { error: `no Commons metadata for ${name}` }
  if (info.width < 700 || info.width < info.height) return { error: `unsuitable size ${info.width}x${info.height}` }
  const license = strip(meta.LicenseShortName?.value)
  if (!FREE.test(license)) return { error: `license not accepted: ${license || 'unknown'}` }
  const author = strip(meta.Artist?.value).slice(0, 60) || 'Unknown author'
  return { name, license, author }
}

/** Does a Commons file name plausibly show this exact car? */
function matcher(car) {
  const re = car.photoMatch ?? (/^[A-Z]{1,3}\d{1,3}[A-Z]?$/.test(car.gen) ? `(^|[^a-z0-9])${car.gen}([^a-z0-9]|$)` : null)
  const reject = /interior|cockpit|dashboard|engine|badge|logo|detail|steering|schematic|drawing|brochure|poster|cutaway|concept|model car|toy/i
  return name => !reject.test(name) && (!re || new RegExp(re, 'i').test(name.replace(/_/g, ' ')))
}

async function searchCommons(query) {
  const j = await getJson(`https://commons.wikimedia.org/w/api.php?action=query&list=search&srnamespace=6&srlimit=25&srsearch=${encodeURIComponent(query + ' filetype:bitmap')}&format=json&origin=*`)
  return (j?.query?.search ?? []).map(r => r.title.replace(/^File:/, '')).filter(n => /\.(jpe?g|png)$/i.test(n))
}

const labelCache = new Map()
async function label(qid) {
  if (!labelCache.has(qid)) {
    const j = await getJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=labels&languages=en&format=json`)
    labelCache.set(qid, j?.entities?.[qid]?.labels?.en?.value ?? null)
  }
  return labelCache.get(qid)
}

/** Production year and country of origin from Wikidata, if recorded. */
async function wikidata(qid) {
  if (!qid) return {}
  const j = await getJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=claims&format=json`)
  const claims = j?.entities?.[qid]?.claims ?? {}
  const time = p => claims[p]?.[0]?.mainsnak?.datavalue?.value?.time
  const t = time('P571') ?? time('P729') ?? time('P580')
  const year = t ? Number(t.slice(1, 5)) : undefined
  const cid = claims.P495?.[0]?.mainsnak?.datavalue?.value?.id ?? claims.P17?.[0]?.mainsnak?.datavalue?.value?.id
  const image = claims.P18?.[0]?.mainsnak?.datavalue?.value
  return { year, image, country: cid ? await label(cid) : undefined }
}

const report = []
let changed = 0
for (const car of cars) {
  if (only.length && !only.includes(car.id)) continue
  const row = { id: car.id, notes: [] }
  report.push(row)
  if (!car.wiki) { row.notes.push('no wiki title in cars.json'); continue }
  const w = await wikipedia(car.wiki)
  if (w.error) { row.notes.push(`wikipedia: ${w.error} (${car.wiki})`); continue }
  row.wiki = w.url

  const d = await wikidata(w.qid)

  if (force || !car.photoUrl) {
    // Wikipedia's lead image first, then the image Wikidata lists, then a Commons search.
    const ok = matcher(car)
    const tried = new Set()
    let found, lastError = 'no candidate whose file name matches this car'
    const attempt = async n => {
      if (!n || tried.has(n) || !ok(n)) return
      tried.add(n)
      const c = await commons(n)
      if (c.error) lastError = c.error
      else found = c
    }
    await attempt(commonsName(w.image))
    if (!found) await attempt(d.image)
    if (!found) for (const n of await searchCommons(car.photoQuery ?? `${car.make} ${car.model} ${car.gen}`.trim())) { await attempt(n); if (found) break }
    if (found) {
      car.photoUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(found.name)}?width=800`
      car.photoCredit = `${found.author} · ${found.license} · Wikimedia Commons`
      changed++
    } else row.notes.push(`photo: ${lastError}`)
  }
  if (d.year && Math.abs(d.year - car.year) > 2) row.notes.push(`year: draft ${car.year}, Wikidata ${d.year}`)
  if (d.country && d.country !== car.country && !(d.country.includes('Germany') && car.country === 'Germany')) row.notes.push(`country: draft ${car.country}, Wikidata ${d.country}`)
  await sleep(150)
}

writeFileSync(file, JSON.stringify(cars, null, 2) + '\n')

const esc = s => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch])
const rows = cars.map(c => {
  const r = report.find(x => x.id === c.id)
  return `<tr class="${c.reviewed ? 'ok' : ''}"><td>${c.photoUrl ? `<img src="${esc(c.photoUrl)}" loading="lazy">` : '<i>no photo</i>'}<small>${esc(c.photoCredit)}</small></td>
<td><b>${esc(c.make)} ${esc(c.model)} ${esc(c.gen)}</b><br>${esc(c.tier)} · ${c.year} · ${esc(c.country)}<br>${c.hp} hp · ${c.nm} Nm · ${c.acc}s · ${c.top} km/h · ${c.kg} kg · ${c.value.toLocaleString('en-US')} CR<br>pools ${esc(c.pools.join(', '))} · tastes ${esc(c.tastes.join(', '))}
<p>${esc(c.blurb)}</p>${c.wiki ? `<a href="https://en.wikipedia.org/wiki/${encodeURIComponent(c.wiki.replace(/ /g, '_'))}">Wikipedia</a>` : ''} ${c.reviewed ? '· reviewed' : '· <b>DRAFT</b>'}
${r?.notes.length ? `<ul>${r.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}</td></tr>`
}).join('\n')
mkdirSync(join(root, 'data'), { recursive: true })
writeFileSync(join(root, 'data/review.html'), `<!doctype html><meta charset="utf-8"><title>Car catalog review</title>
<style>body{font:14px system-ui;margin:24px;max-width:1000px}table{border-collapse:collapse}td{vertical-align:top;padding:12px;border-bottom:1px solid #ccc}
img{width:300px;height:200px;object-fit:cover;filter:grayscale(1);display:block}small{display:block;max-width:300px;color:#666}tr.ok{background:#f4f4f4}li{color:#b00}</style>
<h1>Car catalog review (${cars.length} cars)</h1><table>${rows}</table>`)

const flagged = report.filter(r => r.notes.length)
console.log(`${cars.length} cars · ${cars.filter(c => c.photoUrl).length} with photos · ${changed} photos added this run · ${cars.filter(c => !c.reviewed).length} drafts`)
for (const r of flagged) console.log(`  ${r.id}\n${r.notes.map(n => `      - ${n}`).join('\n')}`)
console.log('Review sheet: data/review.html')
