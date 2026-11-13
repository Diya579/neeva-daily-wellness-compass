// Procedurally generated ambient soundscapes via Web Audio — no audio files needed. Browser-only.
export type Ambient = "rain" | "forest" | "cafe" | "drone";

type Voice = { gain: GainNode; stop: () => void };

let ctx: AudioContext | null = null;
const voices = new Map<Ambient, Voice>();

function audio() {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function noise(c: AudioContext, kind: "white" | "brown") {
  const len = c.sampleRate * 3;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === "white") d[i] = w;
    else {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  return src;
}

function chirp(c: AudioContext, out: AudioNode, base: number, type: OscillatorType = "sine", dur = 0.18, vol = 0.05) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  const t = c.currentTime;
  o.frequency.setValueAtTime(base, t);
  o.frequency.exponentialRampToValueAtTime(base * 1.5, t + dur * 0.6);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function build(kind: Ambient): Voice {
  const c = audio();
  const master = c.createGain();
  master.gain.setValueAtTime(0, c.currentTime);
  master.connect(c.destination);
  const stops: (() => void)[] = [];

  if (kind === "rain") {
    const n = noise(c, "white");
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 900;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 7000;
    const g = c.createGain();
    g.gain.value = 0.12;
    n.connect(hp).connect(lp).connect(g).connect(master);
    n.start();
    stops.push(() => n.stop());
  }
  if (kind === "forest") {
    const n = noise(c, "brown");
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 600;
    const g = c.createGain();
    g.gain.value = 0.35;
    n.connect(lp).connect(g).connect(master);
    n.start();
    const id = window.setInterval(() => {
      if (Math.random() < 0.55) {
        const f = 2200 + Math.random() * 1800;
        chirp(c, master, f);
        window.setTimeout(() => chirp(c, master, f * 1.1), 160);
      }
    }, 1400);
    stops.push(() => n.stop(), () => window.clearInterval(id));
  }
  if (kind === "cafe") {
    const n = noise(c, "brown");
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 500;
    bp.Q.value = 0.6;
    const g = c.createGain();
    g.gain.value = 0.5;
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.frequency.value = 0.15;
    lfoGain.gain.value = 0.15;
    lfo.connect(lfoGain).connect(g.gain);
    n.connect(bp).connect(g).connect(master);
    n.start();
    lfo.start();
    const id = window.setInterval(() => {
      if (Math.random() < 0.3) chirp(c, master, 2800 + Math.random() * 1200, "triangle", 0.12, 0.025);
    }, 2200);
    stops.push(() => n.stop(), () => lfo.stop(), () => window.clearInterval(id));
  }
  if (kind === "drone") {
    [174, 261.6, 392].forEach((f, i) => {
      const o = c.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      const g = c.createGain();
      g.gain.value = 0.05 / (i + 1);
      const lfo = c.createOscillator();
      const lg = c.createGain();
      lfo.frequency.value = 0.07 + i * 0.03;
      lg.gain.value = 0.02 / (i + 1);
      lfo.connect(lg).connect(g.gain);
      o.connect(g).connect(master);
      o.start();
      lfo.start();
      stops.push(() => o.stop(), () => lfo.stop());
    });
  }

  master.gain.linearRampToValueAtTime(1, c.currentTime + 1.2);
  return {
    gain: master,
    stop: () => {
      const t = c.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(0, t + 0.6);
      window.setTimeout(() => {
        stops.forEach((s) => {
          try {
            s();
          } catch {
            /* already stopped */
          }
        });
        master.disconnect();
      }, 700);
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
