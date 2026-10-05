"""Checks the Dhan connection from .env and says, in plain words, what works and what to fix.

    python check_dhan.py        (or double-click check_dhan.bat on Windows)
"""
import os
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent


def load_dotenv(path: Path = BASE / ".env") -> None:  # the same reader as main.py
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


def main() -> int:
    load_dotenv()
    import dhan  # after .env is loaded, so DHAN_API_BASE and the settings are read

    print("Checking the Dhan connection with the settings in .env …\n")
    result = dhan.status()
    for step in result["steps"]:
        print(("OK   " if step["ok"] else "FIX  ") + step["text"])
    if result["ok"]:
        for step in dhan.deep_checks():
            print(("OK   " if step["ok"] else "FIX  ") + step["text"])
            result["ok"] = result["ok"] and step["ok"]
    print()
    print("Everything works. The dashboard can use Dhan." if result["ok"]
          else "Fix the FIX line above, then run this again.")
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
