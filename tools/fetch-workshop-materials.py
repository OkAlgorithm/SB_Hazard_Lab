"""Fetch the redistributable CC0 materials used by the workshop (no runtime CDN)."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import hashlib, json, urllib.request

ROOT = Path(__file__).resolve().parents[1] / "public/assets/workshop"
ROOT.mkdir(parents=True, exist_ok=True)
SETS = [
    ("floor", "concrete_floor_worn_001", "2k", 3),
    ("plaster", "painted_plaster_wall", "1k", 2),
    ("painted-metal", "green_metal_rust", "1k", 1),
    ("wood", "wood_planks", "1k", 1.5),
]
JOBS = []
for prefix, asset, size, metres in SETS:
    for name, suffix in [("albedo", "diff"), ("normal", "nor_gl"), ("roughness", "rough")]:
        url = f"https://dl.polyhaven.org/file/ph-assets/Textures/jpg/{size}/{asset}/{asset}_{suffix}_{size}.jpg"
        JOBS.append((f"{prefix}-{name}.jpg", url, f"https://polyhaven.com/a/{asset}", metres))
JOBS.append(("workshop.env", "https://assets.babylonjs.com/environments/environmentSpecular.env", "https://github.com/BabylonJS/Assets", None))

def fetch(job):
    name, url, page, metres = job
    req = urllib.request.Request(url, headers={"User-Agent": "SamrukWorkshopAssetBuilder/1.0"})
    with urllib.request.urlopen(req, timeout=30) as response:
        data = response.read()
    if name.endswith(".jpg"):
        assert data[:2] == b"\xff\xd8", f"Not JPEG: {name}"
    assert len(data) > 1000, name
    (ROOT / name).write_bytes(data)
    print(f"{name}: {len(data):,} bytes", flush=True)
    return dict(file=name, source=url, page=page, metres_per_tile=metres, bytes=len(data), sha256=hashlib.sha256(data).hexdigest())

with ThreadPoolExecutor(max_workers=4) as pool:
    results = list(pool.map(fetch, JOBS))
(ROOT / "asset-manifest.json").write_text(json.dumps(results, indent=2) + "\n")
(ROOT / "CREDITS.md").write_text("""# Workshop assets

The concrete, plaster, green painted metal, and wood textures are original
Poly Haven downloads, licensed CC0: https://polyhaven.com/license .
Source pages, exact URLs, physical scale, and hashes are in asset-manifest.json.
The OpenGL normal maps are used with the PBR materials. Files are self-hosted;
learners do not contact the asset provider.

The prefiltered lighting environment is Babylon.js's official environmentSpecular.env,
from the BabylonJS/Assets repository (CC0 asset repository).

The lathe model is authored for this project with tools/build-lathe.py, inspired
by the proportions of Soviet-era engine lathes. It is an educational approximation,
not a manufacturer CAD model or an equipment operating guide.
""")
