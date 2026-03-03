# /// script
# dependencies = [
#   "elevenlabs",
# ]
# ///
# run with uv run generate_tts.py, requires ELEVENLABS_API_KEY env-variable to be set
import json
import os
from pathlib import Path

from elevenlabs.client import ElevenLabs

VOICE_IDS = {
    "female": "EST9Ui6982FZPSi7gCHi",
    "male": "oaGwHLz3csUaSnc2NBD4",
}
MODEL_ID = "eleven_multilingual_v2"
OUTPUT_FORMAT = "mp3_44100_128"


def load_env_key():
    key = os.getenv("ELEVENLABS_API_KEY")
    if key:
        return key
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        return None
    for line in env_path.read_text().splitlines():
        if line.startswith("ELEVENLABS_API_KEY="):
            return line.split("=", 1)[1].strip()
    return None


def main():
    api_key = load_env_key()
    if not api_key:
        raise SystemExit("Missing ELEVENLABS_API_KEY")

    base_dir = Path(__file__).resolve().parents[1]
    lines_path = base_dir / "scripts" / "voicelines.json"
    if not lines_path.exists():
        raise SystemExit("Missing scripts/voicelines.json")

    voicelines = json.loads(lines_path.read_text())
    out_dir = base_dir / "public" / "audio"
    out_dir.mkdir(exist_ok=True)

    client = ElevenLabs(api_key=api_key)

    for voice_name, voice_id in VOICE_IDS.items():
        voice_dir = out_dir / voice_name
        voice_dir.mkdir(parents=True, exist_ok=True)
        for key, text in voicelines.items():
            out_path = voice_dir / f"{key}.mp3"
            if out_path.exists():
                continue
            audio = client.text_to_speech.convert(
                text=text,
                voice_id=voice_id,
                model_id=MODEL_ID,
                output_format=OUTPUT_FORMAT,
            )
            out_path.write_bytes(b"".join(audio))
            print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
