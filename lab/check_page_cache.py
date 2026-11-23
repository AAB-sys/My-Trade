"""Fast jumps between pages (23 November): the pages name their files with the code's version, a file asked with that exact version is kept by the browser
for good, an unversioned file is still asked every time, the page itself answers 304 when unchanged, and a changed file means a new version.
python3 lab/check_page_cache.py   (needs fastapi and httpx; no login, no Dhan)"""
import os, sys, re, tempfile, shutil, importlib
os.environ.setdefault("DATA_PROVIDER", "demo"); os.environ.pop("DASHBOARD_PASSWORD", None)
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, ".."))
from fastapi.testclient import TestClient
import main
ok = bad = 0
def check(name, cond):
    global ok, bad
    if cond: ok += 1
    else: bad += 1; print("FAILED:", name)
c = TestClient(main.app)
V = main.ASSET_VERSION
check("version is 10 hex characters", bool(re.fullmatch(r"[0-9a-f]{10}", V)))
for url, name in (("/", "index.html"), ("/index/NIFTY%2050", "detail.html"), ("/volume-profile", "volume.html"), ("/login", "login.html")):
    r = c.get(url); body = r.text
    refs = re.findall(r"""(?:src|href)=["'](/static/[^"']+)["']""", body)
    check(f"{url}: 200", r.status_code == 200)
    check(f"{url}: every /static file carries the version ({len(refs)} files)", all(x.endswith("?v=" + V) for x in refs))
    check(f"{url}: the page itself is no-cache with an ETag", r.headers.get("cache-control") == "no-cache" and bool(r.headers.get("etag")))
    check(f"{url}: nothing else in the page changed (only ?v= added)", re.sub(r"\?v=" + V, "", body) == open(os.path.join(main.STATIC, name), encoding="utf-8").read())
    r2 = c.get(url, headers={"if-none-match": r.headers["etag"]}); check(f"{url}: the same ETag gets 304 with no body", r2.status_code == 304 and not r2.content)
    r3 = c.get(url, headers={"if-none-match": '"something-else"'}); check(f"{url}: another ETag gets the page", r3.status_code == 200 and r3.text == body)
    for ref in refs[:3]:
        a = c.get(ref); check(f"{ref}: kept for good", a.status_code == 200 and a.headers.get("cache-control") == "public, max-age=31536000, immutable")
        b = c.get(ref.split("?")[0]); check(f"{ref.split('?')[0]}: unversioned is still asked every time", b.status_code == 200 and b.headers.get("cache-control") == "no-cache")
        d = c.get(ref.split("?")[0] + "?v=0000000000"); check(f"{ref.split('?')[0]}: another version is NOT kept for good", d.headers.get("cache-control") == "no-cache")
# a changed file changes the version (a deploy): the same hash the server makes at start
tmp = tempfile.mkdtemp(); shutil.copytree(main.STATIC, tmp + "/static"); old = main.STATIC; main.STATIC = __import__("pathlib").Path(tmp + "/static")
try:
    v1 = main._asset_version(); open(tmp + "/static/fvg.js", "a").write("\n// a change\n"); v2 = main._asset_version()
    check("a changed script gives a new version", v1 != v2 and v1 == V)
finally:
    main.STATIC = old; shutil.rmtree(tmp)
# the page cache follows the file: an edit shows at once, without a restart
p = os.path.join(main.STATIC, "login.html"); text = open(p, encoding="utf-8").read(); r0 = c.get("/login")
try:
    open(p, "w", encoding="utf-8").write(text + "\n<!-- edit -->\n"); r1 = c.get("/login"); check("an edited page is served at once with a new ETag", "<!-- edit -->" in r1.text and r1.headers["etag"] != r0.headers["etag"])
finally:
    open(p, "w", encoding="utf-8").write(text)
print(f"{ok} checks passed, {bad} failed"); sys.exit(1 if bad else 0)
