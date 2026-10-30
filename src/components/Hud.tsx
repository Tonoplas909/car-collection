/** One figure of the top bar of a live race (position, time, sector…). */
export function Hud({ k, v }: { k: string; v: string }) {
  return <div className="lv-hud"><span className="label">{k}</span><span className="lv-hud-v tnum">{v}</span></div>
}
