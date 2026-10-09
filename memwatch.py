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
jumps still say where to look.

What it found (9 October, 10:06): 36 MB in use and 265 MB "held but free". The big jobs (Dhan's instrument list, the
candle downloads, the day's partial copy every two minutes) leave freed memory that the C allocator keeps instead of
giving it back, so the process grew about 10 MB a minute towards Render's 512 MB. The fix (the owner's yes, 10:10):
fewer allocator pools from the start (limit_pools) and the free memory given back once a minute (give_back)."""
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


M_ARENA_MAX = -8  # glibc's mallopt setting for the most memory pools (arenas) the allocator may make


def _libc():
    try:
        return ctypes.CDLL("libc.so.6")
    except OSError:
        return None


def limit_pools(most: int = 2) -> bool:
    """At most this many allocator pools: by default glibc makes up to eight per CPU for a process with many threads,
    and every pool keeps its own freed memory. Called once at start, before the server's threads; True when it took."""
    libc = _libc()
    try:
        return bool(libc and libc.mallopt(M_ARENA_MAX, most))
    except AttributeError:
        return False


_given = {"at": None, "freed_mb": None, "times": 0}


def give_back() -> None:
    """Hands the allocator's free memory back to the system (glibc's malloc_trim, every pool). The server calls it
    once a minute; it changes no data. The last result goes on /health."""
    libc = _libc()
    if libc is None:
        return
    before = rss_mb()
    try:
        libc.malloc_trim(0)
    except AttributeError:
        return
    with _lock:
        _given.update(at=datetime.now(IST).strftime("%H:%M:%S"), freed_mb=round(before - rss_mb(), 1), times=_given["times"] + 1)


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
        given = dict(_given)
    return {"threads": threading.active_count(), "python_blocks": sys.getallocatedblocks(), "malloc": malloc(),
            "pools_limited": _pools_limited, "given_back": given, "objects": objects(), "jumps": jumps}


_pools_limited = limit_pools()  # at import, before the server starts its threads
