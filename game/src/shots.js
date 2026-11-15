// Deterministic screenshot poses: ?shot=start|play|buy|end&seed=N.
// Each pose sets a fixed state, steps the sim a fixed number of ticks, renders twice,
// then freezes and sets window.__shotReady for the capture harness.
import { PHASE } from './state.js';

export function runShot(shot, G) {
  const { state, player, bots, rounds, hud, renderer, scene, camera, syncCamera } = G;
  const settle = (n) => { for (let i = 0; i < n; i += 1) G.fixedStep(1 / 60); };
  hud.hideOverlay(); hud.hideBuy();
  state.phase = PHASE.LIVE;
  rounds.startRound();
  player.reset(0, 22, 0); // face north down the Pier (yaw 0 looks -z)
  bots.reset(G.spawns);
  if (shot === 'start') {
    player.reset(-6, 24, -0.5);
    player.pitch = 0.05;
    settle(30);
    syncCamera();
    hud.showOverlay('start');
  } else if (shot === 'play') {
    // Mid-round: player mid-Pier aiming at a visible Rust on the lane, while a second
    // Rust bot investigates a noise nearby — its "?" marker shows the hearing system.
    player.reset(0, 12, 0);
    const foe = bots.list.find((b) => b.team === 'rust');
    foe.pos.set(0, 0, -6); foe.mesh.position.set(0, 0, -6);
    foe.state = 'hold';
    // Second Rust bot investigates a noise behind the Cold Store stack: the 5.2 m
    // containers block its line of sight to the player, so it shows "?" — the
    // hearing system, visible in the screenshot, not just in the code.
    const listener = bots.list.filter((b) => b.team === 'rust')[1];
    listener.pos.set(21, 0, -28); listener.mesh.position.set(21, 0, -28);
    listener.state = 'investigate';
    listener.investigate = { x: 21, z: -8, t: 3 };
    listener.yaw = 0; // turned south, toward the noise it heard
    const ally = bots.list.find((b) => b.team === 'tide');
    ally.pos.set(-3, 0, 16); ally.mesh.position.set(-3, 0, 16);
    settle(20);
    G.aimAt(0, 1.4, -6);
    syncCamera();
    hud.update(state, player, state.alive);
    hud.setCrosshair(6);
  } else if (shot === 'buy') {
    state.phase = PHASE.BUY; state.buyTime = 12;
    player.reset(0, 22, 0.3);
    settle(10);
    syncCamera();
    hud.showBuy(state.money, rounds.buyList(), [{ id: 'FRAG', name: 'Salt Frag', price: 300 }, { id: 'FLASH', name: 'Strobe Flash', price: 200 }]);
    hud.update(state, player, state.alive);
  } else { // end: round just won by elimination
    for (const b of bots.list) if (b.team === 'rust') { b.hp = 0; b.alive = false; b.mesh.visible = false; }
    state.alive.rust = 0;
    player.reset(0, 8, 0);
    settle(10);
    G.aimAt(0, 1.4, -10);
    syncCamera();
    state.wins = 1;
    hud.banner(true, 'Semua musuh tereliminasi', 'Tide memimpin 1 — 0', true);
    hud.update(state, player, state.alive);
  }
  // Rifle in hand for every pose (reset() restores the pistol, so equip after).
  player.equip('AR61');
  hud.update(state, player, state.alive);
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    syncCamera();
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) { window.__shotReady = true; G.frozen = true; }
  }
  requestAnimationFrame(paint);
}
