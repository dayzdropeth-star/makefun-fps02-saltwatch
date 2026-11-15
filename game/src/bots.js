// Bot AI: waypoint navigation, hold / patrol / investigate / engage / defuse states,
// line-of-sight checks, burst fire with reaction time and aim error, strafing.
//
// HEARING (the fix vs the old build): the old code checked noises only while idle and
// a bot that heard a shot silently walked over. Here every noise carries a radius by
// kind (shots 30 m, explosions 40 m, sprint steps 12 m, crouched steps 3 m — see
// state.js CFG), each bot has its own hearing bonus, and hearing is VISIBLE:
// the bot snaps its head toward the sound first (yaw turns to the noise before its
// feet move), switches to 'investigate', and a floating "?" marker appears over its
// head until it arrives; "!" appears while it engages. A player who fires far away
// stays unheard; a player who sprints past a corner gets investigated.
// Bots also aim worse at a crouched target (smaller silhouette) — crouch is cover.
import * as THREE from 'three';
import { WAYPOINTS, nearestWaypoint, nextWaypoint, collideCircle } from './map.js';
import { WEAPONS } from './weapons.js';

const BOT_W = WEAPONS.TR9; // bots all carry the Riptide for readable TTK

function markTexture(glyph, color) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(8,14,18,0.85)';
  ctx.beginPath(); ctx.arc(32, 32, 30, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(32, 32, 28, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = color; ctx.font = 'bold 42px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(glyph, 32, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function botMesh(team) {
  const g = new THREE.Group();
  const accent = team === 'tide' ? 0x2fd6c0 : 0xc2491e;
  const cloth = new THREE.MeshStandardMaterial({ color: team === 'tide' ? 0x2a6a60 : 0x6a3a28, roughness: 0.85, emissive: team === 'tide' ? 0x0a2a26 : 0x2a120a, emissiveIntensity: 0.8 });
  const acc = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5, emissive: accent, emissiveIntensity: 0.7 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32), cloth);
  torso.position.y = 1.15; torso.userData.part = 'body'; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xc9a06b, roughness: 0.7 }));
  head.position.y = 1.68; head.userData.part = 'head'; g.add(head);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.05), acc);
  visor.position.set(0, 1.7, 0.18); g.add(visor);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.3), cloth);
  legs.position.y = 0.38; legs.userData.part = 'legs'; g.add(legs);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.5 }));
  gun.position.set(0.28, 1.25, 0.2); g.add(gun);
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.57, 0.1, 0.34), acc);
  band.position.y = 1.42; g.add(band);
  g.traverse((o) => { o.castShadow = true; });
  return g;
}

export function createBots(scene, colliders, shootables, rng, audio) {
  const ray = new THREE.Raycaster(); ray.far = 90;
  const _o = new THREE.Vector3(); const _d = new THREE.Vector3();
  const list = [];
  const hitMeshes = [];
  let idc = 0;
  const texQ = markTexture('?', '#ffb347');
  const texE = markTexture('!', '#ff4d2e');

  function spawn(team, idx, x, z) {
    const mesh = botMesh(team);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    // State marker: "?" while investigating a sound, "!" while engaging. It is the
    // only HUD the bots get, and it is how a screenshot proves they heard something.
    const markQ = new THREE.Sprite(new THREE.SpriteMaterial({ map: texQ, transparent: true, depthTest: false }));
    markQ.scale.setScalar(0.55); markQ.position.y = 2.25; markQ.visible = false;
    const markE = new THREE.Sprite(new THREE.SpriteMaterial({ map: texE, transparent: true, depthTest: false }));
    markE.scale.setScalar(0.55); markE.position.y = 2.25; markE.visible = false;
    mesh.add(markQ); mesh.add(markE);
    const b = {
      id: idc, team, idx, mesh, pos: mesh.position, markQ, markE,
      hp: 100, alive: true, yaw: team === 'tide' ? Math.PI : 0,
      state: team === 'tide' ? 'follow' : 'push',
      wp: nearestWaypoint(x, z), targetWp: null, holdT: 0,
      reactT: 0, burstLeft: 0, burstT: 0, fireCd: 0, strafeDir: 1, strafeT: 0,
      target: null, blindT: 0, speed: 3.4 + rng.range(-0.3, 0.5),
      vx: 0, vz: 0, hearing: rng.range(0, 6),
      investigate: null, site: null, mag: BOT_W.mag, reloadT: 0,
    };
    idc += 1;
    mesh.traverse((o) => {
      if (o.userData.part) { o.userData.botId = b.id; hitMeshes.push(o); }
    });
    list.push(b);
    return b;
  }
  function byId(id) { for (const b of list) if (b.id === id) return b; return null; }
  function reset(spawns) {
    for (const b of list) {
      const s = spawns[b.team][b.idx];
      b.pos.set(s.x, 0, s.z); b.hp = 100; b.alive = true; b.mesh.visible = true;
      b.yaw = b.team === 'tide' ? Math.PI : 0;
      b.state = b.team === 'tide' ? 'follow' : 'push';
      b.wp = nearestWaypoint(s.x, s.z); b.targetWp = null;
      b.reactT = 0; b.burstLeft = 0; b.fireCd = 0; b.blindT = 0; b.mag = BOT_W.mag; b.reloadT = 0;
      b.investigate = null; b.target = null; b.site = b.team === 'rust' ? rng.pick(['A', 'B']) : null;
      b.vx = 0; b.vz = 0;
    }
  }
  function hasLOS(a, b, eyeA = 1.5, eyeB = 1.4) {
    _o.set(a.x, a.y + eyeA, a.z);
    _d.set(b.x - a.x, (b.y + eyeB) - (a.y + eyeA), b.z - a.z);
    const dist = _d.length();
    if (dist > 70) return false;
    _d.normalize(); ray.set(_o, _d);
    const hits = ray.intersectObjects(shootables, false);
    return !(hits.length && hits[0].distance < dist - 0.4);
  }
  function visibleEnemies(b, player, foes) {
    // Returns nearest visible foe (player counts for rust; tide bots see rust bots).
    let best = null, bd = 55;
    const cands = b.team === 'rust'
      ? foes.concat(player.alive ? [player] : [])
      : foes;
    for (const e of cands) {
      if (e === b || !e.alive) continue;
      const d = Math.hypot(e.pos.x - b.pos.x, e.pos.z - b.pos.z);
      if (d > bd) continue;
      if (hasLOS(b.pos, e.pos, 1.5, e === player ? player.eye() : 1.4)) { best = e; bd = d; }
    }
    return best;
  }
  // Move with a little acceleration of its own: velocity chases the wanted step so
  // bots do not start and stop on a dime either.
  function moveToward(b, tx, tz, dt, speedMul = 1) {
    const dx = tx - b.pos.x, dz = tz - b.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.3) { b.vx *= 0.8; b.vz *= 0.8; return true; }
    const sp = b.speed * speedMul;
    const k = Math.min(1, 8 * dt);
    b.vx += ((dx / d) * sp - b.vx) * k;
    b.vz += ((dz / d) * sp - b.vz) * k;
    b.pos.x += b.vx * dt; b.pos.z += b.vz * dt;
    b.yaw = Math.atan2(b.vx, b.vz); // model faces +z; yaw aligns local +z to travel dir
    collideCircle(colliders, b.pos, 0.42);
    return d < 0.6;
  }
  function stepBot(b, dt, ctx) {
    if (!b.alive) return;
    const { player, state } = ctx;
    if (b.blindT > 0) { b.blindT -= dt; b.target = null; }
    // Reload
    if (b.reloadT > 0) {
      b.reloadT -= dt;
      if (b.reloadT <= 0) b.mag = BOT_W.mag;
    }
    // HEARING: a recent noise inside (radius + own hearing) pulls the bot to
    // investigate. The head turns to the sound FIRST — yaw snaps toward the noise
    // before the feet move — so a nearby player sees the bot react.
    if (b.blindT <= 0 && b.state !== 'engage' && b.state !== 'defuse') {
      for (const n of state.noises) {
        if (state.time - n.t > 1.2) continue;
        const d = Math.hypot(n.x - b.pos.x, n.z - b.pos.z);
        if (d < n.radius + b.hearing) {
          b.investigate = { x: n.x, z: n.z, t: 3 };
          b.state = 'investigate';
          b.yaw = Math.atan2(n.x - b.pos.x, n.z - b.pos.z);
          break;
        }
      }
    }
    // Bomb planted: nearest 2 rust bots go defuse; tide bots guard.
    if (state.bomb.status === 'planted' && b.team === 'rust' && b.state !== 'defuse') {
      const defusers = list.filter((o) => o.alive && o.team === 'rust' && o.state === 'defuse');
      const d = Math.hypot(state.bomb.x - b.pos.x, state.bomb.z - b.pos.z);
      if (defusers.length < 2 && d < 45) { b.state = 'defuse'; b.targetWp = null; }
    }
    // Spot a target?
    const foes = b.team === 'tide' ? list.filter((o) => o.team === 'rust') : list.filter((o) => o.team === 'tide');
    const seen = b.blindT > 0 ? null : visibleEnemies(b, player, foes);
    if (seen) {
      if (b.target !== seen) { b.target = seen; b.reactT = rng.range(0.35, 0.6); b.burstLeft = 0; }
      b.state = 'engage';
    } else if (b.state === 'engage') {
      b.target = null; b.state = b.team === 'tide' ? 'follow' : 'push';
    }
    if (b.state === 'engage' && b.target) {
      const t = b.target;
      const dx = t.pos.x - b.pos.x, dz = t.pos.z - b.pos.z;
      const dist = Math.hypot(dx, dz);
      b.yaw = Math.atan2(dx, dz);
      // Strafe sideways while fighting.
      b.strafeT -= dt;
      if (b.strafeT <= 0) { b.strafeDir *= -1; b.strafeT = rng.range(0.5, 1.2); }
      if (dist > 14) moveToward(b, t.pos.x, t.pos.z, dt, 0.8);
      else if (dist < 5) moveToward(b, b.pos.x - dx, b.pos.z - dz, dt, 0.6);
      else {
        b.pos.x += Math.cos(b.yaw) * b.strafeDir * b.speed * 0.45 * dt;
        b.pos.z -= Math.sin(b.yaw) * b.strafeDir * b.speed * 0.45 * dt;
        collideCircle(colliders, b.pos, 0.42);
      }
      // Fire in bursts after reaction time.
      b.reactT -= dt; b.fireCd -= dt;
      if (b.reactT <= 0 && b.fireCd <= 0 && b.reloadT <= 0) {
        if (b.burstLeft <= 0) { b.burstLeft = rng.int(3, 5); b.fireCd = rng.range(0.5, 0.9); }
        else {
          b.burstLeft -= 1; b.fireCd = 0.11; b.mag -= 1;
          if (b.mag <= 0) b.reloadT = 1.7;
          // Aim error grows with distance and with a moving target; a crouched
          // target is a smaller silhouette, so bots miss it more.
          let aimErr = 0.012 + dist * 0.0011 + (t === player && player.moving ? 0.012 : 0);
          if (t === player && player.crouched) aimErr += 0.008;
          ctx.botFire(b, t, aimErr);
        }
      }
      return;
    }
    // Defuse behaviour
    if (b.state === 'defuse') {
      if (moveToward(b, state.bomb.x, state.bomb.z, dt)) {
        state.bomb.defuseProgress += dt;
        state.bomb.defuserId = b.id;
        if (state.bomb.defuseProgress >= 5) ctx.onDefused(b);
      }
      return;
    }
    // Investigate a noise: walk to it, look around, then resume the route.
    if (b.state === 'investigate' && b.investigate) {
      if (moveToward(b, b.investigate.x, b.investigate.z, dt)) {
        b.investigate.t -= dt;
        b.yaw += Math.sin(state.time * 1.5 + b.id) * 0.03; // scan while listening
        if (b.investigate.t <= 0) { b.investigate = null; b.state = b.team === 'tide' ? 'follow' : 'push'; }
      }
      return;
    }
    // Follow (tide): trail the player at ~4m, waypoint-hopping.
    if (b.state === 'follow') {
      const d = Math.hypot(player.pos.x - b.pos.x, player.pos.z - b.pos.z);
      if (d > 5) {
        const tx = player.pos.x + Math.sin(b.idx * 1.7) * 3.5;
        const tz = player.pos.z + Math.cos(b.idx * 1.7) * 3.5;
        moveToward(b, tx, tz, dt, 0.9);
      } else {
        b.holdT -= dt;
        if (b.holdT <= 0) { b.yaw += rng.range(-0.6, 0.6); b.holdT = rng.range(1, 2.5); }
      }
      return;
    }
    // Push / patrol (rust): waypoint route toward their assigned site, then hold.
    if (b.state === 'push') {
      const site = b.site === 'A' ? { x: -21, z: -17 } : { x: 21, z: -17 };
      const goal = b.targetWp === null ? nearestWaypoint(site.x, site.z) : b.targetWp;
      const node = WAYPOINTS[goal];
      if (moveToward(b, node.x, node.z, dt)) {
        if (goal === nearestWaypoint(site.x, site.z)) { b.state = 'hold'; b.holdT = rng.range(2, 4); }
        else b.targetWp = nextWaypoint(goal, nearestWaypoint(site.x, site.z), rng);
      }
      return;
    }
    if (b.state === 'hold') {
      b.holdT -= dt;
      b.yaw += Math.sin(state.time * 0.4 + b.id) * 0.01; // slow scan sweep while holding
      if (b.holdT <= 0) { b.state = 'push'; b.targetWp = null; b.site = b.site === 'A' ? 'B' : 'A'; }
    }
  }
  function step(dt, ctx) {
    for (const b of list) stepBot(b, dt, ctx);
    for (const b of list) {
      b.mesh.rotation.y = b.yaw;
      b.mesh.visible = b.alive;
      // Markers follow the state, nothing else.
      b.markQ.visible = b.alive && b.state === 'investigate';
      b.markE.visible = b.alive && b.state === 'engage';
    }
  }
  function damage(b, dmg) {
    if (!b.alive) return false;
    b.hp -= dmg;
    if (b.hp <= 0) { b.hp = 0; b.alive = false; b.mesh.visible = false; return true; }
    return false;
  }
  return { list, hitMeshes, spawn, byId, reset, step, damage, hasLOS };
}
