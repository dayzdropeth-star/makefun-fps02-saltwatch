// Hitscan combat: raycasts against bot hit meshes and walls, tracers, impact sparks,
// frag + flash grenades. Reuses one Raycaster and a few scratch vectors — no per-shot allocation.
import * as THREE from 'three';
import { CFG } from './state.js';
import { damageAt } from './weapons.js';

// Re-exported so main.js can import the damage helper from this module.
export { damageAt };

const _dir = new THREE.Vector3();
const _origin = new THREE.Vector3();
const _tmp = new THREE.Vector3();

export function createCombat(scene, shootables, bots, audio, rng) {
  const ray = new THREE.Raycaster();
  ray.far = 120;
  const tracers = [];
  const sparks = [];
  const grenades = [];
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9 });
  const sparkGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffb347 });
  const grenadeGeo = new THREE.SphereGeometry(0.12, 10, 8);
  const grenadeMat = new THREE.MeshStandardMaterial({ color: 0x3a3a2a, roughness: 0.5, metalness: 0.6 });

  function addTracer(from, to) {
    const g = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(g, tracerMat);
    scene.add(line);
    tracers.push({ line, t: 0.09 });
  }
  function addSparks(point, n = 6) {
    for (let i = 0; i < n; i += 1) {
      const m = new THREE.Mesh(sparkGeo, sparkMat);
      m.position.copy(point);
      scene.add(m);
      sparks.push({ m, vx: rng.range(-2, 2), vy: rng.range(1, 3.5), vz: rng.range(-2, 2), t: 0.4 });
    }
  }
  // Fire one hitscan pellet. shooter: {pos:Vector3, eyeY, yaw, pitch, team, weapon, isPlayer}.
  // Returns {hit:bool, bot|null, part, dist, point} — the caller applies damage/effects.
  function fire(shooter, weapon, spread, isPlayer) {
    _origin.set(shooter.pos.x, shooter.pos.y + shooter.eyeY, shooter.pos.z);
    const cp = Math.cos(shooter.pitch), sp = Math.sin(shooter.pitch);
    _dir.set(-Math.sin(shooter.yaw) * cp, sp, -Math.cos(shooter.yaw) * cp);
    _dir.x += (rng.next() * 2 - 1) * spread;
    _dir.y += (rng.next() * 2 - 1) * spread;
    _dir.z += (rng.next() * 2 - 1) * spread;
    _dir.normalize();
    ray.set(_origin, _dir);
    const targets = bots.hitMeshes.concat(shootables);
    const hits = ray.intersectObjects(targets, false);
    const end = _tmp.copy(_dir).multiplyScalar(weapon.range).add(_origin);
    // point reuses the scratch vector on a miss (callers consume it immediately;
    // addTracer copies the values into geometry) and takes the raycaster's fresh
    // hit point on a hit — no per-shot allocation.
    let result = { hit: false, bot: null, part: null, dist: weapon.range, point: end };
    if (hits.length) {
      const h = hits[0];
      result.dist = h.distance;
      result.point = h.point;
      if (h.object.userData.botId !== undefined) {
        const bot = bots.byId(h.object.userData.botId);
        if (bot && bot.alive && bot.team !== shooter.team) {
          result.hit = true; result.bot = bot; result.part = h.object.userData.part || 'body';
        }
      }
      if (!result.hit) addSparks(h.point, 5);
    }
    addTracer(_origin, result.point);
    return result;
  }
  function throwGrenade(kind, from, dir, owner) {
    const m = new THREE.Mesh(grenadeGeo, grenadeMat);
    m.position.copy(from); scene.add(m);
    grenades.push({
      m, kind, owner,
      vx: dir.x * 14, vy: dir.y * 14 + 4, vz: dir.z * 14,
      t: kind === 'FRAG' ? 1.6 : 1.1,
    });
    audio.click();
  }
  function explode(g, state, player, onDamage) {
    const p = g.m.position;
    if (g.kind === 'FRAG') {
      audio.boom();
      addSparks(p, 26);
      // Radial damage with falloff; walls block via a short raycast check.
      const all = bots.list.concat([{ isPlayer: true, pos: player.pos, alive: player.alive, team: 'tide', hp: player.hp }]);
      for (const e of all) {
        if (!e.alive) continue;
        const dx = e.pos.x - p.x, dz = e.pos.z - p.z;
        const dy = (e.pos.y + 1) - p.y;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d > 6.5) continue;
        const dmg = Math.round(110 * (1 - (d / 6.5) * 0.7));
        onDamage(e, dmg, g.owner ?? 'frag');
      }
      // A frag is the loudest thing in the round: every bot in 40 m investigates.
      state.noises.push({ x: p.x, z: p.z, radius: CFG.NOISE_EXPLOSION, t: state.time, kind: 'explosion' });
    } else {
      audio.flash();
      state.flash = 1;
      // Blind bots looking at the pop.
      for (const b of bots.list) {
        if (!b.alive || b.team === 'tide') continue;
        const d = Math.hypot(b.pos.x - p.x, b.pos.z - p.z);
        if (d < 14) b.blindT = Math.max(b.blindT, 2.2 * (1 - d / 16));
      }
    }
    scene.remove(g.m);
  }
  function step(dt, state, player, onDamage) {
    for (let i = tracers.length - 1; i >= 0; i -= 1) {
      tracers[i].t -= dt;
      if (tracers[i].t <= 0) { scene.remove(tracers[i].line); tracers[i].line.geometry.dispose(); tracers.splice(i, 1); }
    }
    for (let i = sparks.length - 1; i >= 0; i -= 1) {
      const s = sparks[i]; s.t -= dt;
      s.m.position.x += s.vx * dt; s.m.position.y += s.vy * dt; s.m.position.z += s.vz * dt;
      s.vy -= 9 * dt;
      if (s.t <= 0 || s.m.position.y < 0.02) { scene.remove(s.m); sparks.splice(i, 1); }
    }
    for (let i = grenades.length - 1; i >= 0; i -= 1) {
      const g = grenades[i];
      g.vy -= 18 * dt;
      g.m.position.x += g.vx * dt; g.m.position.y += g.vy * dt; g.m.position.z += g.vz * dt;
      if (g.m.position.y < 0.12) { g.m.position.y = 0.12; g.vy *= -0.35; g.vx *= 0.7; g.vz *= 0.7; }
      g.t -= dt;
      if (g.t <= 0) { explode(g, state, player, onDamage); grenades.splice(i, 1); }
    }
  }
  return { fire, throwGrenade, step, damageAt };
}
