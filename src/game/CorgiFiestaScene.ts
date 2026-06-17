import Phaser from 'phaser';

type RunnerStatus = 'ready' | 'running' | 'gameover';
type PickupKind = 'snack' | 'hat';
type ObstacleKind = 'bush' | 'cone' | 'fence';

type Star = {
  x: number;
  y: number;
  size: number;
  twinkle: number;
};

type Snowflake = {
  x: number;
  y: number;
  size: number;
  speed: number;
  drift: number;
};

type RunnerObject = {
  root: Phaser.GameObjects.Container;
  kind: ObstacleKind;
  width: number;
  height: number;
  scored: boolean;
};

type PickupObject = {
  root: Phaser.GameObjects.Container;
  kind: PickupKind;
  width: number;
  height: number;
};

type ConfettiPiece = {
  obj: Phaser.GameObjects.Rectangle;
  vx: number;
  vy: number;
  spin: number;
  life: number;
};

type BackgroundSet = {
  clouds: Phaser.GameObjects.Image[];
  dayMountains: Phaser.GameObjects.Image[];
  nightMountains: Phaser.GameObjects.Image[];
  bushMounds: Phaser.GameObjects.Image[];
  grassTufts: Phaser.GameObjects.Image[];
  snowCloud: Phaser.GameObjects.Image;
};

type RunnerState = {
  score: number;
  best: number;
  status: RunnerStatus;
};

const CORGI_BASE_WIDTH = 128;
const CORGI_BASE_HEIGHT = 104;
const CORGI_HITBOX_WIDTH = 92;
const CORGI_HITBOX_HEIGHT = 60;
const RUN_SPEED = 360;
const JUMP_VELOCITY = -1080;
const FIESTA_DURATION_MS = 7500;
const BOOST_DURATION_MS = 3200;
const WORN_SOMBRERO_X = 82;
const WORN_SOMBRERO_Y = 19;
const WORN_SOMBRERO_WIDTH = 62;

const CONFETTI_COLORS = [0xff4f8b, 0xffce3a, 0x54e0ff, 0x80f05a, 0xff7a4d, 0xc86cff];
const CORGI_TEXTURES = {
  idle: 'corgi-idle',
  run1: 'corgi-run-1',
  run2: 'corgi-run-2',
  run3: 'corgi-run-3',
  run4: 'corgi-run-4',
  jump: 'corgi-jump',
  happy: 'corgi-happy',
};
const CORGI_RUN_TEXTURES = [
  CORGI_TEXTURES.run1,
  CORGI_TEXTURES.run2,
  CORGI_TEXTURES.run3,
  CORGI_TEXTURES.run4,
];
const SNACK_TEXTURES = ['snack-taco', 'snack-churro', 'snack-bone', 'snack-cookie'];
const OBSTACLE_TEXTURES: Record<ObstacleKind, string> = {
  bush: 'obstacle-bush',
  cone: 'obstacle-cone',
  fence: 'obstacle-fence',
};
const OBSTACLE_WIDTHS: Record<ObstacleKind, number> = {
  bush: 126,
  cone: 62,
  fence: 138,
};
const BG_TEXTURES = {
  cloud: 'bg-cloud',
  mountainDay: 'bg-mountain-day',
  mountainNight: 'bg-mountain-night',
  bushMound: 'bg-bush-mound',
  grassTuft: 'bg-grass-tuft',
  sun: 'bg-sun',
  moon: 'bg-moon',
  snowCloud: 'bg-snow-cloud',
};

const clamp = Phaser.Math.Clamp;

function mixNumber(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * clamp(t, 0, 1));
}

function mixColor(a: number, b: number, t: number) {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;

  return (mixNumber(ar, br, t) << 16) + (mixNumber(ag, bg, t) << 8) + mixNumber(ab, bb, t);
}

function smoothStep(edge0: number, edge1: number, value: number) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function overlap(a: Phaser.Geom.Rectangle, b: Phaser.Geom.Rectangle) {
  return Phaser.Geom.Intersects.RectangleToRectangle(a, b);
}

export class CorgiFiestaScene extends Phaser.Scene {
  private width = 1;
  private height = 1;
  private unit = 1;
  private groundY = 1;
  private phaseOffset = 0.15;
  private runSeconds = 0;
  private previewSeconds = 0;
  private score = 0;
  private best = Number(localStorage.getItem('corgi-best-score') ?? 0);
  private status: RunnerStatus = 'ready';
  private corgiX = 0;
  private corgiY = 0;
  private corgiVelocity = 0;
  private onGround = true;
  private frameClock = 0;
  private nextObstacleIn = 1.2;
  private nextSnackIn = 2.4;
  private nextHatIn = 6.2;
  private boostUntil = 0;
  private fiestaUntil = 0;
  private fiestaConfettiIn = 0;
  private lastStateAt = 0;

  private sky!: Phaser.GameObjects.Graphics;
  private scenery!: Phaser.GameObjects.Graphics;
  private backgroundLayer!: Phaser.GameObjects.Container;
  private ground!: Phaser.GameObjects.Graphics;
  private snow!: Phaser.GameObjects.Graphics;
  private fiesta!: Phaser.GameObjects.Graphics;
  private objectLayer!: Phaser.GameObjects.Container;
  private pickupLayer!: Phaser.GameObjects.Container;
  private confettiLayer!: Phaser.GameObjects.Container;
  private corgi!: Phaser.GameObjects.Container;
  private corgiSprite!: Phaser.GameObjects.Image;
  private sombrero!: Phaser.GameObjects.Image;
  private sunSprite!: Phaser.GameObjects.Image;
  private moonSprite!: Phaser.GameObjects.Image;
  private backgroundSprites!: BackgroundSet;

  private stars: Star[] = [];
  private snowflakes: Snowflake[] = [];
  private obstacles: RunnerObject[] = [];
  private pickups: PickupObject[] = [];
  private confettiPieces: ConfettiPiece[] = [];

  constructor() {
    super('CorgiFiestaScene');
  }

  preload() {
    for (const [key, file] of Object.entries({
      [CORGI_TEXTURES.idle]: 'corgi-idle.png',
      [CORGI_TEXTURES.run1]: 'corgi-run-1.png',
      [CORGI_TEXTURES.run2]: 'corgi-run-2.png',
      [CORGI_TEXTURES.run3]: 'corgi-run-3.png',
      [CORGI_TEXTURES.run4]: 'corgi-run-4.png',
      [CORGI_TEXTURES.jump]: 'corgi-jump.png',
      [CORGI_TEXTURES.happy]: 'corgi-happy.png',
      sombrero: 'sombrero.png',
      [SNACK_TEXTURES[0]]: 'snack-taco.png',
      [SNACK_TEXTURES[1]]: 'snack-churro.png',
      [SNACK_TEXTURES[2]]: 'snack-bone.png',
      [SNACK_TEXTURES[3]]: 'snack-cookie.png',
      [OBSTACLE_TEXTURES.bush]: 'obstacle-bush.png',
      [OBSTACLE_TEXTURES.cone]: 'obstacle-cone.png',
      [OBSTACLE_TEXTURES.fence]: 'obstacle-fence.png',
      [BG_TEXTURES.cloud]: 'bg-cloud.png',
      [BG_TEXTURES.mountainDay]: 'bg-mountain-day.png',
      [BG_TEXTURES.mountainNight]: 'bg-mountain-night.png',
      [BG_TEXTURES.bushMound]: 'bg-bush-mound.png',
      [BG_TEXTURES.grassTuft]: 'bg-grass-tuft.png',
      [BG_TEXTURES.sun]: 'bg-sun.png',
      [BG_TEXTURES.moon]: 'bg-moon.png',
      [BG_TEXTURES.snowCloud]: 'bg-snow-cloud.png',
    })) {
      this.load.image(key, `assets/sprites/${file}`);
    }
  }

  create() {
    this.width = this.scale.width;
    this.height = this.scale.height;
    this.recalculateLayout();
    this.phaseOffset = this.localTimePhase();

    this.sky = this.add.graphics().setDepth(0);
    this.scenery = this.add.graphics().setDepth(1);
    this.backgroundLayer = this.add.container(0, 0).setDepth(2);
    this.backgroundSprites = this.createBackgroundSprites();
    this.ground = this.add.graphics().setDepth(4);
    this.objectLayer = this.add.container(0, 0).setDepth(8);
    this.pickupLayer = this.add.container(0, 0).setDepth(9);
    this.corgi = this.createCorgi().setDepth(10);
    this.sombrero = this.createSombrero(WORN_SOMBRERO_X, WORN_SOMBRERO_Y, WORN_SOMBRERO_WIDTH).setVisible(false);
    this.corgi.add(this.sombrero);
    this.confettiLayer = this.add.container(0, 0).setDepth(18);
    this.fiesta = this.add.graphics().setDepth(19);
    this.snow = this.add.graphics().setDepth(20);

    this.seedStars();
    this.seedSnow();
    this.placeCorgiOnGround();
    this.drawWorld(0);
    this.publishState(true);

    this.input.on('pointerdown', () => this.handlePrimaryAction());
    this.input.keyboard?.on('keydown-SPACE', () => this.handlePrimaryAction());
    this.input.keyboard?.on('keydown-ENTER', () => this.handlePrimaryAction());
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => this.handleResize(gameSize));

    const onAction = (event: Event) => {
      const action = (event as CustomEvent<string>).detail;
      if (action === 'start') {
        this.startRun();
      } else if (action === 'fiesta') {
        if (this.status !== 'running') {
          this.startRun();
        }
        this.activateFiesta(this.corgiX + 44 * this.unit, this.corgiY + 8 * this.unit);
      }
    };

    window.addEventListener('corgi:action', onAction);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('corgi:action', onAction);
    });
  }

  update(_time: number, delta: number) {
    const dt = Math.min(delta / 1000, 0.033);
    this.previewSeconds += dt;

    if (this.status === 'running') {
      this.runSeconds += dt;
      this.updateRunner(dt);
    }

    this.drawWorld(dt);
    this.updateConfetti(dt);
    this.publishState();
  }

  private startRun() {
    this.clearObjects();
    this.status = 'running';
    this.runSeconds = 0;
    this.frameClock = 0;
    this.score = 0;
    this.corgiVelocity = 0;
    this.onGround = true;
    this.boostUntil = 0;
    this.fiestaUntil = 0;
    this.fiestaConfettiIn = 0;
    this.nextObstacleIn = 2.05;
    this.nextSnackIn = 1.65;
    this.nextHatIn = 5.8;
    this.phaseOffset = this.localTimePhase();
    this.setCorgiTexture(CORGI_TEXTURES.run1);
    this.sombrero.setVisible(false);
    this.placeCorgiOnGround();
    this.cameras.main?.flash?.(220, 255, 255, 255);
    this.publishState(true);
  }

  private handlePrimaryAction() {
    if (this.status === 'ready' || this.status === 'gameover') {
      this.startRun();
      return;
    }

    this.jump();
  }

  private jump() {
    if (!this.onGround) {
      return;
    }

    this.corgiVelocity = JUMP_VELOCITY * this.unit;
    this.onGround = false;
    this.spawnDust(this.corgiX + 12 * this.unit, this.groundY - 10 * this.unit, 5);
  }

  private updateRunner(dt: number) {
    const now = this.time.now;
    const boostActive = now < this.boostUntil;
    const fiestaActive = now < this.fiestaUntil;

    if (!fiestaActive && this.sombrero.visible) {
      this.sombrero.setVisible(false);
      this.nextObstacleIn = Math.max(this.nextObstacleIn, 1.2);
      this.popConfetti(this.corgiX + 44 * this.unit, this.corgiY + 2 * this.unit, 18);
    }

    const scoreMultiplier = fiestaActive ? 3 : boostActive ? 1.7 : 1;
    this.score += dt * 8.5 * scoreMultiplier;
    this.best = Math.max(this.best, Math.floor(this.score));
    localStorage.setItem('corgi-best-score', String(this.best));

    const scrollSpeed = RUN_SPEED * this.unit;

    this.frameClock += dt;
    this.updateCorgiPhysics(dt);
    this.animateCorgi(fiestaActive);
    this.updateObjects(dt, scrollSpeed);
    this.updateSpawning(dt, fiestaActive);

    if (fiestaActive) {
      this.fiestaConfettiIn -= dt;
      if (this.fiestaConfettiIn <= 0) {
        this.fiestaConfettiIn = 0.16;
        this.popConfetti(Phaser.Math.Between(20, this.width - 20), Phaser.Math.Between(50, Math.max(90, this.groundY - 140)), 7);
      }
    }
  }

  private updateCorgiPhysics(dt: number) {
    this.corgiVelocity += 2450 * this.unit * dt;
    this.corgiY += this.corgiVelocity * dt;

    const floorY = this.groundY - CORGI_BASE_HEIGHT * this.unit;
    if (this.corgiY >= floorY) {
      this.corgiY = floorY;
      this.corgiVelocity = 0;
      this.onGround = true;
    }

    this.positionCorgi();
  }

  private updateObjects(dt: number, scrollSpeed: number) {
    for (const obstacle of [...this.obstacles]) {
      obstacle.root.x -= scrollSpeed * dt;

      if (!obstacle.scored && obstacle.root.x + obstacle.width < this.corgiX) {
        obstacle.scored = true;
        this.score += 12;
      }

      if (obstacle.root.x < -obstacle.width - 60) {
        this.destroyObstacle(obstacle);
        continue;
      }

      if (this.status === 'running' && this.isCorgiTouching(obstacle.root.x, obstacle.root.y, obstacle.width, obstacle.height)) {
        this.endRun();
        return;
      }
    }

    for (const pickup of [...this.pickups]) {
      pickup.root.x -= scrollSpeed * dt;
      pickup.root.y += Math.sin(this.runSeconds * 5 + pickup.root.x * 0.01) * 0.25;

      if (pickup.root.x < -pickup.width - 60) {
        this.destroyPickup(pickup);
        continue;
      }

      if (this.isCorgiTouching(pickup.root.x, pickup.root.y, pickup.width, pickup.height)) {
        this.collectPickup(pickup);
      }
    }
  }

  private updateSpawning(dt: number, fiestaActive: boolean) {
    this.nextSnackIn -= dt;
    this.nextHatIn -= dt;

    if (this.nextSnackIn <= 0) {
      this.spawnSnack();
      this.nextSnackIn = Phaser.Math.FloatBetween(3.0, 5.4);
    }

    if (!fiestaActive && this.nextHatIn <= 0) {
      this.spawnHatPickup();
      this.nextHatIn = Phaser.Math.FloatBetween(18, 26);
    }

    if (fiestaActive) {
      this.nextObstacleIn = Math.max(this.nextObstacleIn, 0.75);
      return;
    }

    this.nextObstacleIn -= dt;
    if (this.nextObstacleIn <= 0) {
      if (this.canSpawnObstacle()) {
        this.spawnObstacle();
        const difficultyTrim = Math.min(this.score / 600, 0.22);
        this.nextObstacleIn = Phaser.Math.FloatBetween(1.35 - difficultyTrim, 2.05 - difficultyTrim * 0.45);
      } else {
        this.nextObstacleIn = 0.12;
      }
    }
  }

  private collectPickup(pickup: PickupObject) {
    if (pickup.kind === 'snack') {
      this.boostUntil = this.time.now + BOOST_DURATION_MS;
      this.score += 20;
      this.popConfetti(pickup.root.x + pickup.width * 0.5, pickup.root.y + pickup.height * 0.45, 12);
    } else {
      this.activateFiesta(pickup.root.x + pickup.width * 0.5, pickup.root.y + pickup.height * 0.4);
    }

    this.destroyPickup(pickup);
  }

  private activateFiesta(x: number, y: number) {
    this.fiestaUntil = this.time.now + FIESTA_DURATION_MS;
    this.boostUntil = Math.max(this.boostUntil, this.time.now + 1500);
    this.sombrero.setVisible(true);
    this.score += 75;
    this.popConfetti(x, y, 48);

    for (const obstacle of [...this.obstacles]) {
      this.popConfetti(obstacle.root.x + obstacle.width * 0.5, obstacle.root.y + obstacle.height * 0.35, 34);
      this.destroyObstacle(obstacle);
    }

    this.cameras.main?.shake?.(180, 0.003);
  }

  private endRun() {
    this.status = 'gameover';
    this.boostUntil = 0;
    this.fiestaUntil = 0;
    this.sombrero.setVisible(false);
    this.best = Math.max(this.best, Math.floor(this.score));
    localStorage.setItem('corgi-best-score', String(this.best));
    this.setCorgiTexture(CORGI_TEXTURES.happy);
    this.popConfetti(this.corgiX + 42 * this.unit, this.corgiY + 28 * this.unit, 18);
    this.cameras.main?.shake?.(180, 0.004);
    this.publishState(true);
  }

  private drawWorld(dt: number) {
    const phase = this.currentPhase();
    const snowIntensity = this.snowIntensity(phase);
    const fiestaActive = this.time.now < this.fiestaUntil;
    this.drawSky(phase, fiestaActive);
    this.drawScenery(phase, fiestaActive);
    this.drawGround(phase, fiestaActive);
    this.drawFiesta(fiestaActive);
    this.drawSnow(dt, snowIntensity);
  }

  private drawSky(phase: number, fiestaActive: boolean) {
    const bandCount = 32;
    const palette = this.skyPalette(phase);
    this.sky.clear();

    for (let i = 0; i < bandCount; i++) {
      const t = i / (bandCount - 1);
      const color = mixColor(palette.top, palette.bottom, t);
      this.sky.fillStyle(fiestaActive ? mixColor(color, 0xffb347, 0.2) : color, 1);
      this.sky.fillRect(0, (this.height * i) / bandCount, this.width, this.height / bandCount + 1);
    }

    this.drawSunAndMoon(phase);
    this.drawStars(phase);
  }

  private drawSunAndMoon(phase: number) {
    const sunAlpha = this.daylightAmount(phase);
    const sunT = clamp((phase - 0.1) / 0.58, 0, 1);
    this.sunSprite
      .setVisible(sunAlpha > 0.02)
      .setAlpha(sunAlpha)
      .setPosition(this.width * (0.08 + 0.84 * sunT), this.groundY * (0.62 - Math.sin(sunT * Math.PI) * 0.48));
    this.setImageWidth(this.sunSprite, 70 * this.unit);

    const moonAlpha = this.nightAmount(phase);
    const moonT = phase >= 0.58 ? (phase - 0.58) / 0.52 : (phase + 0.42) / 0.52;
    this.moonSprite
      .setVisible(moonAlpha > 0.02)
      .setAlpha(moonAlpha)
      .setPosition(this.width * (0.12 + 0.76 * clamp(moonT, 0, 1)), this.groundY * (0.25 + Math.sin(moonT * Math.PI) * 0.18));
    this.setImageWidth(this.moonSprite, 62 * this.unit);
  }

  private drawStars(phase: number) {
    const alpha = this.nightAmount(phase);
    if (alpha <= 0) {
      return;
    }

    for (const star of this.stars) {
      const pulse = 0.55 + Math.sin(this.previewSeconds * 2 + star.twinkle) * 0.35;
      this.sky.fillStyle(0xffffff, alpha * pulse);
      this.sky.fillRect(star.x * this.width, star.y * this.groundY, star.size * this.unit, star.size * this.unit);
    }
  }

  private drawScenery(phase: number, fiestaActive: boolean) {
    this.scenery.clear();
    const night = this.nightAmount(phase);
    const farColor = mixColor(0xa6d66e, 0x2f4b73, night);
    const nearColor = mixColor(0x6dcf67, 0x263c62, night);
    const fiestaTint = fiestaActive ? 0.22 : 0;
    const scroll = (this.runSeconds * 28 * this.unit) % (260 * this.unit);

    this.scenery.fillStyle(mixColor(farColor, 0xff8f66, fiestaTint), 1);
    this.scenery.beginPath();
    this.scenery.moveTo(-80 * this.unit - scroll * 0.25, this.groundY - 70 * this.unit);
    for (let i = 0, x = -80 * this.unit; x < this.width + 200 * this.unit; i++, x += 180 * this.unit) {
      const peak = 90 + ((i * 37) % 34);
      this.scenery.lineTo(x - scroll * 0.25, this.groundY - peak * this.unit);
      this.scenery.lineTo(x + 90 * this.unit - scroll * 0.25, this.groundY - 54 * this.unit);
    }
    this.scenery.lineTo(this.width + 120 * this.unit, this.groundY);
    this.scenery.lineTo(0, this.groundY);
    this.scenery.closePath();
    this.scenery.fillPath();

    this.scenery.fillStyle(mixColor(nearColor, 0xffd166, fiestaTint), 1);
    for (let x = -120 * this.unit - scroll; x < this.width + 220 * this.unit; x += 245 * this.unit) {
      this.scenery.fillCircle(x, this.groundY - 38 * this.unit, 72 * this.unit);
      this.scenery.fillCircle(x + 86 * this.unit, this.groundY - 30 * this.unit, 58 * this.unit);
    }

    this.updateBackgroundSprites(phase, fiestaActive);
  }

  private updateBackgroundSprites(phase: number, fiestaActive: boolean) {
    const night = this.nightAmount(phase);
    const snow = this.snowIntensity(phase);
    const span = this.width + 420 * this.unit;
    const wrap = (value: number) => ((value % span) + span) % span - 190 * this.unit;
    const fiestaLift = fiestaActive ? Math.sin(this.previewSeconds * 5) * 3 * this.unit : 0;

    this.backgroundSprites.clouds.forEach((cloud, i) => {
      const width = [170, 124, 146, 106][i] * this.unit;
      const x = wrap(90 * this.unit + i * 270 * this.unit - (this.previewSeconds * 18 + this.runSeconds * 14) * this.unit);
      const y = (78 + i * 31 + Math.sin(this.previewSeconds * 0.8 + i) * 5) * this.unit;
      this.setImageWidth(cloud, width);
      cloud.setVisible(true).setAlpha(clamp(0.95 - night * 0.38, 0.42, 0.95)).setPosition(x, y + fiestaLift);
    });

    this.backgroundSprites.dayMountains.forEach((mountain, i) => {
      const width = (210 + (i % 2) * 32) * this.unit;
      const x = wrap(130 * this.unit + i * 285 * this.unit - this.runSeconds * 9 * this.unit);
      this.setImageWidth(mountain, width);
      mountain.setVisible(true).setAlpha(clamp(0.72 - night * 0.58, 0, 0.72)).setPosition(x, this.groundY - 34 * this.unit);
    });

    this.backgroundSprites.nightMountains.forEach((mountain, i) => {
      const width = (230 + (i % 2) * 38) * this.unit;
      const x = wrap(180 * this.unit + i * 305 * this.unit - this.runSeconds * 8 * this.unit);
      this.setImageWidth(mountain, width);
      mountain.setVisible(true).setAlpha(night * 0.8).setPosition(x, this.groundY - 30 * this.unit);
    });

    this.backgroundSprites.bushMounds.forEach((bush, i) => {
      const width = (126 + (i % 3) * 18) * this.unit;
      const x = wrap(48 * this.unit + i * 210 * this.unit - this.runSeconds * 22 * this.unit);
      this.setImageWidth(bush, width);
      bush.setVisible(true).setAlpha(clamp(0.72 - night * 0.22, 0.46, 0.72)).setPosition(x, this.groundY + 2 * this.unit);
    });

    this.backgroundSprites.grassTufts.forEach((tuft, i) => {
      const width = (64 + (i % 2) * 14) * this.unit;
      const x = wrap(26 * this.unit + i * 132 * this.unit - this.runSeconds * 64 * this.unit);
      this.setImageWidth(tuft, width);
      tuft.setVisible(true).setAlpha(0.72).setPosition(x, this.groundY + 18 * this.unit);
    });

    this.setImageWidth(this.backgroundSprites.snowCloud, 178 * this.unit);
    this.backgroundSprites.snowCloud
      .setVisible(snow > 0.03)
      .setAlpha(snow * 0.82)
      .setPosition(this.width * 0.68, 132 * this.unit + Math.sin(this.previewSeconds * 0.9) * 5 * this.unit);
  }

  private drawGround(phase: number, fiestaActive: boolean) {
    this.ground.clear();
    const night = this.nightAmount(phase);
    const sand = mixColor(0xf6d96a, 0x4f496e, night);
    const grass = mixColor(0x45d45b, 0x277d5b, night);
    const dirt = mixColor(0xd9a446, 0x393553, night);
    const tint = fiestaActive ? 0.18 : 0;

    this.ground.fillStyle(mixColor(sand, 0xffcf44, tint), 1);
    this.ground.fillRect(0, this.groundY, this.width, this.height - this.groundY + 2);
    this.ground.fillStyle(mixColor(grass, 0x69ff70, tint), 1);
    this.ground.fillRect(0, this.groundY, this.width, 18 * this.unit);

    const stripeOffset = (this.runSeconds * 160 * this.unit) % (44 * this.unit);
    this.ground.fillStyle(dirt, 0.8);
    for (let x = -stripeOffset; x < this.width + 40; x += 44 * this.unit) {
      this.ground.fillRect(x, this.groundY + 32 * this.unit, 18 * this.unit, 6 * this.unit);
      this.ground.fillRect(x + 22 * this.unit, this.groundY + 55 * this.unit, 13 * this.unit, 5 * this.unit);
    }
  }

  private drawFiesta(active: boolean) {
    this.fiesta.clear();
    if (!active) {
      return;
    }

    const bannerY = 48 * this.unit;
    this.fiesta.lineStyle(3 * this.unit, 0xffffff, 0.8);
    this.fiesta.beginPath();
    this.fiesta.moveTo(0, bannerY);
    this.fiesta.lineTo(this.width, bannerY + Math.sin(this.previewSeconds * 2) * 6 * this.unit);
    this.fiesta.strokePath();

    const colors = [0xff4f8b, 0xffce3a, 0x55e6ff, 0x6df05e, 0xff7a4d];
    for (let x = -20 * this.unit; x < this.width + 40 * this.unit; x += 34 * this.unit) {
      const color = colors[Math.abs(Math.floor(x / (34 * this.unit))) % colors.length];
      this.fiesta.fillStyle(color, 0.92);
      this.fiesta.fillTriangle(
        x,
        bannerY + 7 * this.unit,
        x + 24 * this.unit,
        bannerY + 7 * this.unit,
        x + 12 * this.unit,
        bannerY + 34 * this.unit,
      );
    }

    this.drawFireworks(colors);
  }

  private drawFireworks(colors: number[]) {
    for (let i = 0; i < 4; i++) {
      const cycle = (this.previewSeconds * 0.58 + i * 0.27) % 1;
      const alpha = 1 - smoothStep(0.58, 1, cycle);
      const radius = (18 + cycle * 58) * this.unit;
      const cx = this.width * (0.18 + ((i * 0.23 + Math.sin(i * 1.9) * 0.05) % 0.66));
      const cy = (92 + (i % 2) * 78 + Math.sin(i * 2.6) * 14) * this.unit;
      const color = colors[i % colors.length];

      this.fiesta.lineStyle(3 * this.unit, color, alpha * 0.86);
      for (let spoke = 0; spoke < 10; spoke++) {
        const angle = (spoke / 10) * Math.PI * 2 + i * 0.16;
        const inner = radius * 0.38;
        const outer = radius;
        this.fiesta.beginPath();
        this.fiesta.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
        this.fiesta.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
        this.fiesta.strokePath();
      }

      this.fiesta.fillStyle(0xffffff, alpha * 0.76);
      this.fiesta.fillCircle(cx, cy, 4 * this.unit);
    }
  }

  private drawSnow(dt: number, intensity: number) {
    this.snow.clear();
    if (intensity <= 0) {
      return;
    }

    this.snow.fillStyle(0xffffff, 0.35 * intensity);
    this.snow.fillRect(0, 0, this.width, this.height);
    this.snow.fillStyle(0xffffff, 0.88 * intensity);

    for (const flake of this.snowflakes) {
      flake.y += flake.speed * this.unit * dt;
      flake.x += Math.sin(this.previewSeconds * 1.6 + flake.drift) * this.unit * dt * 16;
      if (flake.y > this.height + 12) {
        flake.y = -12;
        flake.x = Phaser.Math.Between(0, this.width);
      }
      this.snow.fillCircle(flake.x, flake.y, flake.size * this.unit);
    }
  }

  private createCorgi() {
    const dog = this.add.container(this.corgiX, this.corgiY);
    dog.setScale(this.unit);

    this.corgiSprite = this.add.image(0, 0, CORGI_TEXTURES.idle).setOrigin(0, 0);
    this.setCorgiTexture(CORGI_TEXTURES.idle);
    dog.add(this.corgiSprite);

    return dog;
  }

  private setCorgiTexture(texture: string) {
    if (this.corgiSprite.texture.key !== texture) {
      this.corgiSprite.setTexture(texture);
    }
    this.setLocalImageSize(this.corgiSprite, CORGI_BASE_WIDTH, CORGI_BASE_HEIGHT);
    this.corgiSprite.setPosition(0, CORGI_BASE_HEIGHT - this.corgiSprite.displayHeight);
  }

  private setLocalImageSize(image: Phaser.GameObjects.Image, maxWidth: number, maxHeight: number) {
    const source = image.texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const scale = Math.min(maxWidth / source.width, maxHeight / source.height);
    image.setDisplaySize(source.width * scale, source.height * scale);
  }

  private setImageWidth(image: Phaser.GameObjects.Image, width: number) {
    const source = image.texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    image.setDisplaySize(width, width * (source.height / source.width));
  }

  private createBackgroundSprites(): BackgroundSet {
    const make = (key: string, originX = 0.5, originY = 0.5) => {
      const image = this.add.image(0, 0, key).setOrigin(originX, originY).setAlpha(0).setVisible(false);
      this.backgroundLayer.add(image);
      return image;
    };

    this.sunSprite = make(BG_TEXTURES.sun);
    this.moonSprite = make(BG_TEXTURES.moon);

    return {
      clouds: Array.from({ length: 4 }, () => make(BG_TEXTURES.cloud)),
      dayMountains: Array.from({ length: 4 }, () => make(BG_TEXTURES.mountainDay, 0.5, 1)),
      nightMountains: Array.from({ length: 4 }, () => make(BG_TEXTURES.mountainNight, 0.5, 1)),
      bushMounds: Array.from({ length: 5 }, () => make(BG_TEXTURES.bushMound, 0.5, 1)),
      grassTufts: Array.from({ length: 7 }, () => make(BG_TEXTURES.grassTuft, 0.5, 1)),
      snowCloud: make(BG_TEXTURES.snowCloud),
    };
  }

  private createObstacle(kind: ObstacleKind) {
    const key = OBSTACLE_TEXTURES[kind];
    const image = this.add.image(0, 0, key).setOrigin(0, 0);
    const source = image.texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const width = OBSTACLE_WIDTHS[kind] * this.unit;
    const height = width * (source.height / source.width);
    const x = this.width + 80 * this.unit;
    const y = this.obstacleGroundY() - height;
    const root = this.add.container(x, y);

    image.setDisplaySize(width, height);
    root.add(image);
    root.setSize(width, height);
    this.objectLayer.add(root);

    return { root, kind, width, height, scored: false };
  }

  private createSnack(kind: number) {
    const key = SNACK_TEXTURES[kind % SNACK_TEXTURES.length];
    const image = this.add.image(0, 0, key).setOrigin(0, 0);
    const source = image.texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const width = 54 * this.unit;
    const height = width * (source.height / source.width);
    const x = this.width + 80 * this.unit;
    const y = this.groundY - Phaser.Math.Between(96, 155) * this.unit;
    const root = this.add.container(x, y);

    image.setDisplaySize(width, height);
    root.add(image);
    root.setSize(width, height);
    this.pickupLayer.add(root);

    return { root, kind: 'snack' as const, width, height };
  }

  private createSombrero(x: number, y: number, width: number) {
    const image = this.add.image(x, y, 'sombrero').setOrigin(0.5, 0.5);
    const source = image.texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    image.setDisplaySize(width, width * (source.height / source.width));
    return image;
  }

  private createHatPickup() {
    const width = 76 * this.unit;
    const root = this.add.container(this.width + 84 * this.unit, this.groundY - 128 * this.unit);
    const hat = this.createSombrero(width * 0.5, width * 0.32, width);
    const height = hat.displayHeight;
    root.add(hat);
    root.setSize(width, height);
    this.pickupLayer.add(root);

    return { root, kind: 'hat' as const, width, height };
  }

  private obstacleGroundY() {
    return this.groundY + 16 * this.unit;
  }

  private minimumObstacleGap() {
    const gravity = 2450;
    const airborneSeconds = (Math.abs(JUMP_VELOCITY) * 2) / gravity;
    return RUN_SPEED * this.unit * (airborneSeconds + 0.42) + CORGI_BASE_WIDTH * this.unit;
  }

  private canSpawnObstacle() {
    const spawnX = this.width + 80 * this.unit;
    const rightmost = this.obstacles.reduce((max, obstacle) => Math.max(max, obstacle.root.x + obstacle.width), -Infinity);
    return rightmost === -Infinity || spawnX - rightmost >= this.minimumObstacleGap();
  }

  private spawnObstacle() {
    const kind = Phaser.Utils.Array.GetRandom<ObstacleKind>(['bush', 'cone', 'fence']);
    this.obstacles.push(this.createObstacle(kind));
  }

  private spawnSnack() {
    this.pickups.push(this.createSnack(Phaser.Math.Between(0, 3)));
  }

  private spawnHatPickup() {
    this.pickups.push(this.createHatPickup());
  }

  private createCorgiBounds() {
    return new Phaser.Geom.Rectangle(
      this.corgiX + 20 * this.unit,
      this.corgiY + 34 * this.unit,
      CORGI_HITBOX_WIDTH * this.unit,
      CORGI_HITBOX_HEIGHT * this.unit,
    );
  }

  private isCorgiTouching(x: number, y: number, width: number, height: number) {
    const corgiBounds = this.createCorgiBounds();
    const objectBounds = new Phaser.Geom.Rectangle(
      x + 10 * this.unit,
      y + 8 * this.unit,
      width - 20 * this.unit,
      height - 14 * this.unit,
    );
    return overlap(corgiBounds, objectBounds);
  }

  private animateCorgi(fiestaActive: boolean) {
    const runFrame = Math.floor(this.frameClock * 10) % CORGI_RUN_TEXTURES.length;
    if (!this.onGround) {
      this.setCorgiTexture(CORGI_TEXTURES.jump);
    } else {
      this.setCorgiTexture(CORGI_RUN_TEXTURES[runFrame]);
    }

    this.corgi.setAngle(fiestaActive ? Math.sin(this.previewSeconds * 12) * 1.8 : 0);
    this.corgi.setScale(this.unit);
    this.sombrero.setAngle(fiestaActive ? Math.sin(this.previewSeconds * 9) * 7 : 0);
  }

  private spawnDust(x: number, y: number, count: number) {
    if (this.confettiPieces.length > 160) {
      return;
    }

    for (let i = 0; i < count; i++) {
      const obj = this.add.rectangle(x, y, 5 * this.unit, 4 * this.unit, 0xffffff, 0.42).setDepth(16);
      this.confettiLayer.add(obj);
      this.confettiPieces.push({
        obj,
        vx: Phaser.Math.FloatBetween(-90, -30) * this.unit,
        vy: Phaser.Math.FloatBetween(-55, -12) * this.unit,
        spin: Phaser.Math.FloatBetween(-180, 180),
        life: Phaser.Math.FloatBetween(0.25, 0.55),
      });
    }
  }

  private popConfetti(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const color = Phaser.Utils.Array.GetRandom(CONFETTI_COLORS);
      const obj = this.add.rectangle(x, y, Phaser.Math.Between(4, 8) * this.unit, Phaser.Math.Between(6, 12) * this.unit, color, 1);
      this.confettiLayer.add(obj);
      this.confettiPieces.push({
        obj,
        vx: Phaser.Math.FloatBetween(-260, 260) * this.unit,
        vy: Phaser.Math.FloatBetween(-360, -80) * this.unit,
        spin: Phaser.Math.FloatBetween(-520, 520),
        life: Phaser.Math.FloatBetween(0.8, 1.5),
      });
    }
  }

  private updateConfetti(dt: number) {
    for (const piece of [...this.confettiPieces]) {
      piece.life -= dt;
      piece.vy += 620 * this.unit * dt;
      piece.obj.x += piece.vx * dt;
      piece.obj.y += piece.vy * dt;
      piece.obj.angle += piece.spin * dt;
      piece.obj.alpha = clamp(piece.life, 0, 1);

      if (piece.life <= 0 || piece.obj.y > this.height + 60) {
        piece.obj.destroy();
        this.confettiPieces.splice(this.confettiPieces.indexOf(piece), 1);
      }
    }
  }

  private destroyObstacle(obstacle: RunnerObject) {
    obstacle.root.destroy();
    this.obstacles.splice(this.obstacles.indexOf(obstacle), 1);
  }

  private destroyPickup(pickup: PickupObject) {
    pickup.root.destroy();
    this.pickups.splice(this.pickups.indexOf(pickup), 1);
  }

  private clearObjects() {
    for (const obstacle of [...this.obstacles]) {
      this.destroyObstacle(obstacle);
    }
    for (const pickup of [...this.pickups]) {
      this.destroyPickup(pickup);
    }
    for (const piece of [...this.confettiPieces]) {
      piece.obj.destroy();
    }
    this.confettiPieces = [];
  }

  private recalculateLayout() {
    this.unit = clamp(Math.min(this.width / 900, this.height / 540), 0.75, 1.55);
    this.groundY = Math.round(this.height * (this.width < 600 ? 0.78 : 0.76));
    this.corgiX = Math.max(38 * this.unit, Math.min(this.width * 0.16, 148 * this.unit));
  }

  private handleResize(gameSize: Phaser.Structs.Size) {
    this.width = gameSize.width;
    this.height = gameSize.height;
    this.recalculateLayout();
    this.seedStars();
    this.seedSnow();
    this.corgi.setScale(this.unit);
    this.placeCorgiOnGround();
  }

  private placeCorgiOnGround() {
    this.corgiY = this.groundY - CORGI_BASE_HEIGHT * this.unit;
    this.positionCorgi();
  }

  private positionCorgi() {
    this.corgi.setPosition(this.corgiX, this.corgiY);
  }

  private seedStars() {
    this.stars = Array.from({ length: 78 }, () => ({
      x: Math.random(),
      y: Math.random() * 0.58,
      size: Phaser.Math.FloatBetween(1.2, 2.6),
      twinkle: Math.random() * Math.PI * 2,
    }));
  }

  private seedSnow() {
    this.snowflakes = Array.from({ length: 95 }, () => ({
      x: Phaser.Math.Between(0, Math.max(this.width, 1)),
      y: Phaser.Math.Between(-40, Math.max(this.height, 1)),
      size: Phaser.Math.FloatBetween(1.2, 3.4),
      speed: Phaser.Math.FloatBetween(35, 98),
      drift: Math.random() * Math.PI * 2,
    }));
  }

  private skyPalette(phase: number) {
    const keyframes = [
      { phase: 0, top: 0x18254c, bottom: 0x313d67 },
      { phase: 0.1, top: 0x29345f, bottom: 0xf1b36a },
      { phase: 0.24, top: 0x86d6ff, bottom: 0xc8f3ff },
      { phase: 0.5, top: 0x73d8ff, bottom: 0xd9f8ff },
      { phase: 0.64, top: 0xff8f66, bottom: 0xffcf8a },
      { phase: 0.78, top: 0x202a55, bottom: 0x38436c },
      { phase: 1, top: 0x18254c, bottom: 0x313d67 },
    ];

    for (let i = 0; i < keyframes.length - 1; i++) {
      const current = keyframes[i];
      const next = keyframes[i + 1];
      if (phase >= current.phase && phase <= next.phase) {
        const t = smoothStep(0, 1, (phase - current.phase) / (next.phase - current.phase));
        return { top: mixColor(current.top, next.top, t), bottom: mixColor(current.bottom, next.bottom, t) };
      }
    }

    return { top: keyframes[0].top, bottom: keyframes[0].bottom };
  }

  private snowIntensity(phase: number) {
    if (phase >= 0.72) {
      return smoothStep(0.72, 0.84, phase);
    }
    if (phase <= 0.12) {
      return 1 - smoothStep(0.04, 0.12, phase);
    }
    return 0;
  }

  private daylightAmount(phase: number) {
    return smoothStep(0.08, 0.16, phase) * (1 - smoothStep(0.6, 0.72, phase));
  }

  private nightAmount(phase: number) {
    if (phase >= 0.58) {
      return smoothStep(0.58, 0.76, phase);
    }
    if (phase <= 0.16) {
      return 1 - smoothStep(0.06, 0.16, phase);
    }
    return 0;
  }

  private currentPhase() {
    const progress = this.status === 'running' ? this.runSeconds / 78 : this.previewSeconds / 120;
    return (this.phaseOffset + progress) % 1;
  }

  private localTimePhase() {
    const date = new Date();
    const seconds = date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
    return seconds / 86400;
  }

  private publishState(force = false) {
    if (!force && this.time.now - this.lastStateAt < 110) {
      return;
    }
    this.lastStateAt = this.time.now;

    const detail: RunnerState = {
      score: Math.floor(this.score),
      best: this.best,
      status: this.status,
    };

    window.dispatchEvent(new CustomEvent('corgi:state', { detail }));
  }
}
