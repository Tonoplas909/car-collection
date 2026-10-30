import { useState, type CSSProperties } from 'react'
import { CARS_BY_ID, type Car, type PackId } from '@game'

/** Three cars per pack, hand-picked to say what is inside: left card, middle card (on top), right card. */
const SHOWCASE: Record<PackId, string[]> = {
  street: ['mini-cooper-s', 'honda-civic-type-r-ep3', 'vw-golf-gti-mk1'],
  heritage: ['jaguar-etype-s1', 'porsche-911-rs27', 'mercedes-300sl'],
  apex: ['lamborghini-countach', 'ferrari-f40', 'mclaren-f1'],
}

/** Field colours (light, dark). Apex is darker red so it stands out from its red card. */
const FIELD: Record<PackId, [string, string]> = {
  street: ['#2f6fed', '#14295f'],
  heritage: ['#8b46d8', '#34174f'],
  apex: ['#b81f08', '#2a0a05'],
}

/** The card is asked for at about half the catalog size. */
const thumb = (url: string) => url.replace('width=800', 'width=520')

/**
 * Pack artwork: three car photos piled like cards over a coloured field with a foil stripe and the pack name.
 * A photo that fails to load is tried once more, then drops out of the pile; with none left the field and the name
 * still make a pack.
 */
export function PackArt({ pack, name, className = '' }: { pack: PackId; name: string; className?: string }) {
  const [tries, setTries] = useState<Record<string, number>>({})
  const [light, dark] = FIELD[pack]
  const failed = (id: string) => (tries[id] ?? 0) > 1
  const cars = SHOWCASE[pack].map(id => CARS_BY_ID[id]).filter((c): c is Car => !!c?.photoUrl && !failed(c.id))
  const retry = (id: string) => {
    const n = (tries[id] ?? 0) + 1
    // The second attempt waits a moment: a failed load is often a busy image host
    setTimeout(() => setTries(t => ({ ...t, [id]: n })), n === 1 ? 1500 : 0)
  }
  return (
    <div className={`pk-art ${className}`} style={{ '--pk-a': light, '--pk-b': dark } as CSSProperties} role="img" aria-label={`${name} pack artwork`}>
      <span className="pk-mark" aria-hidden="true">{name}</span>
      {cars.map(c => (
        <div key={c.id} className={`pk-card pk-${SHOWCASE[pack].indexOf(c.id)}`}>
          <img src={`${thumb(c.photoUrl!)}${tries[c.id] === 1 ? '&retry=1' : ''}`} alt="" decoding="async" onError={() => retry(c.id)} />
        </div>
      ))}
    </div>
  )
}
