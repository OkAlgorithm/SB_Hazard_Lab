# Russian lecture narration

Voice: `ru_eduard` from Silero `v5_cis_base_nostress` (MIT CIS base model).
Source: https://github.com/snakers4/silero-models

Seven MP3 files speak the existing lecture verbatim, with explicit Russian
stress and ё pronunciation. The tracks fit the existing 22/26/26/26/25/25/30-second
scenes. Loudness is normalized; there is no music. Playback is local to the
site and does not depend on installed system voices or external TTS services.

Reproduce with `tools/render-lecture-voice.py --model <v5_cis_base_nostress.pt>`.
The model is not included in the site. Source text hashes, model hash and
per-track hashes are recorded in manifest.json.
