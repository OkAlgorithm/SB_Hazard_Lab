"""Render the existing Russian lecture as self-hosted, timing-matched MP3s.

Offline build tool only; no model or inference dependency ships to the browser.
Requires CPU PyTorch, numpy, and ffmpeg. Use the MIT-licensed Silero CIS base
model, not the separately licensed Russian-only or extended checkpoints.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import wave

import numpy as np
import torch

ROOT = Path(__file__).resolve().parents[1]
DURATIONS = [22, 26, 26, 26, 25, 25, 30]
MODEL_URL = "https://models.silero.ai/models/tts/ru/v5_cis_base_nostress.pt"

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--speaker", default="ru_eduard")
    args = parser.parse_args()
    torch.set_num_threads(2)
    model = torch.package.PackageImporter(str(args.model)).load_pickle("tts_models", "model")
    model.to(torch.device("cpu"))
    assert args.speaker in model.speakers
    lesson = json.loads((ROOT / "src/content.json").read_text())["lecture"]
    pronunciations = json.loads((ROOT / "tools/lecture-pronunciation.json").read_text())
    output = ROOT / "public/audio/lecture"
    output.mkdir(parents=True, exist_ok=True)
    tracks = []
    with tempfile.TemporaryDirectory(prefix="samruk-narration-") as temporary:
        for i, (chapter, spoken, target) in enumerate(zip(lesson, pronunciations, DURATIONS)):
            # Stress marks and explicit ё affect pronunciation, never the displayed words.
            assert spoken.replace("+", "").replace("ё", "е") == chapter["voice"].replace("ё", "е")
            torch.manual_seed(42 + i)
            with torch.inference_mode():
                samples = model.apply_tts(text=spoken, speaker=args.speaker, sample_rate=24000).numpy()
            audible = np.flatnonzero(np.abs(samples) > 0.0015)
            assert len(audible), f"Empty speech for chapter {i + 1}"
            samples = samples[max(0, audible[0] - 2400):min(len(samples), audible[-1] + 3600)]
            original_seconds = len(samples) / 24000
            tempo = original_seconds / (target - 0.18)
            assert 0.65 <= tempo <= 1.35, f"Unnatural tempo for chapter {i + 1}: {tempo}"
            wav = Path(temporary) / f"{i + 1}.wav"
            with wave.open(str(wav), "wb") as writer:
                writer.setnchannels(1)
                writer.setsampwidth(2)
                writer.setframerate(24000)
                writer.writeframes((np.clip(samples, -1, 1) * 32767).astype(np.int16).tobytes())
            destination = output / f"ru-{i + 1:02}.mp3"
            subprocess.run([
                "ffmpeg", "-v", "error", "-y", "-i", str(wav),
                "-af", f"atempo={tempo:.8f},loudnorm=I=-18:TP=-1.5:LRA=7,apad=whole_dur={target},atrim=duration={target}",
                "-ar", "24000", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "96k", str(destination),
            ], check=True)
            tracks.append({
                "chapter": chapter["id"], "file": destination.name, "slot_seconds": target,
                "source_text_sha256": hashlib.sha256(chapter["voice"].encode()).hexdigest(),
                "audio_sha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
                "original_seconds": round(original_seconds, 3), "tempo": round(tempo, 5),
            })
            print(json.dumps(tracks[-1], ensure_ascii=False), flush=True)
    manifest = {
        "language": "ru-RU", "speaker": args.speaker,
        "model": "Silero v5_cis_base_nostress", "model_url": MODEL_URL,
        "model_sha256": hashlib.sha256(args.model.read_bytes()).hexdigest(),
        "model_license": "MIT (LICENSE_CIS)",
        "license_url": "https://github.com/snakers4/silero-models/blob/master/LICENSE_CIS",
        "sample_rate": 24000, "tracks": tracks,
    }
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    (output / "CREDITS.md").write_text(
        "# Russian lecture narration\n\n"
        f"Voice: `{args.speaker}` from Silero `v5_cis_base_nostress` (MIT CIS base model).\n"
        "Source: https://github.com/snakers4/silero-models\n\n"
        "Seven MP3 files speak the existing lecture verbatim, with explicit Russian\n"
        "stress and ё pronunciation. The tracks fit the existing 22/26/26/26/25/25/30-second\n"
        "scenes. Loudness is normalized; there is no music. Playback is local to the\n"
        "site and does not depend on installed system voices or external TTS services.\n\n"
        "Reproduce with `tools/render-lecture-voice.py --model <v5_cis_base_nostress.pt>`.\n"
        "The model is not included in the site. Source text hashes, model hash and\n"
        "per-track hashes are recorded in manifest.json.\n"
    )

if __name__ == "__main__":
    main()
