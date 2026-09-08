#!/usr/bin/env python3
"""Run a native validation command under the shared machine-wide render lease.

All checkouts on this machine must use this wrapper for native renders. Historical
runners may also take checkout-local locks; those are subordinate to this lease.
"""
import argparse
import fcntl
import os
from pathlib import Path
import signal
import subprocess

# Deliberately independent of this script's checkout. Never replace with cwd/.work.
LOCK = Path('/home/colin/dev/procedural/.work/native-render-machine.lock')

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--timeout', type=float, default=240)
    parser.add_argument('command', nargs=argparse.REMAINDER)
    args = parser.parse_args()
    command = args.command[1:] if args.command[:1] == ['--'] else args.command
    if not command or not 0 < args.timeout <= 3600:
        parser.error('provide a command and timeout in (0,3600] seconds')
    LOCK.parent.mkdir(parents=True, exist_ok=True)
    with LOCK.open('a') as lease:
        try:
            fcntl.flock(lease, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise SystemExit('Native renderer busy: shared machine lease held; retry later.')
        process = subprocess.Popen(command, start_new_session=True)
        try:
            raise SystemExit(process.wait(timeout=args.timeout))
        except (subprocess.TimeoutExpired, KeyboardInterrupt):
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
            raise SystemExit('Native command stopped; preserve its incomplete attempt.')

if __name__ == '__main__':
    main()
