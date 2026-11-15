// Round flow, economy, buy menu and the bomb (plant / fuse / defuse).
// Pure logic over state + callbacks into main (spawn, banners, sounds).
import { CFG, PHASE, resetRoundState } from './state.js';
import { WEAPONS, GRENADES, WEAPON_ORDER } from './weapons.js';
import { SITES } from './map.js';

export function createRounds(state, hooks) {
  const r = {
    // hooks: onRoundStart(), onRoundEnd(won, reason), onMatchEnd(winner), onMoney(), onBuy()
    buyOpen: false,
    startBuyPhase() {
      state.phase = PHASE.BUY;
      state.buyTime = CFG.BUY_TIME;
      r.buyOpen = true;
      hooks.onBuyPhase();
    },
    startRound() {
      resetRoundState(state);
      state.phase = PHASE.LIVE;
      r.buyOpen = false;
      hooks.onRoundStart();
    },
    endRound(won, reason) {
      if (state.phase !== PHASE.LIVE) return;
      state.phase = PHASE.ROUND_END;
      state.roundEnd = { won, reason };
      state.money += won ? CFG.WIN_REWARD : CFG.LOSS_REWARD;
      if (won) state.wins += 1; else state.losses += 1;
      hooks.onRoundEnd(won, reason);
      if (state.wins >= CFG.WIN_ROUNDS || state.losses >= CFG.WIN_ROUNDS) {
        state.matchWinner = won ? 'tide' : 'rust';
        state.phase = PHASE.MATCH_END;
        hooks.onMatchEnd(state.matchWinner);
      } else {
        state.round += 1;
      }
    },
    // Called every fixed step while LIVE.
    step(dt) {
      if (state.phase !== PHASE.LIVE) return;
      state.roundTime -= dt;
      const b = state.bomb;
      if (b.status === 'planted') {
        b.fuse -= dt;
        if (b.fuse <= 0) { b.status = 'exploded'; r.endRound(true, 'Bom meledak — Site hancur!'); }
      }
      if (state.roundTime <= 0) {
        state.roundTime = 0;
        r.endRound(b.status === 'planted' ? true : false,
          b.status === 'planted' ? 'Bom meledak — Site hancur!' : 'Waktu habis — bom tidak terpasang.');
        if (b.status === 'planted') b.status = 'exploded';
      }
    },
    // Plant progress while the player holds E near a site.
    plantStep(dt, nearSite, holdingE) {
      const b = state.bomb;
      if (state.phase !== PHASE.LIVE || b.status !== 'idle') return;
      if (nearSite && holdingE) {
        b.plantProgress += dt;
        b.site = nearSite;
        if (b.plantProgress >= CFG.PLANT_TIME) {
          b.status = 'planted'; b.fuse = CFG.BOMB_FUSE;
          b.x = SITES[nearSite].x; b.z = SITES[nearSite].z;
          b.plantProgress = 0;
          state.money += CFG.PLANT_REWARD;
          hooks.onPlanted(nearSite);
        }
      } else {
        b.plantProgress = Math.max(0, b.plantProgress - dt * 2);
      }
    },
    nearSite(x, z) {
      for (const [key, s] of Object.entries(SITES)) {
        if (Math.hypot(x - s.x, z - s.z) < s.r) return key;
      }
      return null;
    },
    tryBuy(id) {
      if (state.phase !== PHASE.BUY && state.phase !== PHASE.LIVE) return { ok: false, why: 'Bukan fase beli' };
      if (state.phase === PHASE.LIVE) return { ok: false, why: 'Ronde sudah berjalan' };
      const w = WEAPONS[id];
      if (!w) return { ok: false, why: 'Senjata tidak ada' };
      if (state.money < w.price) return { ok: false, why: 'Uang tidak cukup' };
      state.money -= w.price;
      hooks.onBuy(w);
      return { ok: true, weapon: w };
    },
    tryBuyGrenade(id) {
      if (state.phase !== PHASE.BUY) return { ok: false, why: 'Bukan fase beli' };
      const g = GRENADES[id];
      if (!g) return { ok: false, why: 'Granat tidak ada' };
      if (state.money < g.price) return { ok: false, why: 'Uang tidak cukup' };
      state.money -= g.price;
      hooks.onBuyGrenade(g);
      return { ok: true, grenade: g };
    },
    buyList() {
      return WEAPON_ORDER.map((id) => WEAPONS[id]);
    },
  };
  return r;
}
