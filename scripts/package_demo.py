"""Package only the generated static demo; never include the server or its data."""
from hashlib import sha256
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

root = Path(__file__).resolve().parent.parent
source = root / "demo-dist"
if not (source / "index.html").is_file():
    raise SystemExit("Run npm run build:demo first.")
output = root / "artifacts"
output.mkdir(exist_ok=True)
archive = output / "mongle-demo.zip"
files = sorted(path for path in source.rglob("*") if path.is_file())
for path in files:
    if path.is_symlink() or not path.resolve().is_relative_to(source.resolve()):
        raise SystemExit(f"Unexpected linked file in demo build: {path.name}")
    if path.suffix in {".sqlite", ".db", ".py"} or path.name.startswith(".env"):
        raise SystemExit(f"Unexpected non-static file: {path.name}")
with ZipFile(archive, "w", ZIP_DEFLATED, compresslevel=9) as bundle:
    for path in files:
        bundle.write(path, path.relative_to(source).as_posix())
digest = sha256(archive.read_bytes()).hexdigest()
(output / "mongle-demo.zip.sha256").write_text(f"{digest}  {archive.name}\n")
print(f"Packaged {len(files)} static files: {archive}")
print(f"Size: {archive.stat().st_size:,} bytes; SHA-256: {digest}")
