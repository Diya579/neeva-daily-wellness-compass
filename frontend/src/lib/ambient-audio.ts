// Procedurally generated ambient soundscapes via Web Audio — no audio files needed. Browser-only.
export type Ambient = "rain" | "forest" | "cafe" | "drone" | "morning" | "ocean";

type Voice = { gain: GainNode; stop: () => void };

let ctx: AudioContext | null = null;
let bus: GainNode | null = null;
let analyser: AnalyserNode | null = null;
let volume = 0.75;
const voices = new Map<Ambient, Voice>();

function audio() {
  if (!ctx) {
    ctx = new AudioContext();
    bus = ctx.createGain();
    bus.gain.value = volume;
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    bus.connect(analyser).connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** 0–1 loudness of everything currently playing (for the live level meter). */
export function getAmbientLevel(): number {
  if (!analyser || voices.size === 0) return 0;
  const buf = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buf);
  let sum = 0;
  for (const v of buf) sum += v * v;
  return Math.min(1, Math.sqrt(sum / buf.length) * 6);
}

export function setAmbientVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
  if (bus && ctx) bus.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
}

export const isAmbientOn = (k: Ambient) => voices.has(k);

function noise(c: AudioContext, kind: "white" | "brown" | "pink") {
  const len = c.sampleRate * 4;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === "white") {
      d[i] = w;
    } else if (kind === "pink") {
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.0168980;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.06;
      b6 = w * 0.115926;
    } else {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.2;
    }
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  return src;
}

function chirp(
  c: AudioContext,
  out: AudioNode,
  base: number,
  type: OscillatorType = "sine",
  dur = 0.18,
  vol = 0.05,
) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  const t = c.currentTime;
  o.frequency.setValueAtTime(base, t);
  o.frequency.exponentialRampToValueAtTime(base * 1.4, t + dur * 0.6);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** Soft harmonic singing-bowl chime for morning meditation. */
function bowlChime(c: AudioContext, out: AudioNode, freq: number, vol = 0.045) {
  const t = c.currentTime;
  [1, 2.76].forEach((ratio, idx) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(freq * ratio, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol / (idx + 1), t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (idx === 0 ? 4.2 : 2.1));
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 4.4);
  });
}

function build(kind: Ambient): Voice {
  const c = audio();
  const master = c.createGain();
  master.gain.setValueAtTime(0, c.currentTime);
  master.connect(bus!);
  const stops: (() => void)[] = [];

  if (kind === "rain") {
    // Soft monsoon rain using pink noise + gentle swell LFO (warm, never harsh static)
    const n = noise(c, "pink");
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 400;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 3200;
    const g = c.createGain();
    g.gain.value = 0.32;
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = 0.08;
    lg.gain.value = 0.08;
    lfo.connect(lg).connect(g.gain);
    n.connect(hp).connect(lp).connect(g).connect(master);
    n.start();
    lfo.start();
    stops.push(() => n.stop(), () => lfo.stop());
  }

  if (kind === "morning") {
    // Warm sunrise breeze + periodic gentle singing-bowl chimes & soft morning birds
    const n = noise(c, "pink");
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 750;
    const g = c.createGain();
    g.gain.value = 0.18;
    n.connect(lp).connect(g).connect(master);
    n.start();

    const notes = [396, 432, 528, 594];
    bowlChime(c, master, 432, 0.04);
    const chimeId = window.setInterval(() => {
      const f = notes[Math.floor(Math.random() * notes.length)]!;
      bowlChime(c, master, f, 0.038);
    }, 6500);
    const birdId = window.setInterval(() => {
      if (Math.random() < 0.45) {
        const f = 2400 + Math.random() * 1200;
        chirp(c, master, f, "sine", 0.16, 0.025);
        window.setTimeout(() => chirp(c, master, f * 1.12, "sine", 0.14, 0.02), 180);
      }
    }, 3200);
    stops.push(
      () => n.stop(),
      () => window.clearInterval(chimeId),
      () => window.clearInterval(birdId),
    );
  }

  if (kind === "ocean") {
    // Slow rhythmic ocean waves rolling in and out every ~9 seconds + warm low pad
    const n = noise(c, "brown");
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 480;
    const waveGain = c.createGain();
    waveGain.gain.value = 0.24;

    const waveLfo = c.createOscillator();
    const waveDepth = c.createGain();
    waveLfo.type = "sine";
    waveLfo.frequency.value = 0.11; // ~9-second tide cycle
    waveDepth.gain.value = 0.18;
    waveLfo.connect(waveDepth).connect(waveGain.gain);

    // Filter frequency rises as each wave crests
    const filterDepth = c.createGain();
    filterDepth.gain.value = 260;
    waveLfo.connect(filterDepth).connect(lp.frequency);

    n.connect(lp).connect(waveGain).connect(master);
    n.start();
    waveLfo.start();

    // Subtle warm 110Hz sleep hum
    const pad = c.createOscillator();
    const padGain = c.createGain();
    pad.type = "sine";
    pad.frequency.value = 110;
    padGain.gain.value = 0.022;
    pad.connect(padGain).connect(master);
    pad.start();

    stops.push(() => n.stop(), () => waveLfo.stop(), () => pad.stop());
  }

  if (kind === "forest") {
    const n = noise(c, "brown");
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 520;
    const g = c.createGain();
    g.gain.value = 0.32;
    n.connect(lp).connect(g).connect(master);
    n.start();
    const id = window.setInterval(() => {
      if (Math.random() < 0.5) {
        const f = 2200 + Math.random() * 1600;
        chirp(c, master, f, "sine", 0.18, 0.032);
        window.setTimeout(() => chirp(c, master, f * 1.1, "sine", 0.16, 0.025), 160);
      }
    }, 1800);
    stops.push(
      () => n.stop(),
      () => window.clearInterval(id),
    );
  }

  if (kind === "cafe") {
    const n = noise(c, "brown");
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 500;
    bp.Q.value = 0.6;
    const g = c.createGain();
    g.gain.value = 0.45;
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.frequency.value = 0.15;
    lfoGain.gain.value = 0.15;
    lfo.connect(lfoGain).connect(g.gain);
    n.connect(bp).connect(g).connect(master);
    n.start();
    lfo.start();
    const id = window.setInterval(() => {
      if (Math.random() < 0.3)
        chirp(c, master, 2800 + Math.random() * 1200, "triangle", 0.12, 0.025);
    }, 2200);
    stops.push(
      () => n.stop(),
      () => lfo.stop(),
      () => window.clearInterval(id),
    );
  }

  if (kind === "drone") {
    [174, 261.6, 392].forEach((f, i) => {
      const o = c.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      const g = c.createGain();
      g.gain.value = 0.045 / (i + 1);
      const lfo = c.createOscillator();
      const lg = c.createGain();
      lfo.frequency.value = 0.07 + i * 0.03;
      lg.gain.value = 0.018 / (i + 1);
      lfo.connect(lg).connect(g.gain);
      o.connect(g).connect(master);
      o.start();
      lfo.start();
      stops.push(
        () => o.stop(),
        () => lfo.stop(),
      );
    });
  }

  master.gain.linearRampToValueAtTime(1, c.currentTime + 1.2);
  return {
    gain: master,
    stop: () => {
      const t = c.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(0, t + 0.5);
      window.setTimeout(() => {
        stops.forEach((s) => {
          try {
            s();
          } catch {
            /* already stopped */
          }
        });
        master.disconnect();
      }, 600);
    },
  };
}

export function setAmbient(kind: Ambient, on: boolean) {
  const existing = voices.get(kind);
  if (on && !existing) voices.set(kind, build(kind));
  if (!on && existing) {
    existing.stop();
    voices.delete(kind);
  }
}

export function stopAllAmbient() {
  voices.forEach((v) => v.stop());
  voices.clear();
}
