// Procedural canvas textures only — no external art.
// Palette: night dock — navy asphalt, cold steel, amber sodium lamps, teal paint,
// rust-red containers. One palette across ground, walls, crates and markers so the
// scene reads at a glance: dark blue-grey world, warm lamp pools, teal = Tide.
import * as THREE from 'three';

function canvasTex(size, draw, rx = 1, ry = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function speckle(ctx, s, n, colors, aMin = 0.05, aMax = 0.22, rMax = 3) {
  for (let i = 0; i < n; i += 1) {
    ctx.fillStyle = colors[(Math.random() * colors.length) | 0];
    ctx.globalAlpha = aMin + Math.random() * (aMax - aMin);
    const r = 0.5 + Math.random() * rMax;
    ctx.fillRect(Math.random() * s, Math.random() * s, r, r);
  }
  ctx.globalAlpha = 1;
}
function cracks(ctx, s, n, color) {
  ctx.strokeStyle = color; ctx.globalAlpha = 0.35; ctx.lineWidth = 1;
  for (let i = 0; i < n; i += 1) {
    let x = Math.random() * s, y = Math.random() * s;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 5; k += 1) { x += (Math.random() - 0.5) * 40; y += (Math.random() - 0.5) * 40; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export function makeTextures() {
  const asphalt = canvasTex(256, (ctx, s) => {
    ctx.fillStyle = '#5d6d7c'; ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, 3000, ['#3d4a56', '#55636f', '#35424e', '#5f6e7c'], 0.06, 0.25, 2);
    cracks(ctx, s, 8, '#2c3841');
    // Faint painted lane dashes, worn by tyres.
    ctx.fillStyle = 'rgba(217,201,168,0.35)';
    ctx.fillRect(s / 2 - 3, 0, 6, 60); ctx.fillRect(s / 2 - 3, 128, 6, 60);
  }, 10, 10);
  const concrete = canvasTex(256, (ctx, s) => {
    ctx.fillStyle = '#7d8a92'; ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, 2600, ['#6b7880', '#8b98a0', '#5d6a72', '#98a4ac']);
    cracks(ctx, s, 7, '#4e5a62');
    ctx.strokeStyle = '#5d6a72'; ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, s - 2, s - 2);
  }, 8, 8);
  // Corrugated container steel, teal paint with rust streaks.
  const container = canvasTex(256, (ctx, s) => {
    ctx.fillStyle = '#1f6a60'; ctx.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 16) {
      ctx.fillStyle = (x / 16) % 2 ? '#23756b' : '#1a5a52';
      ctx.fillRect(x, 0, 16, s);
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(x, 0, 2, s);
    }
    speckle(ctx, s, 900, ['#8a4a22', '#5d3a28', '#2fae9e'], 0.08, 0.3, 4);
  }, 2, 2);
  // Rust-red container steel for the Rust side / B site.
  const containerRust = canvasTex(256, (ctx, s) => {
    ctx.fillStyle = '#7a3a20'; ctx.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 16) {
      ctx.fillStyle = (x / 16) % 2 ? '#874326' : '#6b321b';
      ctx.fillRect(x, 0, 16, s);
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(x, 0, 2, s);
    }
    speckle(ctx, s, 900, ['#4a2a18', '#a85a30', '#c2491e'], 0.08, 0.3, 4);
  }, 2, 2);
  const metal = canvasTex(256, (ctx, s) => {
    ctx.fillStyle = '#4a5560'; ctx.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 16) {
      ctx.fillStyle = (x / 16) % 2 ? '#525e68' : '#414c55';
      ctx.fillRect(x, 0, 16, s);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x, 0, 2, s);
    }
    speckle(ctx, s, 900, ['#8a5a2a', '#333d44', '#6a7a84'], 0.08, 0.3, 4);
  }, 2, 2);
  const hazard = canvasTex(256, (ctx, s) => {
    ctx.fillStyle = '#d8a13a'; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#14181c';
    for (let i = -s; i < s * 2; i += 64) {
      ctx.beginPath(); ctx.moveTo(i, s); ctx.lineTo(i + 32, 0); ctx.lineTo(i + 64, 0); ctx.lineTo(i + 32, s); ctx.closePath(); ctx.fill();
    }
    speckle(ctx, s, 500, ['#8a6d1d', '#000'], 0.1, 0.3, 3);
  }, 4, 1);
  const crate = canvasTex(256, (ctx, s) => {
    ctx.fillStyle = '#4a3f2c'; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = '#2e2618'; ctx.lineWidth = 10; ctx.strokeRect(6, 6, s - 12, s - 12);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s, s); ctx.moveTo(s, 0); ctx.lineTo(0, s); ctx.stroke();
    speckle(ctx, s, 1200, ['#3a2f1e', '#5d4c33', '#241c10'], 0.08, 0.25, 3);
  });
  const siteA = canvasTex(256, (ctx, s) => {
    ctx.fillStyle = '#1c2833'; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#ffb347'; ctx.font = 'bold 92px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('A', s / 2, s / 2);
    ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 10; ctx.strokeRect(14, 14, s - 28, s - 28);
    speckle(ctx, s, 700, ['#000', '#7a5a22'], 0.1, 0.3, 3);
  });
  const siteB = canvasTex(256, (ctx, s) => {
    ctx.fillStyle = '#1c2833'; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#2fd6c0'; ctx.font = 'bold 92px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('B', s / 2, s / 2);
    ctx.strokeStyle = '#2fd6c0'; ctx.lineWidth = 10; ctx.strokeRect(14, 14, s - 28, s - 28);
    speckle(ctx, s, 700, ['#000', '#1a5a52'], 0.1, 0.3, 3);
  });
  // Night sky: deep blue gradient, stars, a low moon. The horizon band is kept
  // light enough that silhouettes read against it — a night map must stay readable.
  const sky = canvasTex(512, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, '#0a1626'); g.addColorStop(0.5, '#16324a'); g.addColorStop(0.75, '#2a4a66'); g.addColorStop(1, '#5d7f9c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 220; i += 1) {
      ctx.fillStyle = '#dfeaf2'; ctx.globalAlpha = 0.4 + Math.random() * 0.6;
      ctx.fillRect(Math.random() * s, Math.random() * s * 0.55, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;
    // Small moon, kept off the top-centre HUD (timer/score) so it never sits behind text.
    ctx.fillStyle = '#f2ead0'; ctx.beginPath(); ctx.arc(s * 0.84, s * 0.3, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(242,234,208,0.25)'; ctx.beginPath(); ctx.arc(s * 0.84, s * 0.3, 21, 0, Math.PI * 2); ctx.fill();
  });
  return { asphalt, concrete, container, containerRust, metal, hazard, crate, siteA, siteB, sky };
}
