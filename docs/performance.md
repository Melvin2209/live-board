# Performance

Goal: the board must stay smooth (≈60 FPS) with **500 elements**, all visible on
screen, while people pan, zoom, drag and receive other people's changes.

## How it is measured

`npm run bench` runs [`bench/board.bench.spec.ts`](../bench/board.bench.spec.ts)
against a production build (`next build && next start`) and the real sync server:

1. Seeds 500 elements (sticky notes, rectangles, ellipses, text; 25 × 20 grid)
   in one transaction, then zooms out to 23% so **all 500 are on screen**.
2. Records every `requestAnimationFrame` timestamp while a scenario runs
   ([`bench/frames.ts`](../bench/frames.ts)). The time between two frames is the
   frame time: 16.7 ms = 60 FPS, more than 50 ms is a visible hitch. A
   `PerformanceObserver` counts long tasks (main thread blocked > 50 ms).
3. Scenarios: idle, wheel **pan**, ctrl+wheel **zoom**, **drag** an element,
   **remote drag** (a second browser drags an element while we measure the
   first one), and **load** (a new visitor opens the board link).
4. Fails if any interactive scenario has a p95 frame time above 100 ms
   (scaled with the CPU throttling), so regressions are caught.

Options: `BENCH_ELEMENTS=1000 npm run bench`, `BENCH_CPU_THROTTLE=4 npm run bench`
(Chrome DevTools CPU throttling: simulates a machine 4× slower). Raw results are
written to `bench-results/`.

Environment for the numbers below: headless Chromium 141, 1280×800, 4 vCPU
(Intel Xeon @ 2.10GHz) cloud container, no GPU. Both browsers of the remote
scenario run on the same machine, so they compete for the CPU.

## Results: 500 elements

| Scenario | FPS | p50 frame | p95 frame | worst frame | long tasks |
| --- | --- | --- | --- | --- | --- |
| Pan | **60** | 16.7 ms | 16.7 ms | 16.8 ms | 0 |
| Zoom | **59.3** | 16.7 ms | 16.7 ms | 33.3 ms | 0 |
| Drag an element | **60** | 16.7 ms | 16.8 ms | 16.8 ms | 0 |
| Remote drag (other user) | **53.6** | 16.7 ms | 33.3 ms | 33.4 ms | 0 |

| One-off | Value |
| --- | --- |
| Seed 500 elements + first render | 130 ms |
| New visitor: navigation → 500 elements drawn | 646 ms |

With **1000 elements**: pan 57.6 FPS, zoom 53.4 FPS, drag 60 FPS, remote drag 56.3 FPS.

## Data size (`npm run bench:doc`)

| 500 elements | Value |
| --- | --- |
| Board snapshot stored by the server | 90 KB |
| Encode / load the snapshot | 9 ms / 22 ms |
| Network update for one move | 40 bytes |
| Network update for one keystroke | 19 bytes |

## What made the difference

At full speed, a 4-vCPU container already holds 60 FPS, which hides the costs.
So the optimizations were measured with **4× CPU throttling**, where they matter:

| Scenario (4× slower CPU) | Before | After |
| --- | --- | --- |
| Drag an element | 22.4 FPS, p95 117 ms | **52.3 FPS, p95 33 ms** |
| Remote drag | 10 FPS, p95 167 ms | **40 FPS, p95 50 ms** |
| Pan | 27.2 FPS, p95 133 ms | 33.6 FPS, p95 83 ms |
| Zoom | 29.8 FPS, p95 100 ms | 28.1 FPS, p95 117 ms |

A CPU profile showed that most of the time is spent by the browser drawing the
canvas (Konva redraws every shape of a layer when one changes), not in React or
Yjs. Hence:

1. **Fine-grained store + `React.memo`** ([`store.ts`](../src/board/store.ts)):
   a Yjs change rebuilds only the touched elements. Other elements keep the
   same object, so React skips them and Konva does not touch their nodes.
2. **Drag positions written once per animation frame**: pointer events fire
   faster than the screen refreshes; extra Yjs updates would be wasted renders
   and network messages.
3. **Active layer for the dragged element**: on drag start the node moves to a
   small layer on top; each frame redraws 1 shape instead of 500.
4. **"Hot" elements for remote edits** ([`hot.ts`](../src/board/hot.ts)): an
   element that someone else is changing moves to the same active layer until
   it has been idle for 800 ms.
5. **Level of detail**: below 40% zoom, text (the most expensive thing to draw,
   and unreadable at that size anyway) is not drawn.
6. **No hit-testing for text nodes** (`listening={false}`): Konva skips them
   when drawing its hit canvas.
7. **Throttled cursors** (~30 Hz) on their own non-listening layer.

## Known limits and next steps

- Pan and zoom still redraw every visible shape. On a slow CPU with everything
  on screen this gives about 30 FPS. Next steps: viewport culling (don't
  render off-screen elements, a big win when zoomed in), caching the main layer
  as a bitmap during a gesture, or a WebGL renderer.
- Headless Chromium has no GPU here; a real browser with GPU canvas
  acceleration usually does better. Numbers vary with the machine: run the
  benchmark on yours.
