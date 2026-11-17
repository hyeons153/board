export const clamp = (n:number, min=0, max=100) => Math.min(max,Math.max(min,n));
export const round = (n:number) => Math.round(n * 10) / 10;
export function seeded(seed:number, ...keys:(string|number)[]) {
  let n = seed >>> 0;
  for (const ch of keys.join('~')) n = Math.imul(n ^ ch.charCodeAt(0), 16777619) >>> 0;
  return () => {
    n = (n + 0x6d2b79f5) | 0;
    let t = Math.imul(n ^ (n >>> 15), n | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
