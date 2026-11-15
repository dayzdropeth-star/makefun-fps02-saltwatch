// Central game state + tuning constants. One place owns round, economy and bomb state;
// per-frame entity data lives in player.js / bots.js and is mirrored here only as counts.
export const CFG = {
  ROUND_TIME: 100, BUY_TIME: 15, WIN_ROUNDS: 5, BOMB_FUSE: 45,
  PLANT_TIME: 2.5, DEFUSE_TIME: 5,
  START_MONEY: 800, KILL_REWARD: 300, PLANT_REWARD: 300,
  WIN_REWARD: 3250, LOSS_REWARD: 1900,
  PLAYER_HP: 100, GRAVITY: 22, JUMP_VEL: 7.2,
  // Movement: walk / sprint / crouch top speeds (m/s). Acceleration is modelled in
  // player.js as an exponential approach to the wanted velocity, so speed ramps up
  // and the player slides a little when the keys are released — never an instant stop.
  WALK_SPEED: 5.2, SPRINT_SPEED: 7.4, CROUCH_SPEED: 2.6,
  ACCEL_GROUND: 9, DECEL_GROUND: 13, ACCEL_AIR: 2.2,
  EYE_STAND: 1.62, EYE_CROUCH: 1.08, EYE_LERP_RATE: 12,
  PLAYER_RADIUS: 0.42,
  // Hearing: how far a noise carries, by kind. Bots hear inside (noise.radius +
  // their own hearing bonus); crouched footsteps are almost silent.
  NOISE_SHOT: 30, NOISE_EXPLOSION: 40, NOISE_PLANT: 40,
  NOISE_STEP_SPRINT: 12, NOISE_STEP_WALK: 6, NOISE_STEP_CROUCH: 3,
};
export const PHASE = { MENU: 'menu', BUY: 'buy', LIVE: 'live', ROUND_END: 'roundEnd', MATCH_END: 'matchEnd' };
export const TEAM = { TIDE: 'tide', RUST: 'rust' };

export function createState() {
  return {
    phase: PHASE.MENU,
    paused: false,
    muted: false,
    seed: 1,
    round: 1,
    wins: 0, losses: 0,
    money: CFG.START_MONEY,
    roundTime: CFG.ROUND_TIME,
    buyTime: CFG.BUY_TIME,
    kills: 0, deaths: 0,
    // Bomb: idle | planted | exploded | defused
    bomb: { status: 'idle', site: null, fuse: 0, plantProgress: 0, defuseProgress: 0, defuserId: null, x: 0, z: 0 },
    roundEnd: null, // {won, reason}
    matchWinner: null,
    // Live team counts, mirrored from bots.js each step.
    alive: { tide: 5, rust: 5 },
    // Noise events bots can hear: {x, z, radius, t, kind}
    noises: [],
    flash: 0, // player flash blindness 0..1 (single field; combat writes it, main decays it)
    time: 0,
  };
}
export function resetRoundState(s) {
  s.roundTime = CFG.ROUND_TIME;
  s.bomb = { status: 'idle', site: null, fuse: 0, plantProgress: 0, defuseProgress: 0, defuserId: null, x: 0, z: 0 };
  s.roundEnd = null;
  s.alive = { tide: 5, rust: 5 };
  s.noises = [];
  s.flash = 0;
}
