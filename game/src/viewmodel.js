// First-person weapon viewmodel: simple box-built guns, one per weapon kind, plus a
// muzzle-flash quad. Reused meshes; kick and sway are applied per frame, no allocation.
// Crouch quiets the sway (a crouched shooter holds the gun steadier), sprinting
// exaggerates it — the viewmodel shows the stance, not just the crosshair.
import * as THREE from 'three';

const KINDS = {
  pistol: { body: [0.07, 0.1, 0.3], barrel: [0.05, 0.05, 0.16], grip: [0.06, 0.12, 0.08], color: 0x2c2c30, accent: 0x2fd6c0 },
  shotgun: { body: [0.09, 0.11, 0.62], barrel: [0.07, 0.07, 0.5], grip: [0.07, 0.13, 0.09], color: 0x4a2f1c, accent: 0x222222 },
  smg: { body: [0.08, 0.12, 0.42], barrel: [0.06, 0.06, 0.22], grip: [0.06, 0.13, 0.08], color: 0x30343a, accent: 0x2fae9e },
  rifle: { body: [0.09, 0.12, 0.58], barrel: [0.06, 0.06, 0.34], grip: [0.07, 0.14, 0.09], color: 0x3a2e22, accent: 0xffb347 },
  sniper: { body: [0.09, 0.13, 0.72], barrel: [0.05, 0.05, 0.5], grip: [0.07, 0.14, 0.09], color: 0x24262a, accent: 0x5a6a7a },
};

export function createViewmodel(camera) {
  const group = new THREE.Group();
  const meshes = {};
  for (const [kind, d] of Object.entries(KINDS)) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: d.color, roughness: 0.55, metalness: 0.5, emissive: 0x1c1c1c });
    const acc = new THREE.MeshStandardMaterial({ color: d.accent, roughness: 0.4, metalness: 0.6, emissive: 0x1c1c1c });
    const body = new THREE.Mesh(new THREE.BoxGeometry(...d.body), mat); g.add(body);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(...d.barrel), acc);
    barrel.position.set(0, 0.02, -d.body[2] / 2 - d.barrel[2] / 2 + 0.05); g.add(barrel);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(...d.grip), mat);
    grip.position.set(0, -0.1, 0.12); grip.rotation.x = 0.3; g.add(grip);
    if (kind === 'sniper' || kind === 'rifle') {
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 10), acc);
      scope.rotation.x = Math.PI / 2; scope.position.set(0, 0.09, -0.05); g.add(scope);
    }
    g.visible = false;
    group.add(g); meshes[kind] = g;
  }
  // Muzzle flash: additive plane at the barrel tip.
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xffc266, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), flashMat);
  flash.position.set(0, 0.02, -0.55); group.add(flash);
  group.position.set(0.28, -0.26, -0.55);
  group.scale.setScalar(0.62);
  camera.add(group);
  const vm = {
    // Start with no kind selected so the first setKind() actually applies
    // visibility; all meshes begin hidden and setKind reveals the active one.
    kind: '', kick: 0, flashT: 0, swayT: 0,
    setKind(kind) {
      if (vm.kind === kind) return;
      vm.kind = kind;
      for (const [k, g] of Object.entries(meshes)) g.visible = k === kind;
    },
    fire() { vm.kick = 1; vm.flashT = 0.06; },
    step(dt, moving, ads, time, crouched = false, sprinting = false) {
      vm.kick = Math.max(0, vm.kick - dt * 7);
      vm.flashT = Math.max(0, vm.flashT - dt);
      flashMat.opacity = vm.flashT > 0 ? 0.9 : 0;
      flash.rotation.z = time * 9;
      // Sway amplitude: crouched is steadiest, sprinting is wildest.
      const s = crouched ? 0.003 : sprinting ? 0.02 : moving ? 0.012 : 0.005;
      vm.swayT += dt * (moving ? 9 : 3);
      const bx = 0.28 + Math.sin(vm.swayT) * s;
      const by = -0.26 + Math.cos(vm.swayT * 0.8) * s * 0.7;
      const target = ads ? { x: 0, y: -0.19, z: -0.42 } : { x: bx, y: by, z: -0.55 };
      group.position.set(target.x, target.y, target.z + vm.kick * 0.09);
      group.rotation.x = vm.kick * 0.12;
    },
  };
  vm.setKind('pistol');
  return vm;
}
