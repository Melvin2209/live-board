import type { Page } from "@playwright/test";

export interface FrameStats {
  fps: number;
  p50: number;
  p95: number;
  worst: number;
  longTasks: number;
  frames: number;
}

interface BenchWindow {
  __bench?: { frames: number[]; longTasks: number; recording: boolean; observer: PerformanceObserver };
}

/**
 * Records every animation frame while `action` runs.
 * The interval between two frames is how long the browser needed to produce
 * a frame: ~16.7 ms means 60 FPS, anything above 50 ms is a visible hitch.
 */
export async function recordFrames(page: Page, action: () => Promise<unknown>): Promise<FrameStats> {
  await page.evaluate(() => {
    const w = window as BenchWindow;
    const observer = new PerformanceObserver((list) => (w.__bench!.longTasks += list.getEntries().length));
    w.__bench = { frames: [], longTasks: 0, recording: true, observer };
    observer.observe({ type: "longtask" });
    const loop = (t: number) => {
      if (!w.__bench?.recording) return;
      w.__bench.frames.push(t);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });

  await action();

  return page.evaluate(() => {
    const bench = (window as BenchWindow).__bench!;
    bench.recording = false;
    bench.observer.disconnect();
    // Headless Chromium sometimes runs two callbacks for the same frame
    // (identical timestamps): count each frame once.
    const frames = bench.frames.filter((t, i, all) => i === 0 || t !== all[i - 1]);
    const intervals = frames.slice(1).map((t, i) => t - frames[i]).sort((a, b) => a - b);
    const pick = (q: number) => intervals[Math.min(intervals.length - 1, Math.floor(q * intervals.length))];
    const round = (n: number) => Math.round(n * 10) / 10;
    return {
      fps: round(((frames.length - 1) / (frames[frames.length - 1] - frames[0])) * 1000),
      p50: round(pick(0.5)),
      p95: round(pick(0.95)),
      worst: round(intervals[intervals.length - 1]),
      longTasks: bench.longTasks,
      frames: frames.length,
    };
  });
}
