"""Where the server's memory goes (the owner's yes of 9 October, 9:45 AM). On 9 October the server grew from 135 MB at
09:18 to 459 MB at 09:31, with a peak of 494 MB, and Render's free plan stops it at 512 MB; on 8 October it stopped at
about 09:50 with a page open. This module only measures; it changes nothing the server does. /health carries what it
finds, so the morning check (the wake workflow's log) shows it:
  threads        how many threads the process runs (each thread can hold its own memory pool)
  python_blocks  memory blocks Python itself holds now
  malloc         the C allocator's view, summed over all its pools: in use, and held but free (a large "free" part means
                 the memory is fragmented, not used)
  objects        the most numerous kinds of Python object, once a minute at most
  jumps          the biggest growth of the whole process seen while one piece of work ran: a page's request, a request
                 to Dhan, the call tracker for one index, the day's save, the read of Dhan's instrument list
Growth is measured on the whole process, so work running at the same moment in other threads counts too; the biggest
jumps still say where to look."""
import contextlib
import ctypes
import gc
import sys
import threading
import time
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

IST = timezone(timedelta(hours=5, minutes=30))
MB = 1024 * 1024


def rss_mb() -> float:
    """The process's memory now (resident), in MB; 0 where /proc is not there."""
    try:
        for line in Path("/proc/self/status").read_text().splitlines():
            if line.startswith("VmRSS:"):
                return int(line.split()[1]) / 1024
    except (OSError, ValueError, IndexError):
        pass
    return 0.0


_jumps: dict = {}  # what -> {"mb": the biggest growth, "at": when, "after_mb": the process then, "times": how often it ran}
_lock = threading.Lock()


def note(what: str, before: float, after: float) -> None:
    grow = after - before
    with _lock:
        rec = _jumps.setdefault(what, {"mb": 0.0, "at": None, "after_mb": None, "times": 0})
        rec["times"] += 1
        if grow > rec["mb"]:
            rec.update(mb=round(grow, 1), at=datetime.now(IST).strftime("%H:%M:%S"), after_mb=round(after))


@contextlib.contextmanager
def watch(what: str):
    """Measures the process's growth while the block runs."""
    before = rss_mb()
    try:
        yield
    finally:
        note(what, before, rss_mb())


class _MallInfo2(ctypes.Structure):
    _fields_ = [(name, ctypes.c_size_t) for name in ("arena", "ordblks", "smblks", "hblks", "hblkhd", "usmblks", "fsmblks", "uordblks", "fordblks", "keepcost")]


def malloc() -> dict | None:
    """The C allocator's totals over all its pools (glibc's mallinfo2), in MB; None where it is not available."""
    try:
        libc = ctypes.CDLL("libc.so.6")
        libc.mallinfo2.restype = _MallInfo2
        m = libc.mallinfo2()
    except (OSError, AttributeError):
        return None
    return {"in_use": round(m.uordblks / MB), "held_free": round(m.fordblks / MB), "mapped": round(m.hblkhd / MB)}


_census = {"at": 0.0, "value": None}


def objects() -> list:
    """The ten most numerous kinds of Python object, counted at most once a minute (a count walks every object)."""
    if time.monotonic() - _census["at"] >= 60 or _census["value"] is None:
        counts = Counter(type(o).__name__ for o in gc.get_objects())
        _census.update(at=time.monotonic(), value=[f"{name} {n}" for name, n in counts.most_common(10)])
    return _census["value"]


def summary() -> dict:
    with _lock:
        jumps = sorted(({"what": k, **v} for k, v in _jumps.items() if v["mb"] > 0), key=lambda r: -r["mb"])[:8]
    return {"threads": threading.active_count(), "python_blocks": sys.getallocatedblocks(), "malloc": malloc(),
            "objects": objects(), "jumps": jumps}
