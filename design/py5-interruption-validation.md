# Python interruption ownership supplement

The 15-group lifecycle suite passed before Sol's final Python-specific coverage
request arrived. Do not repeat it. Register one focused actual-Py5Graphics fault
probe: inject a KeyboardInterrupt during drawing, require the exact exception object
to propagate, and verify aborted state plus cleared Java/Python backing. One initial
execution, with a corrective execution only after a recorded failure and repair.
This tests Python interruption cleanup, not spontaneous JVM/device failure; no saved
image or new visual acceptance is involved.
