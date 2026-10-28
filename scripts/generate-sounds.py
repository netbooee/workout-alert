"""Synthesizes the app's sound effects into assets/sounds/*.wav.

Original sounds in a bright, playful style (marimba runs, bells, a coin ding,
a boing). Run with: python3 scripts/generate-sounds.py  (needs numpy)
Tweak a recipe below and re-run to change a sound.
"""

import wave
from pathlib import Path

import numpy as np

RATE = 44_100
OUT = Path(__file__).resolve().parent.parent / "assets" / "sounds"


def note(name: str) -> float:
    """Frequency of a note like 'C5' or 'F#6' (A4 = 440 Hz)."""
    names = {"C": -9, "C#": -8, "D": -7, "D#": -6, "E": -5, "F": -4, "F#": -3, "G": -2, "G#": -1, "A": 0, "A#": 1, "B": 2}
    pitch, octave = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((names[pitch] + 12 * (octave - 4)) / 12)


def t(seconds: float) -> np.ndarray:
    return np.arange(int(RATE * seconds)) / RATE


def envelope(x: np.ndarray, attack: float = 0.004, decay: float = 6.0) -> np.ndarray:
    times = np.arange(len(x)) / RATE
    attack_env = np.clip(times / attack, 0, 1)
    return x * attack_env * np.exp(-times * decay)


def marimba(freq: float, dur: float = 0.35) -> np.ndarray:
    x = t(dur)
    body = np.sin(2 * np.pi * freq * x)
    knock = 0.35 * np.sin(2 * np.pi * freq * 4 * x) * np.exp(-x * 40)
    return envelope(body + knock, decay=9)


def bell(freq: float, dur: float = 0.8, decay: float = 4.0) -> np.ndarray:
    x = t(dur)
    partials = [(1.0, 1.0, 1.0), (2.0, 0.45, 1.6), (2.76, 0.3, 2.2), (5.4, 0.15, 3.5)]
    out = sum(a * np.sin(2 * np.pi * freq * r * x) * np.exp(-x * decay * k) for r, a, k in partials)
    return envelope(out, attack=0.002, decay=0)


def sweep(f0: float, f1: float, dur: float, shape: str = "sine") -> np.ndarray:
    x = t(dur)
    freqs = np.geomspace(f0, f1, len(x))
    phase = 2 * np.pi * np.cumsum(freqs) / RATE
    wave_ = np.sin(phase) if shape == "sine" else 2 / np.pi * np.arcsin(np.sin(phase))
    return wave_


def place(parts: list[tuple[float, np.ndarray]], length: float) -> np.ndarray:
    """Mixes sounds starting at given times (seconds)."""
    out = np.zeros(int(RATE * length))
    for start, part in parts:
        i = int(start * RATE)
        n = min(len(part), len(out) - i)
        out[i : i + n] += part[:n]
    return out


def finish(x: np.ndarray, peak: float = 0.8) -> np.ndarray:
    fade = min(len(x), int(0.02 * RATE))
    x = x.copy()
    x[-fade:] *= np.linspace(1, 0, fade)
    return x / (np.abs(x).max() or 1) * peak


def save(name: str, x: np.ndarray) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    data = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(str(OUT / f"{name}.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(data.tobytes())
    print(f"{name}.wav  {len(x) / RATE:.2f}s")


rng = np.random.default_rng(7)

# Bubbly pop: a quick upward chirp.
pop = envelope(sweep(480, 1150, 0.09), attack=0.001, decay=28)
save("pop", finish(pop, 0.7))

# Sparkles: a fast run of high bells with a little shimmer.
sparkle = [(i * 0.045, bell(note(n), 0.45, decay=7)) for i, n in enumerate(["E6", "G6", "B6", "E7", "G7"])]
shimmer = envelope(rng.normal(0, 0.04, int(RATE * 0.5)), attack=0.05, decay=6) * np.sin(2 * np.pi * 9000 * t(0.5))
save("burst", finish(place(sparkle + [(0, shimmer)], 0.7), 0.6))

# Coin: two quick bright notes.
save("xp", finish(place([(0, bell(note("B5"), 0.12, 9)), (0.08, bell(note("E6"), 0.45, 5))], 0.55)))

# Success: a marimba run up the major chord, then the chord together.
run = [(i * 0.07, marimba(note(n))) for i, n in enumerate(["C5", "E5", "G5"])]
chord = [(0.21, 0.6 * marimba(note(n), 0.5)) for n in ["C6", "E5", "G5"]]
save("success", finish(place(run + chord, 0.75)))

# Level up: a quick fanfare climbing two octaves into a ringing chord.
fanfare = [(i * 0.06, marimba(note(n), 0.3)) for i, n in enumerate(["C5", "E5", "G5", "C6", "E6", "G6"])]
ring = [(0.36, 0.5 * bell(note(n), 1.0, 2.5)) for n in ["C6", "E6", "G6"]]
save("levelup", finish(place(fanfare + ring, 1.4)))

# Streak: a flame whoosh that swells, rising underneath, then a warm bell.
noise = rng.normal(0, 1, int(RATE * 0.5))
noise = np.convolve(noise, np.ones(30) / 30, mode="same")  # soften the hiss
swell = noise * np.sin(np.pi * t(0.5) / 0.5) ** 2
rise = 0.4 * sweep(180, 420, 0.5) * np.sin(np.pi * t(0.5) / 0.5)
save("streak", finish(place([(0, 0.6 * swell), (0, rise), (0.38, bell(note("G5"), 0.6, 4))], 1.0)))

# Nudge: a springy boing that wobbles up and settles.
x = t(0.38)
freqs = 260 + 220 * np.sin(np.pi * np.clip(x / 0.25, 0, 1)) * np.exp(-x * 3) + 12 * np.sin(2 * np.pi * 18 * x)
boing = 2 / np.pi * np.arcsin(np.sin(2 * np.pi * np.cumsum(freqs) / RATE))
save("nudge", finish(envelope(boing, attack=0.003, decay=7), 0.7))

# Banner: a soft two-note chime.
save("banner", finish(place([(0, marimba(note("A5"), 0.3)), (0.11, marimba(note("D6"), 0.45))], 0.6), 0.5))
