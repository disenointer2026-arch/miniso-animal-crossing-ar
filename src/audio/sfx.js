/* Efectos de sonido sintetizados con Web Audio: no usan archivos, asi que no hay
   derechos de autor de por medio. Mismo enfoque que la pagina original.
   El navegador bloquea el audio hasta un gesto: unlock() se llama al pulsar "Comenzar".
   Dos buses de volumen independientes (efectos y musica). */

let ctx = null;
let noise = null;
const bus = { sfx: null, music: null };
let spray = null;
let music = null;
const volume = { sfx: 0.7, music: 0.3 };

function ensure() {
  if (!ctx) {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return null;
    ctx = new Context();
    bus.sfx = ctx.createGain();
    bus.music = ctx.createGain();
    bus.sfx.gain.value = volume.sfx;
    bus.music.gain.value = volume.music;
    bus.sfx.connect(ctx.destination);
    bus.music.connect(ctx.destination);
    // Un segundo de ruido blanco, reutilizado por el aerosol y la maquina
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Notas cortas: freqs en Hz, una tras otra cada "step" segundos. */
function notes(freqs, { step = 0.06, dur = 0.12, type = 'sine', gain = 0.25 } = {}) {
  const c = ensure();
  if (!c) return;
  freqs.forEach((f, i) => {
    const t = c.currentTime + i * step;
    const osc = c.createOscillator();
    const amp = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(amp).connect(bus.sfx);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  });
}

/** Ruido filtrado con envolvente: frecuencia central, duracion y volumen. */
function burst(freq, seconds, gain, q = 1) {
  const c = ensure();
  if (!c) return null;
  const src = c.createBufferSource();
  const filter = c.createBiquadFilter();
  const amp = c.createGain();
  src.buffer = noise;
  src.loop = true;
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = q;
  amp.gain.setValueAtTime(0.0001, c.currentTime);
  amp.gain.exponentialRampToValueAtTime(gain, c.currentTime + 0.04);
  src.connect(filter).connect(amp).connect(bus.sfx);
  src.start();
  if (seconds) {
    amp.gain.setValueAtTime(gain, c.currentTime + seconds - 0.12);
    amp.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + seconds);
    src.stop(c.currentTime + seconds + 0.02);
  }
  return { src, amp };
}

export const sfx = {
  unlock: ensure,
  setVolume(which, value) {
    volume[which] = Math.min(Math.max(value, 0), 1);
    if (bus[which]) bus[which].gain.value = volume[which];
  },
  getVolume: (which) => volume[which],
  /** Musica de fondo en bucle (pista de la web original, solo uso academico). Empieza con un
      gesto del usuario y se pausa cuando la pagina deja de verse. */
  playMusic() {
    const c = ensure();
    if (!c || music) return;
    music = new Audio(`${import.meta.env.BASE_URL}audio/ambiente.mp3`);
    music.loop = true;
    c.createMediaElementSource(music).connect(bus.music);
    music.play().catch(() => {});
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) music.pause();
      else music.play().catch(() => {});
    });
  },
  /** Boton pulsado / opcion elegida */
  select: () => notes([660, 880], { step: 0.05, dur: 0.09 }),
  /** Pieza que llega a su sitio */
  ding: () => notes([523, 659, 784], { step: 0.09, dur: 0.16 }),
  /** Golpe seco: la lata cae, el objeto se coloca */
  thunk() {
    notes([140, 90], { step: 0.04, dur: 0.12, type: 'triangle', gain: 0.4 });
  },
  /** Maquina trabajando */
  whirr(seconds = 2.4) {
    burst(520, seconds, 0.12, 2);
    notes([180, 220, 260, 220], { step: seconds / 4, dur: seconds / 3, type: 'sawtooth', gain: 0.05 });
  },
  discard: () => notes([392, 294, 196], { step: 0.07, dur: 0.12, type: 'triangle' }),
  /** Aerosol: empieza / termina mientras el pellizco sigue activo */
  sprayStart() {
    if (spray) return;
    spray = burst(4200, 0, 0.18, 0.7);
  },
  sprayStop() {
    if (!spray || !ctx) return;
    const { src, amp } = spray;
    amp.gain.cancelScheduledValues(ctx.currentTime);
    amp.gain.setValueAtTime(amp.gain.value, ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
    src.stop(ctx.currentTime + 0.15);
    spray = null;
  },
};
