// Bootstrap + fixed-step loop + input + wiring. Renders at display rate; simulation runs
// at 60 Hz in fixedStep(). No game logic lives here beyond routing events to modules.
import * as THREE from 'three';
import { CFG, PHASE, createState } from './state.js';
import { makeRng } from './rng.js';
import { makeTextures } from './textures.js';
import { createAudio } from './audio.js';
import { createMap, SPAWNS, SITES } from './map.js';
import { createPlayer } from './player.js';
import { createBots } from './bots.js';
import { createCombat, damageAt } from './combat.js';
import { createRounds } from './rounds.js';
import { createHud } from './hud.js';
import { createViewmodel } from './viewmodel.js';
import { WEAPONS, GRENADES } from './weapons.js';
import { runShot } from './shots.js';

const FIXED = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;
const rng = makeRng(seed);
const state = createState();
state.seed = seed;

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1e3247);
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 200);
scene.add(camera);

const tex = makeTextures();
const map = createMap(scene, tex);
const audio = createAudio();
const hud = createHud();
const player = createPlayer(map.colliders);
const bots = createBots(scene, map.colliders, map.shootables, rng, audio);
const combat = createCombat(scene, map.shootables, bots, audio, rng);
const viewmodel = createViewmodel(camera);
const eye = new THREE.Vector3();
const tmpV = new THREE.Vector3();

// --- wiring helpers ---------------------------------------------------------
function aliveCounts() {
  let t = 0, r = 0;
  for (const b of bots.list) { if (!b.alive) continue; if (b.team === 'tide') t += 1; else r += 1; }
  if (player.alive) t += 1;
  return { tide: t, rust: r };
}
function feed(html) { hud.feed(html); }
function botName(b) { return (b.team === 'tide' ? 'Tide-' : 'Rust-') + (b.idx + 1); }

function onDamage(e, dmg, source) {
  if (e.isPlayer) {
    if (!player.alive) return;
    player.hp -= dmg;
    audio.hurt();
    const ang = source && source.pos ? Math.atan2(source.pos.x - player.pos.x, source.pos.z - player.pos.z) - player.yaw : 0;
    hud.damage(ang);
    if (player.hp <= 0) {
      player.hp = 0; player.alive = false;
      rounds.endRound(false, 'Kamu gugur di Salt Dock.');
    }
    return;
  }
  const killed = bots.damage(e, dmg);
  if (killed) {
    // source is the player object, a bot object, the string 'frag' for a grenade
    // whose owner is unknown, or undefined — never fall back to the victim's own
    // name as the killer.
    const killer = source === player ? 'Kamu'
      : (source && typeof source === 'object' && source.team ? botName(source) : 'Granat');
    feed(`${killer} ▸ ${botName(e)}`);
    if (source === player) { state.money += CFG.KILL_REWARD; state.kills += 1; audio.kill(); }
    state.alive = aliveCounts();
    if (state.alive.rust === 0) rounds.endRound(true, 'Semua musuh tereliminasi.');
    else if (state.alive.tide === 0) rounds.endRound(false, 'Seluruh tim Tide gugur.');
  }
}
// Bot hitscan: aim at the target with error, then use the real raycast path.
function botFire(b, target, aimErr) {
  const tx = target.pos.x, ty = target.pos.y + (target === player ? player.eye() : 1.3), tz = target.pos.z;
  const dx = tx - b.pos.x, dy = ty - (b.pos.y + 1.5), dz = tz - b.pos.z;
  const dist = Math.hypot(dx, dy, dz) || 1;
  const shooter = {
    pos: b.pos, eyeY: 1.5,
    yaw: Math.atan2(-dx, -dz) + rng.gauss() * aimErr * 2,
    pitch: Math.asin(Math.max(-1, Math.min(1, dy / dist))) + rng.gauss() * aimErr * 2,
    team: b.team, weapon: WEAPONS.TR9,
  };
  const res = combat.fire(shooter, WEAPONS.TR9, aimErr, false);
  if (res.hit && res.bot) {
    const dmg = damageAt(WEAPONS.TR9, res.dist, res.part);
    onDamage(res.bot, dmg, b);
  }
  if (Math.hypot(b.pos.x - player.pos.x, b.pos.z - player.pos.z) < 40) audio.shot('smg');
}
function playerFire() {
  if (!player.canFire()) { if (player.mag === 0 && player.fireCooldown <= 0) { audio.dry(); player.fireCooldown = 0.25; } return; }
  const w = player.weapon();
  player.onFired(rng);
  viewmodel.fire();
  audio.shot(w.kind);
  const shooter = { pos: player.pos, eyeY: player.eye(), yaw: player.yaw, pitch: player.pitch, team: 'tide', weapon: w };
  const spread = player.spread();
  let anyHit = false, anyKill = false;
  for (let p = 0; p < w.pellets; p += 1) {
    const res = combat.fire(shooter, w, spread, true);
    if (res.hit && res.bot) {
      anyHit = true;
      const dmg = damageAt(w, res.dist, res.part);
      const wasAlive = res.bot.alive;
      onDamage(res.bot, dmg, player);
      if (wasAlive && !res.bot.alive) anyKill = true;
    }
  }
  if (anyHit) { audio.hit(); hud.hitmarker(anyKill); }
  // A gunshot is loud: bots within NOISE_SHOT (30 m) hear it and investigate.
  state.noises.push({ x: player.pos.x, z: player.pos.z, radius: CFG.NOISE_SHOT, t: state.time, kind: 'shot' });
  if (player.mag === 0) player.startReload();
}

const rounds = createRounds(state, {
  onBuyPhase() { hud.showBuy(state.money, rounds.buyList(), Object.values(GRENADES)); hud.hint('Fase beli — tekan B atau klik senjata. Ronde mulai sebentar lagi.'); },
  onRoundStart() {
    player.reset(0, 26, 0);
    bots.reset(SPAWNS);
    state.alive = aliveCounts();
    hud.hideBuy(); hud.hideOverlay();
    hud.hint('Plant bom di Crane Yard (A) atau Cold Store (B). Tahan E di dalam site.');
  },
  onRoundEnd(won, reason) {
    audio.sting(won);
    hud.banner(won, reason, `$${won ? CFG.WIN_REWARD : CFG.LOSS_REWARD} · Saldo $${state.money}`);
    roundEndAt = state.time + 4;
  },
  onMatchEnd(winner) {
    const won = winner === 'tide';
    hud.showOverlay('match', { title: won ? 'TIDE MENANG!' : 'RUST MENANG', text: `Skor akhir ${state.wins} — ${state.losses}. Klik Main lagi untuk rematch.` });
    if (document.pointerLockElement) document.exitPointerLock();
  },
  onPlanted(site) {
    audio.plantBeep(false);
    feed(`Bom terpasang di ${SITES[site].name}!`);
    hud.hint('Bom terpasang — jaga site sampai meledak!');
    // Planting is loud: bots within 40 m hear it and converge.
    state.noises.push({ x: SITES[site].x, z: SITES[site].z, radius: CFG.NOISE_PLANT, t: state.time, kind: 'plant' });
  },
  onBuy(w) { player.equip(w.id); viewmodel.setKind(w.kind); audio.buy(); hud.hideBuy(); hud.hint(`${w.name} dibeli — $${w.price}.`); },
  onBuyGrenade(g) { player.grenades[g.id] += 1; audio.buy(); hud.hint(`${g.name} dibeli.`); },
});
let roundEndAt = 0;

// --- input ------------------------------------------------------------------
const keys = new Set();
let firing = false, firingEdge = false, adsHeld = false;
let lookDX = 0, lookDY = 0;
const canvas = renderer.domElement;
function requestLock() { audio.unlock(); canvas.requestPointerLock(); }
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (shot) return;
  if (locked) { state.paused = false; hud.hideOverlay(); }
  else if (state.phase === PHASE.LIVE || state.phase === PHASE.BUY) {
    state.paused = true;
    if (state.phase !== PHASE.MATCH_END) hud.showOverlay('paused');
  }
});
hud.el.playBtn.addEventListener('click', () => {
  audio.unlock(); audio.click();
  if (state.phase === PHASE.MENU) { state.phase = PHASE.BUY; state.buyTime = CFG.BUY_TIME; rounds.startBuyPhase(); requestLock(); }
  else if (state.phase === PHASE.MATCH_END) {
    state.wins = 0; state.losses = 0; state.round = 1; state.money = CFG.START_MONEY;
    state.phase = PHASE.BUY; state.buyTime = CFG.BUY_TIME; rounds.startBuyPhase(); requestLock();
  } else requestLock();
});
hud.el.buyList.addEventListener('click', (ev) => {
  const btn = ev.target.closest('button'); if (!btn) return;
  if (btn.dataset.w) { const r = rounds.tryBuy(btn.dataset.w); if (!r.ok) hud.hint(r.why); }
  else if (btn.dataset.g) { const r = rounds.tryBuyGrenade(btn.dataset.g); if (!r.ok) hud.hint(r.why); }
  hud.showBuy(state.money, rounds.buyList(), Object.values(GRENADES));
});
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas) return;
  lookDX += e.movementX; lookDY += e.movementY;
});
document.addEventListener('mousedown', (e) => {
  if (document.pointerLockElement !== canvas) return;
  if (e.button === 0) { firing = true; firingEdge = true; }
  if (e.button === 2) adsHeld = true;
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 0) firing = false;
  if (e.button === 2) adsHeld = false;
});
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'KeyR') { if (player.startReload()) audio.reload(); }
  if (e.code === 'KeyB' && state.phase === PHASE.BUY) { hud.el.buyMenu.hidden ? hud.showBuy(state.money, rounds.buyList(), Object.values(GRENADES)) : hud.hideBuy(); }
  if (e.code === 'KeyM') { state.muted = !state.muted; audio.setMuted(state.muted); hud.hint(state.muted ? 'Suara dimatikan (M).' : 'Suara menyala (M).'); }
  if (e.code === 'Digit3' && player.grenades.FRAG > 0 && state.phase === PHASE.LIVE) throwGrenade('FRAG');
  if (e.code === 'Digit4' && player.grenades.FLASH > 0 && state.phase === PHASE.LIVE) throwGrenade('FLASH');
  if (state.phase === PHASE.BUY && /^Digit[1-5]$/.test(e.code)) {
    const id = ['P7', 'B12', 'TR9', 'AR61', 'HM50'][Number(e.code.slice(5)) - 1];
    const r = rounds.tryBuy(id);
    if (r.ok) hud.showBuy(state.money, rounds.buyList(), Object.values(GRENADES));
    else hud.hint(r.why);
  }
  if (e.code === 'Space') e.preventDefault();
});
document.addEventListener('keyup', (e) => keys.delete(e.code));
function throwGrenade(kind) {
  player.grenades[kind] -= 1;
  player.eyePos(eye);
  camera.getWorldDirection(tmpV);
  combat.throwGrenade(kind, eye, tmpV, player);
}
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- simulation -------------------------------------------------------------
let lastBeep = 0, accumulator = 0, lastTime = performance.now();
const G = {
  state, player, bots, rounds, hud, renderer, scene, camera, spawns: SPAWNS, frozen: false,
  fixedStep(dt) { stepSim(dt); },
  aimAt(x, y, z) {
    const dx = x - player.pos.x, dy = y - (player.pos.y + player.eye()), dz = z - player.pos.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    player.yaw = Math.atan2(-dx, -dz);
    player.pitch = Math.asin(Math.max(-1, Math.min(1, dy / len)));
  },
  syncCamera() { syncCamera(); },
};
window.__game = G;
function syncCamera() {
  player.eyePos(eye);
  camera.position.copy(eye);
  // FOV: ADS narrows to 55, sprint widens to 78 — the sprint kick makes the
  // acceleration ramp visible even before the speed readout is checked.
  const targetFov = player.ads ? 55 : player.sprinting ? 78 : 74;
  if (Math.abs(camera.fov - targetFov) > 0.1) { camera.fov += (targetFov - camera.fov) * 0.2; camera.updateProjectionMatrix(); }
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
}
function stepSim(dt) {
  state.time += dt;
  // Buy-phase countdown
  if (state.phase === PHASE.BUY) {
    state.buyTime -= dt;
    if (state.buyTime <= 0) rounds.startRound();
  }
  if (state.phase === PHASE.ROUND_END && roundEndAt && state.time >= roundEndAt) {
    roundEndAt = 0;
    if (state.phase === PHASE.ROUND_END) { state.phase = PHASE.BUY; state.buyTime = CFG.BUY_TIME; rounds.startBuyPhase(); }
  }
  if (state.phase === PHASE.LIVE) {
    rounds.step(dt);
    // Bomb beeps accelerate as the fuse burns.
    if (state.bomb.status === 'planted') {
      const interval = 0.35 + (state.bomb.fuse / CFG.BOMB_FUSE) * 0.75;
      if (state.time - lastBeep > interval) { lastBeep = state.time; audio.plantBeep(state.bomb.fuse < 10); }
    }
    // Planting
    const site = rounds.nearSite(player.pos.x, player.pos.z);
    rounds.plantStep(dt, site, keys.has('KeyE') && player.alive);
    if (site && state.bomb.status === 'idle') hud.hint('Tahan E untuk memasang bom di ' + SITES[site].name + '.');
  }
  // Player
  player.ads = adsHeld && !player.sprinting;
  if (state.phase === PHASE.LIVE || state.phase === PHASE.BUY) {
    player.step(dt, keys, { audio, time: state.time, state });
    player.look(lookDX, lookDY);
    lookDX = 0; lookDY = 0;
    const w = player.weapon();
    if (firing && state.phase === PHASE.LIVE && !state.paused) {
      if (w.auto) playerFire();
      else if (firingEdge) playerFire();
    }
    firingEdge = false;
  }
  // Bots (only while live; frozen at spawn during buy)
  if (state.phase === PHASE.LIVE) {
    bots.step(dt, {
      player, state,
      botFire,
      onDefused: () => rounds.endRound(false, 'Bom berhasil di-defuse musuh.'),
    });
    state.alive = aliveCounts();
  }
  combat.step(dt, state, player, onDamage);
  // Flash decay (single field: state.flash)
  if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 0.5);
  // Prune old noises
  if (state.noises.length > 8) state.noises.splice(0, state.noises.length - 8);
  // HUD
  hud.update(state, player, state.alive);
  hud.setCrosshair(player.spread() * 900);
  hud.flash(state.flash || 0);
  viewmodel.setKind(player.weapon().kind);
  viewmodel.step(dt, player.moving, player.ads, state.time, player.crouched, player.sprinting);
  // Mid-pier sodium lamp flickers.
  map.lampFlicker.intensity = 90 + Math.sin(state.time * 7) * 14 + Math.sin(state.time * 13.7) * 8;
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (!G.frozen && !state.paused) {
    accumulator += dt;
    let n = 0;
    while (accumulator >= FIXED && n < 5) { stepSim(FIXED); accumulator -= FIXED; n += 1; }
    if (accumulator > FIXED * 5) accumulator = 0;
    syncCamera();
  }
  renderer.render(scene, camera);
}

// --- boot -------------------------------------------------------------------
player.reset(0, 26, 0);
for (let i = 0; i < 5; i += 1) {
  bots.spawn('tide', i, SPAWNS.tide[i].x, SPAWNS.tide[i].z);
  bots.spawn('rust', i, SPAWNS.rust[i].x, SPAWNS.rust[i].z);
}
bots.reset(SPAWNS);
state.alive = aliveCounts();
hud.update(state, player, state.alive);
hud.showOverlay('start');
syncCamera();
if (shot) runShot(shot, G);
else requestAnimationFrame(frame);
