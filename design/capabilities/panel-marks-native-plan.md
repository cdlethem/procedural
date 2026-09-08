# PanelMarks native acceptance plan

Candidate CP17 workflow, not source recreation. Use the actual PDE, freshly compiled core
JAR, Processing4.5.6 JAVA2D density1, 640x640, and the established machine render lease.

Six states with keys apcm0s:
1. Baseline:80 attempts, LONGEST, original palette and nested outlines.
2. A:240 attempts; fresh layout, changed exact bounds and visible pixels.
3. P:RANDOM axis; fresh layout, changed exact bounds and visible pixels.
4. C:alternate palette; same layout object and exact bounds, changed pixels.
5. M:inset flat panels/center lines; same layout object/bounds, changed pixels.
6. 0:reset baseline inputs; rebuilt layout, exact baseline geometry and framebuffer.
S saves the cached displayed frame and must not draw again during300ms quiet interval;
read actual PNG and compare every saved pixel. Check actual core JAR code source, renderer,
dimensions, opaque nonblank framebuffer, cached/framebuffer equality and exact key order.

Root views all distinct states and verifies report source/runtime/class/image bindings.
This validates a technique-level artist workflow, not source pixel replay or ports.
Package extraction and consumer validation remain separate acceptance gates.
