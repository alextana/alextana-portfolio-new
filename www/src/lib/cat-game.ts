// A tiny endless runner in the spirit of Chrome's offline dino game, starring a cat.
// Everything is drawn from pixel-art arrays onto a transparent canvas, so it plays over whatever is behind it.
// The world is measured in units that scale with the viewport: about 1000 across on a laptop, 600 on a phone.

/** Size of one sprite pixel in world units. */
const P = 3;
/** World units per CSS pixel is 1/scale; the scale is clamped so phones and big screens both stay playable. */
const MIN_SCALE = 0.65;
const MAX_SCALE = 1.5;
const SCALE_WIDTH = 1000;

const GRAVITY = 2400;
const JUMP_VELOCITY = 780;
/** Letting go of jump early caps the upward speed, so short taps make short hops. */
const JUMP_CUT = 320;
const FAST_FALL = 3;
const JUMP_BUFFER = 0.12;

const START_SPEED = 360;
const MAX_SPEED = 1050;
/** Speed gained every second, so a run keeps getting harder for about a minute. */
const ACCELERATION = 12;
/** Hawks fly at you a little faster than the ground scrolls; sparrows dawdle. */
const HAWK_SPEED = 80;
const SPARROW_SPEED = 30;
/** Hawks only start showing up once you've got going. */
const HAWKS_FROM_SCORE = 250;
const SPARROW_POINTS = 50;
const RESTART_DELAY = 0.4;

/** One full day in seconds of play: day, sunset, night, sunrise. */
const CYCLE = 70;

// The pier the cat runs along, so it isn't running on water.
const DECK = 2 * P;
/** How far the deck stands above the horizon. */
const PIER_HEIGHT = 15;
const POST_GAP = 72;
const POST_DEPTH = 40;
const PLANK = 24;

const HIGH_SCORE_KEY = 'cat-game-high-score';

const INK = '#120d26';
const WOOD = '#2a1838';
const SUNLIT = '#ff9a4a';
const MOONLIT = '#d9c8ff';
const PALETTE: Record<string, string> = {
	k: INK,
	e: '#ffc46b',
	x: '#ff8a7a',
	b: '#ff9a4a',
	r: '#ff2e3f',
	t: '#5fd4c4',
	o: INK,
	w: '#3a1f55',
	m: MOONLIT,
};

type Sprite = {
	image: HTMLCanvasElement;
	/** A one-pixel moonlit outline, faded in at night so the silhouettes don't vanish into the dark sky. */
	rim: HTMLCanvasElement;
};
type Rect = { x: number; y: number; w: number; h: number };
type State = 'ready' | 'running' | 'dead';

/** Where to play, in CSS pixels relative to the canvas. */
export type Layout = {
	/** The line the cat runs along. */
	horizon: number;
	/** Where the cat stands. */
	left: number;
	/** Where the score lines up. */
	right: number;
};

export type Options = {
	layout: () => Layout;
	/** Called every frame of play with how far into night it is, 0 (day) … 1 (night). */
	onNight?: (amount: number) => void;
};

type Thing = {
	kind: 'crates' | 'hawk' | 'sparrow';
	x: number;
	y: number;
	w: number;
	h: number;
	/** Height of the bottom edge above the horizon. */
	lift: number;
	/** Crate layout: columns × rows. */
	cols?: number;
	rows?: number;
	flap?: number;
};

const CAT_RUN_A = [
	'............k...k.',
	'............kk.kk.',
	'............kkkkk.',
	'k...........kkekk.',
	'k...........kkkkkk',
	'.k..kkkkkkkkkkkkk.',
	'.kkkkkkkkkkkkkkk..',
	'...kkkkkkkkkkkkk..',
	'...kkkkkkkkkkkk...',
	'...kk........kk...',
	'..kk..........kk..',
	'.kk............kk.',
];

const CAT_RUN_B = [
	...CAT_RUN_A.slice(0, 9),
	'....kk......kk....',
	'.....kk....kk.....',
	'.....k......k.....',
];

const CAT_DUCK_A = [
	'k................k..k.',
	'k................kkkk.',
	'.kkkkkkkkkkkkkkkkkekkk',
	'..kkkkkkkkkkkkkkkkkkk.',
	'..kkkkkkkkkkkkkkkkkk..',
	'..kk..kk......kk..kk..',
	'.kk....kk....kk....kk.',
];

const CAT_DUCK_B = [
	...CAT_DUCK_A.slice(0, 5),
	'...kk.kk.....kk.kk....',
	'...k...k.....k...k....',
];

const CAT_DEAD = CAT_RUN_A.map((row) => row.replace('e', 'x'));

// Hawks: big, red-eyed, and deadly.
const HAWK_UP = [
	'........kk..........',
	'........kkk.........',
	'........kkkk........',
	'........kkkkk.......',
	'..kk....kkkkkk......',
	'.krkk...kkkkkkk.....',
	'bkkkkkkkkkkkkkkkkkk.',
	'..kkkkkkkkkkkkkkkkkk',
	'....kkkkkkkk..kkk...',
	'....................',
	'....................',
];

const HAWK_DOWN = [
	'....................',
	'....................',
	'....................',
	'....................',
	'..kk................',
	'.krkk...............',
	'bkkkkkkkkkkkkkkkkkk.',
	'..kkkkkkkkkkkkkkkkkk',
	'....kkkkkkkk..kkk...',
	'........kkkkk.......',
	'........kkkk........',
];

// Sparrows: small, teal, and tasty.
const SPARROW_UP = [
	'....tt...',
	'....ttt..',
	'.ttttttt.',
	'bkttttttt',
	'..tttt...',
	'.........',
];

const SPARROW_DOWN = [
	'.........',
	'.........',
	'.ttttttt.',
	'bkttttttt',
	'..tttttt.',
	'....tt...',
];

// A 10×10 crate: outlined, with an X brace across the front.
const CRATE = Array.from({ length: 10 }, (_, y) =>
	Array.from({ length: 10 }, (_, x) => {
		const edge = x === 0 || y === 0 || x === 9 || y === 9;
		const brace = x === y || x === 9 - y;
		return edge || brace ? 'o' : 'w';
	}).join(''),
);

// Hitboxes in sprite pixels, a little inside the art so near misses feel fair.
const CAT_HITBOXES: Rect[] = [
	{ x: 12, y: 1, w: 6, h: 5 },
	{ x: 3, y: 5, w: 13, h: 7 },
];
const CAT_DUCK_HITBOXES: Rect[] = [{ x: 2, y: 1, w: 19, h: 6 }];

function paint(rows: string[]) {
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(...rows.map((row) => row.length));
	canvas.height = rows.length;
	const ctx = canvas.getContext('2d')!;

	rows.forEach((row, y) =>
		[...row].forEach((char, x) => {
			const color = PALETTE[char];
			if (!color) return;
			ctx.fillStyle = color;
			ctx.fillRect(x, y, 1, 1);
		}),
	);

	return canvas;
}

/** Every empty pixel touching the art becomes rim, on a grid one pixel bigger all round. */
function outline(rows: string[]) {
	const width = Math.max(...rows.map((row) => row.length));
	const solid = (x: number, y: number) => (rows[y]?.[x] ?? '.') in PALETTE;

	return Array.from({ length: rows.length + 2 }, (_, y) =>
		Array.from({ length: width + 2 }, (_, x) => {
			const [sx, sy] = [x - 1, y - 1];
			if (solid(sx, sy)) return '.';
			const touching = solid(sx - 1, sy) || solid(sx + 1, sy) || solid(sx, sy - 1) || solid(sx, sy + 1);
			return touching ? 'm' : '.';
		}).join(''),
	);
}

const MOON_RADIUS = 18;

/** A crescent, cut out once so the glow can follow its shape. */
function crescent() {
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = MOON_RADIUS * 2;
	const ctx = canvas.getContext('2d')!;
	ctx.fillStyle = '#fff1d6';
	ctx.arc(MOON_RADIUS, MOON_RADIUS, MOON_RADIUS, 0, Math.PI * 2);
	ctx.fill();
	ctx.globalCompositeOperation = 'destination-out';
	ctx.beginPath();
	ctx.arc(MOON_RADIUS + 8, MOON_RADIUS - 5, 16, 0, Math.PI * 2);
	ctx.fill();
	return canvas;
}

const sprite = (rows: string[]): Sprite => ({ image: paint(rows), rim: paint(outline(rows)) });

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const pick = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)];

const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** 0 by day, 1 by night, easing between them at sunset and sunrise. */
function nightAt(clock: number) {
	const t = clock % CYCLE;
	if (t < 25) return 0;
	if (t < 35) return smoothstep((t - 25) / 10);
	if (t < 55) return 1;
	if (t < 65) return 1 - smoothstep((t - 55) / 10);
	return 0;
}

export class CatGame {
	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;
	private sprites;
	private moon = crescent();
	private resizeObserver: ResizeObserver;
	private layout: () => Layout;
	private onNight?: (amount: number) => void;
	private touch = matchMedia('(pointer: coarse)').matches;

	// World size and placement, set on resize.
	private scale = 1;
	private width = SCALE_WIDTH;
	private height = 600;
	private horizon = 415;
	/** The pier's deck, a little above the horizon, which everything stands on. */
	private ground = 400;
	private catX = 48;
	private hudRight = SCALE_WIDTH - 16;

	private raf = 0;
	private last = 0;
	private running = false;

	private state: State = 'ready';
	private deadFor = 0;
	private speed = START_SPEED;
	private distance = 0;
	private bonus = 0;
	private highScore = 0;
	private gap = 0;
	private sparrowIn = 0;
	private animation = 0;
	/** Seconds of play, for the day/night cycle. Keeps going across restarts so it doesn't snap back to day. */
	private clock = 0;
	private night = 0;

	private catBottom = 0;
	private velocity = 0;
	private jumpHeld = false;
	private downHeld = false;
	private jumpBuffer = 0;

	private things: Thing[] = [];
	private popups: { x: number; y: number; age: number }[] = [];
	/** Glints on the water just below the horizon. */
	private ripples = Array.from({ length: 36 }, () => ({
		x: Math.random(),
		y: 8 + Math.random() ** 2 * 40,
		w: 3 + Math.floor(Math.random() * 4) * 3,
	}));

	private touchStartY: number | null = null;

	constructor(canvas: HTMLCanvasElement, { layout, onNight }: Options) {
		this.canvas = canvas;
		this.layout = layout;
		this.onNight = onNight;
		this.ctx = canvas.getContext('2d')!;
		this.sprites = {
			runA: sprite(CAT_RUN_A),
			runB: sprite(CAT_RUN_B),
			duckA: sprite(CAT_DUCK_A),
			duckB: sprite(CAT_DUCK_B),
			dead: sprite(CAT_DEAD),
			hawkUp: sprite(HAWK_UP),
			hawkDown: sprite(HAWK_DOWN),
			sparrowUp: sprite(SPARROW_UP),
			sparrowDown: sprite(SPARROW_DOWN),
			crate: sprite(CRATE),
		};
		this.resizeObserver = new ResizeObserver(() => this.resize());

		try {
			this.highScore = Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0;
		} catch {
			// Storage can be blocked; the high score just won't persist.
		}
	}

	start() {
		if (this.running) return;
		this.running = true;
		this.clock = 0;
		this.night = 0;
		this.resize();
		this.reset();
		this.state = 'ready';

		this.resizeObserver.observe(this.canvas);
		window.addEventListener('keydown', this.onKeyDown);
		window.addEventListener('keyup', this.onKeyUp);
		this.canvas.addEventListener('pointerdown', this.onPointerDown);
		this.canvas.addEventListener('pointermove', this.onPointerMove);
		window.addEventListener('pointerup', this.onPointerUp);
		window.addEventListener('pointercancel', this.onPointerUp);

		this.last = performance.now();
		this.raf = requestAnimationFrame(this.frame);
	}

	stop() {
		if (!this.running) return;
		this.running = false;
		cancelAnimationFrame(this.raf);

		this.resizeObserver.disconnect();
		window.removeEventListener('keydown', this.onKeyDown);
		window.removeEventListener('keyup', this.onKeyUp);
		this.canvas.removeEventListener('pointerdown', this.onPointerDown);
		this.canvas.removeEventListener('pointermove', this.onPointerMove);
		window.removeEventListener('pointerup', this.onPointerUp);
		window.removeEventListener('pointercancel', this.onPointerUp);
	}

	private get distanceScore() {
		return Math.floor(this.distance / 10);
	}

	private get score() {
		return this.distanceScore + this.bonus;
	}

	private get grounded() {
		return this.catBottom >= this.ground;
	}

	private get ducking() {
		return this.downHeld && this.grounded && this.state === 'running';
	}

	private reset() {
		this.speed = START_SPEED;
		this.distance = 0;
		this.bonus = 0;
		this.things = [];
		this.popups = [];
		this.gap = this.width * 0.5;
		this.sparrowIn = 2;
		this.catBottom = this.ground;
		this.velocity = 0;
		this.jumpBuffer = 0;
		this.deadFor = 0;
	}

	// Input ------------------------------------------------------------------

	private pressJump() {
		this.jumpHeld = true;

		if (this.state === 'ready') {
			this.state = 'running';
		} else if (this.state === 'dead') {
			if (this.deadFor < RESTART_DELAY) return;
			this.reset();
			this.state = 'running';
		}

		this.jumpBuffer = JUMP_BUFFER;
	}

	private releaseJump() {
		this.jumpHeld = false;
		if (this.velocity < -JUMP_CUT) this.velocity = -JUMP_CUT;
	}

	private onKeyDown = (event: KeyboardEvent) => {
		// Leave Space/Enter alone on buttons, so the close button still works from the keyboard.
		if (event.target instanceof HTMLButtonElement) return;

		if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') {
			event.preventDefault();
			if (!event.repeat) this.pressJump();
		} else if (event.code === 'ArrowDown' || event.code === 'KeyS') {
			event.preventDefault();
			this.downHeld = true;
		}
	};

	private onKeyUp = (event: KeyboardEvent) => {
		if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') {
			this.releaseJump();
		} else if (event.code === 'ArrowDown' || event.code === 'KeyS') {
			this.downHeld = false;
		}
	};

	// Tap to jump; drag down to fast-fall, then keep holding to duck.
	private onPointerDown = (event: PointerEvent) => {
		event.preventDefault();
		this.touchStartY = event.clientY;
		this.pressJump();
	};

	private onPointerMove = (event: PointerEvent) => {
		if (this.touchStartY === null) return;
		if (event.clientY - this.touchStartY > 24) {
			this.releaseJump();
			this.downHeld = true;
		}
	};

	private onPointerUp = () => {
		if (this.touchStartY === null) return;
		this.touchStartY = null;
		this.releaseJump();
		this.downHeld = false;
	};

	// Loop -------------------------------------------------------------------

	private frame = (now: number) => {
		// Clamp the step so a dropped frame or a backgrounded tab can't teleport the cat through a box.
		const dt = Math.min((now - this.last) / 1000, 1 / 30);
		this.last = now;

		this.update(dt);
		this.draw();

		this.raf = requestAnimationFrame(this.frame);
	};

	private resize() {
		const ratio = devicePixelRatio || 1;
		const { clientWidth, clientHeight } = this.canvas;
		const layout = this.layout();
		const wasGrounded = this.grounded;

		this.scale = Math.min(Math.max(clientWidth / SCALE_WIDTH, MIN_SCALE), MAX_SCALE);
		this.width = clientWidth / this.scale;
		this.height = clientHeight / this.scale;
		this.horizon = Math.round(layout.horizon / this.scale);
		this.ground = this.horizon - PIER_HEIGHT;
		this.catX = Math.round(layout.left / this.scale);
		this.hudRight = layout.right / this.scale;

		// Keep everything standing on the (possibly moved) horizon.
		if (wasGrounded) this.catBottom = this.ground;
		for (const thing of this.things) thing.y = this.ground - thing.lift - thing.h;

		this.canvas.width = Math.round(clientWidth * ratio);
		this.canvas.height = Math.round(clientHeight * ratio);
		this.ctx.setTransform(ratio * this.scale, 0, 0, ratio * this.scale, 0, 0);
		this.ctx.imageSmoothingEnabled = false;
		this.draw();
	}

	private update(dt: number) {
		for (const popup of this.popups) popup.age += dt;
		this.popups = this.popups.filter((popup) => popup.age < 0.9);

		if (this.state === 'dead') {
			this.deadFor += dt;
			return;
		}

		if (this.state !== 'running') return;

		this.clock += dt;
		this.night = nightAt(this.clock);
		this.onNight?.(this.night);

		this.speed = Math.min(MAX_SPEED, this.speed + ACCELERATION * dt);
		const step = this.speed * dt;
		this.distance += step;
		this.animation += dt * (this.speed / START_SPEED);

		// The cat.
		this.jumpBuffer -= dt;
		if (this.grounded && this.jumpBuffer > 0) {
			this.velocity = -JUMP_VELOCITY;
			this.jumpBuffer = 0;
			if (!this.jumpHeld) this.velocity = -JUMP_CUT;
		}

		const gravity = this.downHeld && !this.grounded ? GRAVITY * FAST_FALL : GRAVITY;
		this.velocity += gravity * dt;
		this.catBottom += this.velocity * dt;
		if (this.catBottom >= this.ground) {
			this.catBottom = this.ground;
			this.velocity = 0;
		}

		// Ripples further from the horizon are closer to you, so they drift past faster.
		for (const ripple of this.ripples) {
			ripple.x -= (step * (0.4 + ripple.y / 40)) / this.width;
			if (ripple.x < 0) ripple.x += 1;
		}

		// Everything else.
		for (const thing of this.things) {
			const extra = thing.kind === 'hawk' ? HAWK_SPEED : thing.kind === 'sparrow' ? SPARROW_SPEED : 0;
			thing.x -= step + extra * dt;
			if (thing.flap !== undefined) thing.flap += dt;
		}
		this.things = this.things.filter((thing) => thing.x + thing.w > 0);

		this.gap -= step;
		if (this.gap <= 0) this.spawnObstacle();

		this.sparrowIn -= dt;
		if (this.sparrowIn <= 0) this.spawnSparrow();

		const cat = this.catHitboxes();
		const touching = (thing: Thing, inset: number) => {
			const box = { x: thing.x + inset, y: thing.y + inset, w: thing.w - inset * 2, h: thing.h - inset * 2 };
			return cat.some((part) => overlaps(part, box));
		};

		// Sparrows are a snack: catch one for points.
		this.things = this.things.filter((thing) => {
			if (thing.kind !== 'sparrow' || !touching(thing, 0)) return true;
			this.bonus += SPARROW_POINTS;
			this.popups.push({ x: thing.x + thing.w / 2, y: thing.y, age: 0 });
			return false;
		});

		const hit = this.things.some(
			(thing) => thing.kind !== 'sparrow' && touching(thing, thing.kind === 'hawk' ? 2 * P : P),
		);
		if (hit) this.die();
	}

	private spawnObstacle() {
		const hawk = this.distanceScore >= HAWKS_FROM_SCORE && Math.random() < 0.3;
		let thing: Thing;

		if (hawk) {
			const { image } = this.sprites.hawkUp;
			const [w, h] = [image.width * P, image.height * P];
			// Low hawks you jump, mid hawks you duck under, high hawks you just keep running under.
			const lift = pick([4, 22, 62]);
			thing = { kind: 'hawk', x: this.width, y: this.ground - lift - h, w, h, lift, flap: Math.random() };
		} else {
			const fast = this.speed > START_SPEED * 1.4;
			const [cols, rows] = pick<[number, number]>(
				fast ? [[1, 1], [2, 1], [3, 1], [1, 2], [2, 2]] : [[1, 1], [1, 1], [2, 1], [1, 2]],
			);
			const size = this.sprites.crate.image.width * P;
			const h = rows * size;
			thing = { kind: 'crates', x: this.width, y: this.ground - h, w: cols * size, h, lift: 0, cols, rows };
		}

		this.things.push(thing);

		// Leave at least a full jump's worth of ground before the next one, more as it speeds up.
		const airtime = (2 * JUMP_VELOCITY) / GRAVITY;
		const minimum = this.speed * airtime * 0.9 + 110;
		this.gap = thing.w + minimum * (1 + Math.random() * 0.9);
	}

	private spawnSparrow() {
		const { image } = this.sprites.sparrowUp;
		const [w, h] = [image.width * P, image.height * P];
		// Some you run into, some you have to jump for.
		const lift = pick([6, 30, 70, 100]);
		this.things.push({ kind: 'sparrow', x: this.width, y: this.ground - lift - h, w, h, lift, flap: Math.random() });
		this.sparrowIn = 1.5 + Math.random() * 3;
	}

	private die() {
		this.state = 'dead';
		this.deadFor = 0;

		if (this.score > this.highScore) {
			this.highScore = this.score;
			try {
				localStorage.setItem(HIGH_SCORE_KEY, String(this.highScore));
			} catch {
				// See constructor.
			}
		}
	}

	private catSprite() {
		const step = Math.floor(this.animation / 0.1) % 2 === 0;

		if (this.state === 'dead') return this.sprites.dead;
		if (this.state === 'ready' || !this.grounded) return this.sprites.runA;
		if (this.ducking) return step ? this.sprites.duckA : this.sprites.duckB;
		return step ? this.sprites.runA : this.sprites.runB;
	}

	private catHitboxes(): Rect[] {
		const top = this.catBottom - this.catSprite().image.height * P;
		return (this.ducking ? CAT_DUCK_HITBOXES : CAT_HITBOXES).map((box) => ({
			x: this.catX + box.x * P,
			y: top + box.y * P,
			w: box.w * P,
			h: box.h * P,
		}));
	}

	// Drawing ----------------------------------------------------------------

	private draw() {
		const { ctx } = this;
		ctx.clearRect(0, 0, this.width, this.height);

		this.drawMoon();

		ctx.fillStyle = `rgb(255 200 140 / ${0.35 - this.night * 0.15})`;
		for (const ripple of this.ripples) {
			ctx.fillRect(Math.round(ripple.x * this.width), Math.round(this.horizon + ripple.y), ripple.w, 1.5);
		}

		this.drawPier();

		for (const thing of this.things) {
			if (thing.kind === 'crates') {
				const size = this.sprites.crate.image.width * P;
				for (let col = 0; col < (thing.cols ?? 1); col++) {
					for (let row = 0; row < (thing.rows ?? 1); row++) {
						this.drawSprite(this.sprites.crate, thing.x + col * size, thing.y + row * size);
					}
				}
				continue;
			}

			const up = Math.floor((thing.flap ?? 0) / (thing.kind === 'hawk' ? 0.18 : 0.1)) % 2 === 0;
			const [upFrame, downFrame] =
				thing.kind === 'hawk'
					? [this.sprites.hawkUp, this.sprites.hawkDown]
					: [this.sprites.sparrowUp, this.sprites.sparrowDown];
			this.drawSprite(up ? upFrame : downFrame, thing.x, thing.y);
		}

		const cat = this.catSprite();
		this.drawSprite(cat, this.catX, this.catBottom - cat.image.height * P);

		// "+50" floating up from each sparrow caught.
		ctx.textAlign = 'center';
		ctx.textBaseline = 'bottom';
		ctx.font = '700 14px ui-monospace, SFMono-Regular, Menlo, monospace';
		ctx.fillStyle = PALETTE.t;
		for (const popup of this.popups) {
			ctx.globalAlpha = 1 - popup.age / 0.9;
			ctx.fillText(`+${SPARROW_POINTS}`, popup.x, popup.y - popup.age * 40);
		}
		ctx.globalAlpha = 1;

		// Score, below the exit button.
		ctx.textBaseline = 'top';
		ctx.textAlign = 'right';
		ctx.fillStyle = 'rgb(255 244 230 / 0.6)';
		const pad = (value: number) => String(value).padStart(5, '0');
		const top = 88 / this.scale;
		ctx.fillText(`HI ${pad(this.highScore)}`, this.hudRight - 66, top);
		ctx.fillStyle = '#fff4e6';
		ctx.fillText(pad(this.score), this.hudRight, top);

		// Messages.
		ctx.textAlign = 'center';
		if (this.state === 'ready') {
			this.drawMessage(
				this.touch ? 'Tap to start' : 'Press Space to start',
				this.touch ? 'Tap to jump, drag down to duck' : 'Space or ↑ to jump, ↓ to duck',
				'Eat the teal birds, dodge the red-eyed hawks',
			);
		} else if (this.state === 'dead') {
			const retry = this.touch ? 'Tap to try again' : 'Space to try again';
			this.drawMessage('GAME OVER', this.deadFor >= RESTART_DELAY ? retry : '');
		}
	}

	/** A crescent moon that rises as night falls. */
	private drawMoon() {
		if (this.night <= 0) return;
		const { ctx } = this;
		const x = this.width * 0.3;
		const y = this.ground * (0.3 + (1 - this.night) * 0.5);

		ctx.globalAlpha = this.night;
		ctx.shadowColor = 'rgb(255 241 214 / 0.7)';
		ctx.shadowBlur = 30;
		ctx.drawImage(this.moon, x - MOON_RADIUS, y - MOON_RADIUS);
		ctx.shadowBlur = 0;
		ctx.globalAlpha = 1;
	}

	/** A boardwalk along the horizon: a planked deck on posts that sink into the water. */
	private drawPier() {
		const { ctx, ground } = this;
		const postDepth = this.horizon - ground + POST_DEPTH;

		// Posts stand clear of the water down to the horizon, then fade as they sink in.
		const posts = ctx.createLinearGradient(0, this.horizon, 0, this.horizon + POST_DEPTH);
		posts.addColorStop(0, WOOD);
		posts.addColorStop(1, 'rgb(42 24 56 / 0)');
		ctx.fillStyle = posts;
		for (let x = -(this.distance % POST_GAP); x < this.width; x += POST_GAP) {
			ctx.fillRect(Math.round(x), ground, 2 * P, postDepth);
		}

		ctx.fillStyle = WOOD;
		ctx.fillRect(0, ground, this.width, DECK);

		ctx.fillStyle = INK;
		ctx.fillRect(0, ground + DECK - 1, this.width, 1);
		for (let x = -(this.distance % PLANK); x < this.width; x += PLANK) {
			ctx.fillRect(Math.round(x), ground + 1, 1, DECK - 1);
		}

		// The top edge catches the sun by day and the moon by night.
		ctx.fillStyle = SUNLIT;
		ctx.globalAlpha = 1 - this.night;
		ctx.fillRect(0, ground, this.width, 1.5);
		ctx.fillStyle = MOONLIT;
		ctx.globalAlpha = this.night;
		ctx.fillRect(0, ground, this.width, 1.5);
		ctx.globalAlpha = 1;
	}

	private drawMessage(title: string, ...lines: string[]) {
		const { ctx } = this;
		const top = this.ground - 175;
		ctx.textBaseline = 'top';
		ctx.fillStyle = '#fff4e6';
		ctx.shadowColor = 'rgb(18 13 38 / 0.6)';
		ctx.shadowBlur = 8;
		ctx.font = '700 18px ui-monospace, SFMono-Regular, Menlo, monospace';
		ctx.fillText(title, this.width / 2, top);
		ctx.font = '500 13px ui-monospace, SFMono-Regular, Menlo, monospace';
		lines.forEach((line, index) => line && ctx.fillText(line, this.width / 2, top + 30 + index * 20));
		ctx.shadowBlur = 0;
	}

	private drawSprite({ image, rim }: Sprite, x: number, y: number) {
		const [left, top] = [Math.round(x), Math.round(y)];

		if (this.night > 0) {
			this.ctx.globalAlpha = this.night;
			this.ctx.drawImage(rim, left - P, top - P, rim.width * P, rim.height * P);
			this.ctx.globalAlpha = 1;
		}

		this.ctx.drawImage(image, left, top, image.width * P, image.height * P);
	}
}
