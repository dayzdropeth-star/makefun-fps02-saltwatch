// Salt Dock map: geometry, AABB colliders, waypoints, spawns and bomb sites.
// Coordinates: x east, z south (+z = Tide spawn). Map is ~64 wide (x) by 60 deep (z).
// Lanes: Pier (mid, the long sightline), Crane Alley (west, to Site A), Store Alley
// (east, to Site B). Every lane has low cover so a crouched player can cross it
// without being seen over the crates — crouch cover is part of the layout, not an accident.
import * as THREE from 'three';

export const SITES = {
  A: { name: 'Crane Yard', x: -21, z: -17, r: 5.5 },
  B: { name: 'Cold Store', x: 21, z: -17, r: 5.5 },
};
export const SPAWNS = {
  tide: [{ x: 0, z: 26 }, { x: -6, z: 26 }, { x: 6, z: 26 }, { x: -12, z: 24 }, { x: 12, z: 24 }],
  rust: [{ x: 0, z: -26 }, { x: -8, z: -26 }, { x: 8, z: -26 }, { x: -16, z: -24 }, { x: 16, z: -24 }],
};
// Waypoint graph: nodes on lanes; links are bidirectional indices.
export const WAYPOINTS = [
  { x: 0, z: 26, links: [1] }, { x: 0, z: 14, links: [0, 2, 7, 8] },
  { x: 0, z: 2, links: [1, 3] }, { x: 0, z: -10, links: [2, 4, 9, 10] },
  { x: 0, z: -22, links: [3, 5, 6] }, { x: -21, z: -17, links: [4, 11] },
  { x: 21, z: -17, links: [4, 12] },
  { x: -14, z: 14, links: [1, 9, 11] }, { x: 14, z: 14, links: [1, 10, 12] },
  { x: -14, z: -10, links: [7, 3, 11] }, { x: 14, z: -10, links: [8, 3, 12] },
  { x: -21, z: 2, links: [9, 5, 7] }, { x: 21, z: 2, links: [10, 6, 8] },
];

export function createMap(scene, tex) {
  const colliders = []; // {minX,maxX,minZ,maxZ}
  const shootables = []; // meshes that block bullets
  const mats = {
    ground: new THREE.MeshStandardMaterial({ map: tex.asphalt, roughness: 0.95 }),
    concrete: new THREE.MeshStandardMaterial({ map: tex.concrete, roughness: 0.9 }),
    metal: new THREE.MeshStandardMaterial({ map: tex.metal, roughness: 0.6, metalness: 0.5 }),
    crate: new THREE.MeshStandardMaterial({ map: tex.crate, roughness: 0.85 }),
    container: new THREE.MeshStandardMaterial({ map: tex.container, roughness: 0.7, metalness: 0.35 }),
    containerRust: new THREE.MeshStandardMaterial({ map: tex.containerRust, roughness: 0.7, metalness: 0.35 }),
    hazard: new THREE.MeshStandardMaterial({ map: tex.hazard, roughness: 0.8 }),
    crane: new THREE.MeshStandardMaterial({ color: 0xb97f22, roughness: 0.55, metalness: 0.6, emissive: 0x2a1a05, emissiveIntensity: 0.6 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1c2833, roughness: 0.9 }),
  };
  function box(x, z, w, h, d, mat, y = 0, collide = true) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m); shootables.push(m);
    if (collide) colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    return m;
  }
  function cyl(x, z, r, h, mat, y = 0, collide = true) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 18), mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m); shootables.push(m);
    if (collide) colliders.push({ minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r });
    return m;
  }
  // Ground + night sky dome
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(70, 66), mats.ground);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(120, 24, 12),
    new THREE.MeshBasicMaterial({ map: tex.sky, side: THREE.BackSide, fog: false }));
  scene.add(sky);
  // Perimeter walls
  box(0, -31, 70, 5, 1, mats.concrete); box(0, 31, 70, 5, 1, mats.concrete);
  box(-32, 0, 1, 5, 64, mats.concrete); box(32, 0, 1, 5, 64, mats.concrete);

  // Site A — Crane Yard (west): a gantry crane over stacked teal containers, open front.
  box(-27, -21, 1.2, 11, 1.2, mats.crane); box(-15, -21, 1.2, 11, 1.2, mats.crane);
  const beam = box(-21, -21, 13.2, 1.1, 1.4, mats.crane, 10.4, false);
  beam.castShadow = false;
  box(-24.5, -24, 6, 2.6, 2.6, mats.container);
  box(-24.5, -24, 6, 2.6, 2.6, mats.container, 2.6);
  box(-17.5, -24.5, 5, 2.6, 2.6, mats.containerRust);
  box(-27.5, -14, 1, 3.2, 8, mats.metal); box(-14.5, -20, 7, 3.2, 1, mats.metal);
  const siteAMark = new THREE.Mesh(new THREE.PlaneGeometry(7, 7),
    new THREE.MeshBasicMaterial({ map: tex.siteA, transparent: true }));
  siteAMark.rotation.x = -Math.PI / 2; siteAMark.position.set(-21, 0.06, -14); scene.add(siteAMark);
  const lampA = new THREE.PointLight(0xffb347, 130, 34, 1.8);
  lampA.position.set(-21, 4.5, -17); scene.add(lampA);

  // Site B — Cold Store (east): rust containers + a low warehouse block, open front.
  box(19, -24, 6, 2.6, 2.6, mats.containerRust);
  box(19, -24, 6, 2.6, 2.6, mats.containerRust, 2.6);
  box(25, -24, 5, 2.6, 2.6, mats.container);
  box(15.5, -14, 1, 2.6, 7, mats.metal); box(27, -14, 1, 2.6, 7, mats.metal);
  box(21, -26.5, 10, 4.5, 1.2, mats.concrete);
  const siteBMark = new THREE.Mesh(new THREE.PlaneGeometry(7, 7),
    new THREE.MeshBasicMaterial({ map: tex.siteB, transparent: true }));
  siteBMark.rotation.x = -Math.PI / 2; siteBMark.position.set(21, 0.06, -14); scene.add(siteBMark);
  const lampB = new THREE.PointLight(0x2fd6c0, 110, 32, 1.8);
  lampB.position.set(21, 4.5, -17); scene.add(lampB);

  // Pier (mid): staggered low cover on the long sightline — crouch-height (1.1–1.2),
  // so a crouched player hides behind them and a standing player sees over.
  box(-3.5, 8, 1.2, 1.2, 4, mats.crate); box(3.5, -2, 1.2, 1.2, 4, mats.crate);
  box(0, -8, 5, 1.1, 1.2, mats.crate);
  box(-5, 2, 2.4, 1.1, 1.2, mats.container); box(5, -14, 2.4, 1.1, 1.2, mats.containerRust);
  // Crane Alley (west) and Store Alley (east) cover
  box(-14, 6, 4, 1.4, 1.2, mats.crate); box(-14, -4, 1.2, 1.4, 5, mats.crate);
  box(14, 6, 4, 1.4, 1.2, mats.crate); box(14, -4, 1.2, 1.4, 5, mats.crate);
  box(-8, 20, 5, 1.2, 1.2, mats.crate); box(8, 20, 5, 1.2, 1.2, mats.crate);
  // Barrels + hazard strip at mid
  cyl(-6, -10, 0.8, 1.6, mats.metal); cyl(-4.6, -10.6, 0.8, 1.6, mats.metal); cyl(6, 12, 0.8, 1.6, mats.metal);
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(12, 1.2),
    new THREE.MeshBasicMaterial({ map: tex.hazard }));
  strip.rotation.x = -Math.PI / 2; strip.position.set(0, 0.05, 2); scene.add(strip);

  // Sodium lamps along the pier; the mid one flickers (main.js modulates it).
  function lamp(x, z) {
    const pole = cyl(x, z, 0.09, 4.6, mats.dark, 0, false);
    pole.castShadow = false;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffc266 }));
    head.position.set(x, 4.7, z); scene.add(head);
    const light = new THREE.PointLight(0xffb347, 90, 28, 1.9);
    light.position.set(x, 4.4, z); scene.add(light);
    return light;
  }
  lamp(-2.5, 14); const lampFlicker = lamp(2.5, -2); lamp(-2.5, -16);
  // Moon + cold ambient. The moon is the key light: strong enough that the dock
  // reads at a glance, cool blue so the amber lamps pool warm against it.
  const moon = new THREE.DirectionalLight(0xbfd4e6, 4.0);
  moon.position.set(-28, 42, -18); moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -40; moon.shadow.camera.right = 40;
  moon.shadow.camera.top = 40; moon.shadow.camera.bottom = -40;
  moon.shadow.camera.far = 120; scene.add(moon);
  scene.add(new THREE.HemisphereLight(0x4a6a86, 0x24323e, 1.4));
  scene.fog = new THREE.Fog(0x1e3247, 60, 150);
  return { colliders, shootables, lampFlicker };
}

// Resolve a circle (x,z,radius) against AABBs: push out, return whether it hit.
export function collideCircle(colliders, p, radius) {
  let hit = false;
  for (let i = 0; i < colliders.length; i += 1) {
    const c = colliders[i];
    const cx = Math.max(c.minX, Math.min(p.x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(p.z, c.maxZ));
    const dx = p.x - cx, dz = p.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        p.x = cx + (dx / d) * radius; p.z = cz + (dz / d) * radius;
      } else {
        // Inside the box: push out along the smallest penetration axis.
        const pl = p.x - c.minX, pr = c.maxX - p.x, pt = p.z - c.minZ, pb = c.maxZ - p.z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) p.x = c.minX - radius; else if (m === pr) p.x = c.maxX + radius;
        else if (m === pt) p.z = c.minZ - radius; else p.z = c.maxZ + radius;
      }
    }
  }
  // Clamp to dock bounds.
  p.x = Math.max(-30.5, Math.min(30.5, p.x));
  p.z = Math.max(-29.5, Math.min(29.5, p.z));
  return hit;
}
export function nearestWaypoint(x, z) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < WAYPOINTS.length; i += 1) {
    const dx = WAYPOINTS[i].x - x, dz = WAYPOINTS[i].z - z, d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
// BFS next waypoint from `from` toward `to` (indices). Returns the next node index.
export function nextWaypoint(from, to, rng) {
  if (from === to) return to;
  const prev = new Array(WAYPOINTS.length).fill(-1);
  const q = [from]; prev[from] = from;
  while (q.length) {
    const cur = q.shift();
    if (cur === to) break;
    for (const n of WAYPOINTS[cur].links) {
      if (prev[n] === -1) { prev[n] = cur; q.push(n); }
    }
  }
  if (prev[to] === -1) return to;
  let cur = to;
  while (prev[cur] !== from && prev[cur] !== cur) cur = prev[cur];
  return cur;
}
