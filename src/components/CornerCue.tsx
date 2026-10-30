import type { CornerCue as Cue, CueAdvice } from '@game'

/** How far ahead the road bar looks, metres */
const AHEAD = 250
/** The speed bar runs from this to this multiple of the corner speed, so the green zone stays wide enough to read. */
const SCALE = { from: 0.8, to: 1.6 }

const WORD: Record<CueAdvice | 'slide', string> = { go: 'GO', brake: 'BRAKE!', release: 'RELEASE!', slide: 'SLIDING' }

const pct = (x: number) => `${Math.min(100, Math.max(0, x * 100))}%`

interface Props {
  /** Name of the next corner, e.g. "Hairpin" */
  label: string
  /** Metres to that corner, null when there is none worth showing */
  dist: number | null
  v: number
  cue: Cue | null
  advice: CueAdvice
  braking: boolean
  slide: boolean
  /** Said instead of the corner when there is none to show */
  note: string
}

/**
 * What to do about the next corner, without numbers to compare: a flag on the road where braking starts,
 * a speed bar with a green zone to be in when reaching the corner, and one word that says what to do now.
 */
export function CornerCue({ label, dist, v, cue, advice, braking, slide, note }: Props) {
  const state = slide ? 'slide' : advice
  const hasCorner = dist !== null && cue !== null
  // Speed bar: position of a speed relative to the corner speed (aim = 1)
  const at = (speed: number) => (cue ? (speed / cue.aim - SCALE.from) / (SCALE.to - SCALE.from) : 0)
  const needsBrake = hasCorner && v > cue.aim
  return (
    <div className="cc" data-state={state} data-advice={advice}>
      <div className="cc-head">
        <span className="cc-where">{hasCorner ? <><b>{label}</b> in {Math.max(0, Math.round(dist))} m</> : note}</span>
        <span className="cc-word">{WORD[state]}</span>
      </div>
      {hasCorner && (
        <>
          <div className="cc-road" data-braking={braking}>
            <span className="cc-car" />
            {needsBrake && !braking && cue.toBrake > 0 && cue.toBrake <= AHEAD && <span className="cc-flag" style={{ left: pct(cue.toBrake / AHEAD) }}>BRAKE</span>}
            <span className="cc-line" style={{ left: pct(dist / AHEAD) }} />
          </div>
          <div className="cc-speed">
            <span className="cc-green" style={{ left: pct(at(cue.low)), width: pct(at(cue.high) - at(cue.low)) }}>OK</span>
            <span className="cc-fast" style={{ left: pct(at(cue.high)), right: 0 }}>too fast</span>
            <span className="cc-needle" data-fast={v > cue.high} style={{ left: pct(at(v)) }} />
          </div>
        </>
      )}
    </div>
  )
}
