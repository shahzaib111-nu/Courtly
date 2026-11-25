#!/usr/bin/env python3
"""
Peak-load check for NFR 1.1.1: 250 users using the booking calendar at the same time,
every response under 4 seconds. Uses only the Python standard library.

    python3 scripts/load-test.py                         # 250 users against http://localhost:8081
    python3 scripts/load-test.py --users 500 --url http://localhost:8081

Each simulated user opens the calendar like a real player: lists courts and facilities,
then checks free slots for several dates and sports (date change / sport filter, NFR 1.1.2).
Exits with code 1 if any request fails or takes longer than the limit.
"""
import argparse
import datetime as dt
import statistics
import threading
import time
import urllib.request

SPORTS = ["TENNIS", "CRICKET", "FOOTBALL", "BASKETBALL", "FUTSAL", "BADMINTON", "SQUASH", "VOLLEYBALL"]


def user_session(base, user_no, results, lock, start_gate):
    paths = ["/api/courts", "/api/facilities"]
    for i in range(4):
        day = dt.date.today() + dt.timedelta(days=1 + (user_no + i) % 14)
        paths.append(f"/api/bookings/availability?date={day}&type={SPORTS[(user_no + i) % len(SPORTS)]}")
    start_gate.wait()                       # every user starts at the same moment
    for path in paths:
        t0 = time.perf_counter()
        ok = True
        try:
            with urllib.request.urlopen(base + path, timeout=30) as r:
                r.read()
                ok = r.status == 200
        except Exception:
            ok = False
        ms = (time.perf_counter() - t0) * 1000
        with lock:
            results.append((path.split("?")[0], ms, ok))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", default="http://localhost:8081")
    ap.add_argument("--users", type=int, default=250)
    ap.add_argument("--limit-ms", type=int, default=4000, help="NFR 1.1.1: 4 seconds")
    args = ap.parse_args()

    results, lock = [], threading.Lock()
    gate = threading.Barrier(args.users)
    threads = [threading.Thread(target=user_session, args=(args.url, n, results, lock, gate)) for n in range(args.users)]
    t0 = time.perf_counter()
    for t in threads: t.start()
    for t in threads: t.join()
    wall = time.perf_counter() - t0

    times = sorted(ms for _, ms, _ in results)
    errors = sum(1 for _, _, ok in results if not ok)
    p = lambda q: times[min(len(times) - 1, int(q * len(times)))]
    print(f"{args.users} concurrent users, {len(results)} requests in {wall:.1f} s")
    print(f"  median {statistics.median(times):.0f} ms | p95 {p(0.95):.0f} ms | p99 {p(0.99):.0f} ms | max {times[-1]:.0f} ms")
    for name in sorted({n for n, _, _ in results}):
        ts = sorted(ms for n, ms, _ in results if n == name)
        print(f"  {name:<32} p95 {ts[min(len(ts) - 1, int(0.95 * len(ts)))]:6.0f} ms  max {ts[-1]:6.0f} ms")
    print(f"  errors: {errors}")
    passed = errors == 0 and times[-1] <= args.limit_ms
    print(("PASS" if passed else "FAIL") + f": every response under {args.limit_ms} ms (NFR 1.1.1)")
    raise SystemExit(0 if passed else 1)


if __name__ == "__main__":
    main()
