// Player: WASD + sprint/crouch/jump, mouse look, firing, reload, bloom. Fixed-step only;
// rendering reads position/yaw/pitch. No allocations in step().
//
// CROUCH (the fix vs the old build): the old code snapped the eye between 1.62 and
// 1.08 in one tick. Here eyeHeight is a smoothed value that lerps toward the stance
// target at EYE_LERP_RATE, so the camera visibly dips and rises over ~0.15 s, the
// viewmodel bob quiets down, and the HUD stance badge + crosshair gap show it too.
// Crouch also halves the footstep noise radius and tightens spread (weapons.js).
//
// ACCELERATION (the fix vs the old build): the old code added a flat accel then
// multiplied velocity by a harsh per-tick damp, which masked the ramp. Here velocity
// chases the wanted velocity exponentially — ACCEL_GROUND while a key is held,
// DECEL_GROUND when it is released — so speed ramps up over ~0.35 s and the player
// slides ~0.25 s after letting go. Air control is deliberately weak (ACCEL_AIR).
import * as THREE from 'three';
import { CFG } from './state.js';
import { WEAPONS, currentSpread } from './weapons.js';
import { collideCircle } from './map.js';

export function createPlayer(colliders) {
  const pos = new THREE.Vector3(0, 0, 26);
  const vel = new THREE.Vector3();
  const p = {
    pos, vel,
    yaw: 0, pitch: 0, hp: CFG.PLAYER_HP, alive: true,
    crouched: false, onGround: true, vy: 0,
    // Smooth eye height: the camera reads this, never the stance constant directly.
    eyeHeight: CFG.EYE_STAND,
    weaponId: 'P7', mag: WEAPONS.P7.mag, reserve: WEAPONS.P7.reserve,
    bloom: 0, recoilPitch: 0, fireCooldown: 0, reloadTimer: 0, reloading: false,
    ads: false, sprinting: false, moving: false, speed2d: 0,
    grenades: { FRAG: 0, FLASH: 0 },
    stepPhase: 0, lastStepAt: 0,
    eye() { return p.eyeHeight; },
  };
  p.reset = function (x, z, yaw) {
    pos.set(x, 0, z); vel.set(0, 0, 0);
    p.yaw = yaw; p.pitch = 0; p.hp = CFG.PLAYER_HP; p.alive = true;
    p.crouched = false; p.vy = 0; p.onGround = true;
    p.eyeHeight = CFG.EYE_STAND;
    p.weaponId = 'P7'; p.mag = WEAPONS.P7.mag; p.reserve = WEAPONS.P7.reserve;
    p.bloom = 0; p.recoilPitch = 0; p.fireCooldown = 0; p.reloadTimer = 0; p.reloading = false;
    p.grenades = { FRAG: 0, FLASH: 0 };
  };
  p.weapon = function () { return WEAPONS[p.weaponId]; };
  p.equip = function (id) {
    const w = WEAPONS[id]; if (!w) return;
    p.weaponId = id; p.mag = w.mag; p.reserve = w.reserve;
    p.reloading = false; p.reloadTimer = 0; p.bloom = 0;
  };
  p.startReload = function () {
    const w = p.weapon();
    if (p.reloading || p.mag >= w.mag || p.reserve <= 0 || !p.alive) return false;
    p.reloading = true; p.reloadTimer = w.reloadTime; return true;
  };
  p.look = function (dx, dy) {
    p.yaw -= dx * 0.0022;
    p.pitch -= dy * 0.0022;
    p.pitch = Math.max(-1.45, Math.min(1.45, p.pitch));
  };
  // ctx: { audio, time, state } — state is where footstep noises are published.
  p.step = function (dt, keys, ctx) {
    if (!p.alive) return;
    const { audio, time, state } = ctx;
    const w = p.weapon();
    // Timers
    if (p.fireCooldown > 0) p.fireCooldown -= dt;
    if (p.reloading) {
      p.reloadTimer -= dt;
      if (p.reloadTimer <= 0) {
        const need = w.mag - p.mag, take = Math.min(need, p.reserve);
        p.mag += take; p.reserve -= take; p.reloading = false;
      }
    }
    // Bloom decays when not firing.
    p.bloom = Math.max(0, p.bloom - dt * 0.05);
    p.recoilPitch *= Math.pow(0.0001, dt); // fast settle
    // Stance: Ctrl / C toggles crouch. Eye height chases the stance target smoothly.
    p.crouched = keys.has('ControlLeft') || keys.has('KeyC');
    const eyeTarget = p.crouched ? CFG.EYE_CROUCH : CFG.EYE_STAND;
    p.eyeHeight += (eyeTarget - p.eyeHeight) * Math.min(1, CFG.EYE_LERP_RATE * dt);
    // Movement input
    const f = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
    const r = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    const wantSprint = keys.has('ShiftLeft') && f > 0 && !p.crouched;
    p.sprinting = wantSprint;
    const speed = p.crouched ? CFG.CROUCH_SPEED : wantSprint ? CFG.SPRINT_SPEED : CFG.WALK_SPEED;
    const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
    // Forward is -z rotated by yaw; right is +x rotated.
    let mx = (-sy * f + cy * r), mz = (-cy * f - sy * r);
    const ml = Math.hypot(mx, mz);
    if (ml > 0) { mx /= ml; mz /= ml; }
    // Acceleration: velocity chases the wanted velocity. Holding a key ramps up,
    // releasing it slides to a stop — the rate differs on ground, in air, and while
    // decelerating, so each feels different under the fingers.
    const hasInput = ml > 0;
    const rate = !p.onGround ? CFG.ACCEL_AIR : hasInput ? CFG.ACCEL_GROUND : CFG.DECEL_GROUND;
    const k = Math.min(1, rate * dt);
    vel.x += (mx * speed - vel.x) * k;
    vel.z += (mz * speed - vel.z) * k;
    pos.x += vel.x * dt; pos.z += vel.z * dt;
    collideCircle(colliders, pos, CFG.PLAYER_RADIUS);
    p.speed2d = Math.hypot(vel.x, vel.z);
    p.moving = p.speed2d > 0.8;
    // Jump + gravity
    if (keys.has('Space') && p.onGround) { p.vy = CFG.JUMP_VEL; p.onGround = false; }
    if (!p.onGround) {
      p.vy -= CFG.GRAVITY * dt; pos.y += p.vy * dt;
      if (pos.y <= 0) { pos.y = 0; p.vy = 0; p.onGround = true; }
    }
    // Footsteps: sound + a noise event bots can hear. Sprinting is loud, walking is
    // audible nearby, crouching is nearly silent — stance is a stealth choice.
    if (p.moving && p.onGround && time - p.lastStepAt > (p.sprinting ? 0.32 : 0.48)) {
      p.lastStepAt = time;
      if (audio) audio.step();
      if (state) {
        const radius = p.crouched ? CFG.NOISE_STEP_CROUCH : p.sprinting ? CFG.NOISE_STEP_SPRINT : CFG.NOISE_STEP_WALK;
        state.noises.push({ x: pos.x, z: pos.z, radius, t: time, kind: 'step' });
      }
    }
  };
  p.spread = function () {
    return currentSpread(p.weapon(), p.bloom, p.moving, p.crouched, p.ads, p.sprinting);
  };
  p.canFire = function () {
    return p.alive && !p.reloading && p.fireCooldown <= 0 && p.mag > 0;
  };
  p.onFired = function (rng) {
    const w = p.weapon();
    p.mag -= 1; p.fireCooldown = w.fireInterval;
    p.bloom = Math.min(w.maxBloom, p.bloom + w.bloomPerShot);
    p.recoilPitch += w.recoil;
    p.pitch += w.recoil * 0.55; // kick up, player pulls back down
    p.yaw += (rng.next() * 2 - 1) * w.recoil * 0.25;
  };
  p.eyePos = function (out) { return out.set(pos.x, pos.y + p.eye() + p.recoilPitch * 0.4, pos.z); };
  return p;
}
