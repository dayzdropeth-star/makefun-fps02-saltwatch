// Weapon definitions + the spread / recoil model. All numbers are data; player.js and
// combat.js read them, nothing here touches the DOM or the scene.
//
// CROUCH in the spread model: a crouched shooter multiplies spread by 0.55, so the
// crosshair visibly closes (hud.setCrosshair reads player.spread() every frame) and
// long shots land tighter. Moving multiplies by the weapon's moveSpread (up to x4.0
// on the sniper), sprinting by x2.8, ADS by x0.7. Stopping to aim pays, every time.
export const WEAPONS = {
  P7: {
    id: 'P7', name: 'P7 Gull', kind: 'pistol', price: 0, auto: false,
    damage: 34, headMult: 4, bodyMult: 1, legMult: 0.75,
    mag: 12, reserve: 36, reloadTime: 1.1, fireInterval: 0.16,
    baseSpread: 0.006, moveSpread: 2.2, bloomPerShot: 0.004, maxBloom: 0.03,
    recoil: 0.011, range: 45, falloffStart: 18, pellets: 1,
  },
  B12: {
    id: 'B12', name: 'B12 Breaker', kind: 'shotgun', price: 1200, auto: false,
    damage: 16, headMult: 4, bodyMult: 1, legMult: 0.75,
    mag: 6, reserve: 24, reloadTime: 2.4, fireInterval: 0.85,
    baseSpread: 0.035, moveSpread: 2.0, bloomPerShot: 0.02, maxBloom: 0.05,
    recoil: 0.045, range: 22, falloffStart: 8, pellets: 8,
  },
  TR9: {
    id: 'TR9', name: 'TR-9 Riptide', kind: 'smg', price: 1500, auto: true,
    damage: 26, headMult: 4, bodyMult: 1, legMult: 0.75,
    mag: 28, reserve: 84, reloadTime: 1.7, fireInterval: 0.085,
    baseSpread: 0.011, moveSpread: 2.4, bloomPerShot: 0.005, maxBloom: 0.038,
    recoil: 0.013, range: 38, falloffStart: 14, pellets: 1,
  },
  AR61: {
    id: 'AR61', name: 'AR-61 Saltline', kind: 'rifle', price: 2700, auto: true,
    damage: 38, headMult: 4, bodyMult: 1, legMult: 0.75,
    mag: 30, reserve: 90, reloadTime: 2.1, fireInterval: 0.11,
    baseSpread: 0.008, moveSpread: 2.5, bloomPerShot: 0.005, maxBloom: 0.035,
    recoil: 0.017, range: 60, falloffStart: 22, pellets: 1,
  },
  HM50: {
    id: 'HM50', name: 'HM-50 Harpoon', kind: 'sniper', price: 4750, auto: false,
    damage: 95, headMult: 4, bodyMult: 1, legMult: 0.75,
    mag: 5, reserve: 15, reloadTime: 2.8, fireInterval: 1.15,
    baseSpread: 0.001, moveSpread: 4.0, bloomPerShot: 0.001, maxBloom: 0.01,
    recoil: 0.06, range: 90, falloffStart: 30, pellets: 1,
  },
};
export const GRENADES = {
  FRAG: { id: 'FRAG', name: 'Salt Frag', price: 300, radius: 6.5, damage: 110 },
  FLASH: { id: 'FLASH', name: 'Strobe Flash', price: 200, radius: 14, blindTime: 2.2 },
};
export const WEAPON_ORDER = ['P7', 'B12', 'TR9', 'AR61', 'HM50'];

// Current spread (radians) for a shot: base + bloom, then stance multipliers.
export function currentSpread(w, bloom, moving, crouched, ads, sprinting) {
  let s = w.baseSpread + bloom;
  if (sprinting) s *= 2.8;
  else if (moving) s *= w.moveSpread;
  if (crouched) s *= 0.55; // crouch: the tightest stance in the game
  if (ads) s *= 0.7;
  return s;
}
// Damage at distance: full until falloffStart, then linear down to 55% at max range.
// Headshots deal x4 — a headshot with the rifle (38) one-taps a 100 HP bot at close range.
export function damageAt(w, dist, part) {
  let d = w.damage;
  if (dist > w.falloffStart) {
    const t = Math.min(1, (dist - w.falloffStart) / Math.max(1, w.range - w.falloffStart));
    d *= 1 - 0.45 * t;
  }
  if (part === 'head') d *= w.headMult;
  else if (part === 'legs') d *= w.legMult;
  else d *= w.bodyMult;
  return d;
}
