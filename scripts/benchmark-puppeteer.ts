/**
 * Puppeteer screenshot benchmark — the existential risk gate.
 *
 * Measures frame capture latency at the target viewport size (414x896).
 * Run this BEFORE writing product code. If p95 > 200ms, the server-side
 * rendering approach needs rethinking.
 *
 * Usage:
 *   npx tsx scripts/benchmark-puppeteer.ts
 *
 * Prerequisites:
 *   - Next.js dev server running on port 3000 (`npm run dev`)
 *   - OR run inside Docker where Chromium is installed
 */

import puppeteer from 'puppeteer';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const VIEWPORT_WIDTH = 414;
const VIEWPORT_HEIGHT = 896;
const DEVICE_SCALE_FACTOR = 2;
const TOTAL_FRAMES = 200;
const RENDER_URL = 'http://localhost:3000/render';

interface BenchmarkResult {
  frameIndex: number;
  latencyMs: number;
  rssMemoryMb: number;
}

async function runBenchmark(): Promise<void> {
  console.log('=== Puppeteer Screenshot Benchmark ===');
  console.log(`Viewport: ${VIEWPORT_WIDTH}x${VIEWPORT_HEIGHT} @${DEVICE_SCALE_FACTOR}x`);
  console.log(`Total frames: ${TOTAL_FRAMES}`);
  console.log();

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  });

  const page = await browser.newPage();
  await page.setViewport({
    width: VIEWPORT_WIDTH,
    height: VIEWPORT_HEIGHT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
  });

  // Navigate to the render page
  try {
    await page.goto(RENDER_URL, { waitUntil: 'networkidle0', timeout: 15000 });
  } catch {
    console.error(`Failed to load ${RENDER_URL}`);
    console.error('Make sure the Next.js dev server is running: npm run dev');
    await browser.close();
    process.exit(1);
  }

  // Warm-up: take 5 screenshots to prime the pipeline
  console.log('Warming up (5 screenshots)...');
  for (let i = 0; i < 5; i++) {
    await page.screenshot({ type: 'png' });
  }

  // Benchmark
  const results: BenchmarkResult[] = [];
  const tmpDir = join('/tmp', 'textstory-benchmark');
  mkdirSync(tmpDir, { recursive: true });

  console.log(`Capturing ${TOTAL_FRAMES} frames...`);
  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const memBefore = process.memoryUsage().rss;
    const start = performance.now();

    await page.screenshot({
      path: join(tmpDir, `frame_${String(i).padStart(4, '0')}.png`),
      clip: { x: 0, y: 0, width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
      type: 'png',
    });

    const latencyMs = performance.now() - start;
    const rssMemoryMb = memBefore / 1024 / 1024;

    results.push({ frameIndex: i, latencyMs, rssMemoryMb });

    // Log progress every 50 frames
    if ((i + 1) % 50 === 0) {
      console.log(`  Frame ${i + 1}/${TOTAL_FRAMES} — ${latencyMs.toFixed(1)}ms`);
    }
  }

  await browser.close();

  // Calculate statistics
  const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b);
  const sum = latencies.reduce((a, b) => a + b, 0);
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];
  const min = latencies[0];
  const max = latencies[latencies.length - 1];
  const avg = sum / latencies.length;

  // Memory trend
  const memStart = results[0].rssMemoryMb;
  const memEnd = results[results.length - 1].rssMemoryMb;

  // Estimated render times for real videos
  const framesFor30sVideo = 720; // 30s × 24fps
  const estRenderTime30s = (avg * framesFor30sVideo) / 1000;

  console.log();
  console.log('=== RESULTS ===');
  console.log(`Min:  ${min.toFixed(1)}ms`);
  console.log(`Avg:  ${avg.toFixed(1)}ms`);
  console.log(`P50:  ${p50.toFixed(1)}ms`);
  console.log(`P95:  ${p95.toFixed(1)}ms`);
  console.log(`P99:  ${p99.toFixed(1)}ms`);
  console.log(`Max:  ${max.toFixed(1)}ms`);
  console.log();
  console.log(`Memory: ${memStart.toFixed(0)}MB → ${memEnd.toFixed(0)}MB`);
  console.log();
  console.log(`Est. render time for 30s video (720 frames): ${estRenderTime30s.toFixed(1)}s`);
  console.log();

  // Decision gate
  if (p95 < 100) {
    console.log('✅ PASS — p95 < 100ms. Full speed ahead.');
  } else if (p95 < 200) {
    console.log('⚠️  WARNING — p95 100-200ms. Proceed with longer export time warnings.');
  } else {
    console.log('❌ FAIL — p95 > 200ms. Rethink the approach (lower resolution, Canvas, etc.)');
  }

  // Save results to JSON
  const reportPath = join(
    process.cwd(),
    'docs',
    'benchmark-results.json',
  );
  writeFileSync(
    reportPath,
    JSON.stringify({ latencies: { min, avg, p50, p95, p99, max }, memory: { startMb: memStart, endMb: memEnd }, estRenderTime30s, totalFrames: TOTAL_FRAMES, timestamp: new Date().toISOString() }, null, 2),
  );
  console.log(`\nResults saved to ${reportPath}`);
}

runBenchmark().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
