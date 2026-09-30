#!/usr/bin/env python3
"""Run a memory/CPU-heavy command (test suite, control audit) under a machine-wide limit.

Many agents and scripts share this machine. Each `tsx --test` run fans out one Node
process per core and each audit spawns worker processes, so unbounded concurrent runs
once reached ~27 GB of Node RSS and a load average near 260 (OOM killer fired).

This wrapper (a) allows at most SLOTS heavy commands at once across all checkouts,
queueing the rest, (b) waits until MemAvailable leaves headroom before starting,
(c) caps each Node heap, and (d) kills the whole process group on timeout.
Nested use is a no-op (HEAVY_LOCK_HELD). Slot files live outside any checkout.
"""
import argparse
import fcntl
import os
from pathlib import Path
import signal
import subprocess
import time

SLOTS = 2
MIN_AVAILABLE_GB = 10
HEAP_MB = 3072
LOCK_DIR = Path('/home/colin/dev/procedural/.work/heavy-locks')


def mem_available_gb():
    for line in Path('/proc/meminfo').read_text().splitlines():
        if line.startswith('MemAvailable:'):
            return int(line.split()[1]) / 1048576
    return float('inf')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--timeout', type=float, default=3600, help='seconds for the command itself')
    parser.add_argument('--wait', type=float, default=7200, help='seconds to queue for a slot and memory')
    parser.add_argument('command', nargs=argparse.REMAINDER)
    args = parser.parse_args()
    command = args.command[1:] if args.command[:1] == ['--'] else args.command
    if not command:
        parser.error('provide a command')
    env = dict(os.environ)
    if env.get('HEAVY_LOCK_HELD'):
        os.execvpe(command[0], command, env)
    LOCK_DIR.mkdir(parents=True, exist_ok=True)
    deadline = time.monotonic() + args.wait
    lease = None
    while lease is None:
        for slot in range(SLOTS):
            handle = (LOCK_DIR / f'slot{slot}.lock').open('a')
            try:
                fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
                lease = handle
                break
            except BlockingIOError:
                handle.close()
        if lease is None:
            if time.monotonic() > deadline:
                raise SystemExit('Heavy-command queue timed out; machine is saturated.')
            time.sleep(5)
    while mem_available_gb() < MIN_AVAILABLE_GB:
        if time.monotonic() > deadline:
            raise SystemExit(f'Less than {MIN_AVAILABLE_GB} GB available; refusing to start.')
        time.sleep(5)
    env['HEAVY_LOCK_HELD'] = '1'
    opts = env.get('NODE_OPTIONS', '')
    if '--max-old-space-size' not in opts:
        env['NODE_OPTIONS'] = f'{opts} --max-old-space-size={HEAP_MB}'.strip()
    process = subprocess.Popen(command, env=env, start_new_session=True, pass_fds=(lease.fileno(),))
    try:
        raise SystemExit(process.wait(timeout=args.timeout))
    except (subprocess.TimeoutExpired, KeyboardInterrupt):
        for sig in (signal.SIGTERM, signal.SIGKILL):
            try:
                os.killpg(process.pid, sig)
            except ProcessLookupError:
                break
            try:
                process.wait(timeout=5)
                break
            except subprocess.TimeoutExpired:
                continue
        raise SystemExit('Heavy command stopped (timeout or interrupt).')


if __name__ == '__main__':
    main()
