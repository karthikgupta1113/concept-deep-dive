/**
 * canvas.js — Fractal BST tree drawn on the auth background canvas
 *
 * Draws a procedural binary tree with subtle breathing animation.
 * Respects prefers-reduced-motion.
 * Exposes _startTreeCanvas() and _treeCanvasCleanup() for app.js.
 */

(function initTreeCanvas() {
  const canvas = document.getElementById('tree-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W, H, animId, nodes;

  /* ── Resize ───────────────────────────────────────────── */
  function resize() {
    const parent = canvas.parentElement;
    const rect   = parent.getBoundingClientRect();
    W = canvas.width  = rect.width  || window.innerWidth;
    H = canvas.height = rect.height || window.innerHeight;
    nodes = [];
    if (!animId) drawTree(0);  // static redraw if paused
  }

  /* ── Branch drawing ───────────────────────────────────── */
  function drawBranch(x, y, angle, len, depth, t) {
    if (depth === 0 || len < 2) return;

    const wobble = reducedMotion ? 0 : Math.sin(t * 0.35 + depth * 0.9) * 0.016;
    const a = angle + wobble;
    const ex = x + Math.cos(a) * len;
    const ey = y + Math.sin(a) * len;

    const progress = depth / 10;
    const alpha = 0.05 + progress * 0.2;
    const width = 0.3 + progress * 1.6;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(ex, ey);
    ctx.strokeStyle = `rgba(95,171,122,${alpha.toFixed(3)})`;
    ctx.lineWidth   = width;
    ctx.lineCap     = 'round';
    ctx.stroke();

    if (depth <= 6 && depth >= 3) {
      nodes.push({ x: ex, y: ey, depth, phase: depth * 1.4 + x * 0.008 });
    }

    const spread = Math.PI / 6.5;
    const driftL = reducedMotion ? 0 : Math.sin(t * 0.22 + depth) * 0.018;
    const driftR = reducedMotion ? 0 : Math.cos(t * 0.18 + depth) * 0.018;

    drawBranch(ex, ey, a - spread + driftL, len * 0.67, depth - 1, t);
    drawBranch(ex, ey, a + spread + driftR, len * 0.67, depth - 1, t);
  }

  function drawNodes(t) {
    nodes.forEach(n => {
      const pulse = reducedMotion ? 0.8 : 0.6 + Math.sin(t * 0.45 + n.phase) * 0.4;
      const r   = (1.5 + (10 - n.depth) * 0.5) * pulse;
      const a   = (0.15 + (10 - n.depth) * 0.04) * pulse;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(95,171,122,${Math.min(a, 0.6).toFixed(3)})`;
      ctx.fill();
    });
  }

  function drawTree(t = 0) {
    ctx.clearRect(0, 0, W, H);
    nodes = [];

    const sx = W * 0.5;
    const sy = H * 1.06;
    const trunkLen = H * 0.21;

    // Trunk stub
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx, sy - trunkLen * 0.45);
    ctx.strokeStyle = 'rgba(95,171,122,0.1)';
    ctx.lineWidth = 2;
    ctx.stroke();

    drawBranch(sx, sy - trunkLen * 0.45, -Math.PI / 2, trunkLen, 9, t);
    drawNodes(t);
  }

  /* ── Animation loop ───────────────────────────────────── */
  function animate(ts) {
    drawTree(ts / 1000);
    animId = requestAnimationFrame(animate);
  }

  /* ── Start / Stop ─────────────────────────────────────── */
  function start() {
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    window.removeEventListener('resize', resize);  // prevent duplicate
    window.addEventListener('resize', resize);
    resize();
    if (!reducedMotion) {
      animId = requestAnimationFrame(animate);
    }
  }

  function stop() {
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    window.removeEventListener('resize', resize);
  }

  start();

  window._startTreeCanvas   = start;
  window._treeCanvasCleanup = stop;
})();
