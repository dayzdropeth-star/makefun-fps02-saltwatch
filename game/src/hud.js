// HUD: DOM updates only. All reads come from state/player/bots via the getters passed in;
// no game logic here. Crosshair gap is driven by spread, updated by main each frame.
// The stance badge makes crouch visible on screen: JONGKOK = eye lowered, spread x0.55,
// footsteps nearly silent. Plant ring uses the full circle circumference (239) so the
// fill matches the 2.5 s plant time exactly.
const PHASE_BUY = 'buy';
const PLANT_RING_CIRC = 239; // 2 * PI * 38, the SVG circle's dasharray
export function createHud() {
  const $ = (id) => document.getElementById(id);
  const el = {
    health: $('hud-health'), healthBar: $('hud-healthbar'), ammoMag: $('ammo-mag'),
    ammoRes: $('ammo-reserve'), money: $('hud-money'), timer: $('hud-timer'),
    score: $('hud-score'), pipsTide: $('pips-tide'), pipsRust: $('pips-rust'),
    killfeed: $('killfeed'), crosshair: $('crosshair'), hitmarker: $('hitmarker'),
    vignette: $('dmg-vignette'), dmgDir: $('dmg-dir'), bombTimer: $('bomb-timer'),
    plantRing: $('plant-ring'), plantFill: $('plant-fill'), plantLabel: $('plant-label'),
    overlay: $('overlay'), overlayTitle: $('overlay-title'), overlayCopy: $('overlay-copy'),
    playBtn: $('play'), banner: $('round-banner'), bannerTitle: $('banner-title'),
    bannerSub: $('banner-sub'), buyMenu: $('buy-menu'), buyList: $('buy-list'),
    buyMoney: $('buy-money'), flash: $('flash-overlay'), weaponName: $('hud-weapon'),
    grenades: $('hud-grenades'), hint: $('hud-hint'), stance: $('hud-stance'),
  };
  function pips(container, alive, total, cls) {
    let html = '';
    for (let i = 0; i < total; i += 1) html += `<i class="${cls}${i < alive ? ' on' : ''}"></i>`;
    container.innerHTML = html;
  }
  return {
    el,
    setAmmo(mag, reserve) {
      el.ammoMag.textContent = mag;
      el.ammoRes.textContent = '/ ' + reserve;
      el.ammoMag.parentElement.classList.toggle('empty', mag === 0);
    },
    setWeapon(name, grenades) {
      el.weaponName.textContent = name;
      el.grenades.textContent = `Frag ${grenades.FRAG} · Flash ${grenades.FLASH}`;
    },
    update(s, player, alive) {
      el.health.textContent = Math.max(0, Math.ceil(player.hp));
      el.healthBar.style.width = Math.max(0, player.hp) + '%';
      el.healthBar.classList.toggle('low', player.hp <= 30);
      el.money.textContent = '$' + s.money;
      const t = Math.max(0, Math.ceil(s.phase === PHASE_BUY ? s.buyTime : s.roundTime));
      el.timer.textContent = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
      el.timer.classList.toggle('urgent', t <= 15 && s.phase === 'live');
      el.score.textContent = `TIDE ${s.wins} — ${s.losses} RUST · Ronde ${s.round}`;
      pips(el.pipsTide, alive.tide, 5, 'pip tide');
      pips(el.pipsRust, alive.rust, 5, 'pip rust');
      this.setAmmo(player.mag, player.reserve);
      this.setWeapon(player.weapon().name, player.grenades);
      // Stance badge: crouch and sprint are shown, standing still is not.
      if (player.crouched) {
        el.stance.hidden = false;
        el.stance.textContent = 'JONGKOK · SPREAD −45% · LANGKAH SUNYI';
      } else if (player.sprinting) {
        el.stance.hidden = false;
        el.stance.textContent = 'SPRINT · SPREAD +180% · BERISIK';
      } else el.stance.hidden = true;
      const b = s.bomb;
      if (b.status === 'planted') {
        el.bombTimer.hidden = false;
        el.bombTimer.textContent = 'BOM ' + Math.ceil(b.fuse) + 's · ' + (b.site === 'A' ? 'Crane Yard' : 'Cold Store');
        el.bombTimer.classList.toggle('urgent', b.fuse <= 10);
      } else el.bombTimer.hidden = true;
      if (b.status === 'idle' && b.plantProgress > 0) {
        el.plantRing.hidden = false;
        el.plantFill.style.strokeDashoffset = String(PLANT_RING_CIRC * (1 - b.plantProgress / 2.5));
        el.plantLabel.textContent = 'MEMASANG BOM…';
      } else el.plantRing.hidden = true;
    },
    setCrosshair(spreadPx) {
      const g = Math.round(4 + spreadPx);
      el.crosshair.style.setProperty('--gap', g + 'px');
    },
    hitmarker(kill) {
      el.hitmarker.classList.add('on');
      el.hitmarker.classList.toggle('kill', kill);
      setTimeout(() => el.hitmarker.classList.remove('on'), kill ? 350 : 140);
    },
    damage(fromAngle) {
      el.vignette.classList.add('on');
      el.dmgDir.style.transform = `translate(-50%,-50%) rotate(${fromAngle}rad)`;
      el.dmgDir.classList.add('on');
      setTimeout(() => { el.vignette.classList.remove('on'); el.dmgDir.classList.remove('on'); }, 450);
    },
    feed(html) {
      const d = document.createElement('div');
      d.innerHTML = html;
      el.killfeed.prepend(d);
      while (el.killfeed.children.length > 5) el.killfeed.lastChild.remove();
      setTimeout(() => d.remove(), 6000);
    },
    flash(amount) { el.flash.style.opacity = String(Math.min(1, amount)); },
    showOverlay(kind, copy) {
      el.overlay.hidden = false;
      if (kind === 'start') {
        el.overlayTitle.textContent = 'SALTWATCH';
        el.overlayCopy.innerHTML = copy || 'Tactical FPS 5v5 di Salt Dock. Pasang bom di Crane Yard atau Cold Store — atau habisi semua Rust.';
        el.playBtn.textContent = 'Klik untuk main';
      } else if (kind === 'paused') {
        el.overlayTitle.textContent = 'Jeda';
        el.overlayCopy.textContent = 'Klik untuk lanjut.';
        el.playBtn.textContent = 'Lanjutkan';
      } else if (kind === 'match') {
        el.overlayTitle.textContent = copy.title;
        el.overlayCopy.textContent = copy.text;
        el.playBtn.textContent = 'Main lagi';
      }
    },
    hideOverlay() { el.overlay.hidden = true; },
    banner(won, reason, sub, sticky = false) {
      el.banner.hidden = false;
      el.bannerTitle.textContent = won ? 'RONDE MENANG' : 'RONDE KALAH';
      el.bannerTitle.className = won ? 'win' : 'lose';
      el.bannerSub.textContent = reason + (sub ? ' — ' + sub : '');
      // Screenshot poses pass sticky so the banner is still up when captured.
      if (!sticky) setTimeout(() => { el.banner.hidden = true; }, 3600);
    },
    showBuy(money, list, grenades) {
      el.buyMenu.hidden = false;
      el.buyMoney.textContent = '$' + money;
      el.buyList.innerHTML = list.map((w, i) => `
        <button class="buy-item" data-w="${w.id}">
          <b>${i + 1}. ${w.name}</b><span>${w.kind} · ${w.damage} dmg · ${w.mag} peluru</span>
          <em>${w.price === 0 ? 'GRATIS' : '$' + w.price}</em>
        </button>`).join('') + grenades.map((g) => `
        <button class="buy-item" data-g="${g.id}">
          <b>${g.name}</b><span>granat · tekan 3/4 untuk lempar</span><em>$${g.price}</em>
        </button>`).join('');
    },
    hideBuy() { el.buyMenu.hidden = true; },
    hint(text) { el.hint.textContent = text; },
  };
}
