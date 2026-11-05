"""Create refreshable static role entry pages without duplicating application assets."""
from pathlib import Path
import re
import sys


def entry_html(source: str, relative_base: str) -> str:
    source = re.sub(r"<base\b[^>]*>\s*", "", source, flags=re.IGNORECASE)
    return re.sub(r"(<head\b[^>]*>)", rf'\1\n    <base href="{relative_base}" />', source, count=1, flags=re.IGNORECASE)


def build_routes(directory: Path) -> None:
    index = directory / "index.html"
    if not index.is_file():
        raise SystemExit(f"Build the application first: {index} is missing")
    source = index.read_text(encoding="utf-8")
    if not re.search(r"<head\b", source, flags=re.IGNORECASE):
        raise SystemExit("The built index has no head element")
    index.write_text(entry_html(source, "./"), encoding="utf-8")
    routes = ("owner", "customer", "customer/booking", "customer/prices", "customer/care")
    for route in routes:
        target = directory / route / "index.html"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(entry_html(source, "../" * len(Path(route).parts)), encoding="utf-8")
    print(f"Prepared {len(routes)} role entry pages in {directory.name}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python scripts/build_routes.py DIST_DIRECTORY")
    build_routes(Path(sys.argv[1]))
