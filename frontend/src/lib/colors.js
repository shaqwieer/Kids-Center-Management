/** Avatar palette + session-state visual tokens (ported from the design). */
export const PALETTE = ['#F97A53', '#12A594', '#7C5CE0', '#F5A623', '#EC6A9C', '#3E97D8', '#59B85B'];

export function avatarColor(name) {
  let s = 0;
  for (const ch of (name || '?')) s += ch.codePointAt(0);
  return PALETTE[s % PALETTE.length];
}

/** Visual state -> colors. Keys: playing | warning | overtime. */
export const STATE_STYLES = {
  playing: { color: '#12A594', bg: '#FFFFFF', border: '#F0E7D8', chipBg: '#EAF7F4' },
  warning: { color: '#F59E0B', bg: '#FFF8EC', border: '#F6DFA6', chipBg: '#FBEBCB' },
  overtime: { color: '#E5484D', bg: '#FEEDEC', border: '#F4BCBA', chipBg: '#FAD7D5' },
};

export function initial(name) {
  return (name || '?').trim().charAt(0) || '?';
}
