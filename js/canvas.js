/**
 * canvas.js — Fractal BST tree drawn on the auth background canvas
 *
 * Draws a procedural binary tree with subtle breathing animation.
 * Mouse tracking is scoped to the auth view so it doesn't reset
 * when the cursor moves over the login panel.
 * Respects prefers-reduced-motion.
 * Exposes _startTreeCanvas() and _treeCanvasCleanup() for app.js.
 */

(function initTreeCanvas() {
  const canvas = document.getElementById('tree-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Track against the full auth view, not just the canvas half,
  // so moving onto the login panel doesn't trigger a reset.
  const authView = document.getElementById('view-auth') || document.body;

  let W, H, animId, nodes;
  let targetMouseX = 0, targetMouseY = 0;
  let smoothMouseX = 0, smoothMouseY = 0;

  /* ── Cursor interaction (scoped to auth view) ─────────── */
  function onMouseMove(e) {
    if (reducedMotion) return;
    // Normalise against the full viewport so left-panel tree
    // and right-panel form share the same coordinate space.
    const cx = window.innerWidth  * 0.5;
    const cy = window.innerHeight * 0.5;
    targetMouseX = Math.max(-1, Math.min(1, (e.clientX - cx) / cx));
    targetMouseY = Math.max(-1, Math.min(1, (e.clientY - cy) / cy));
  }

  // Only reset when the cursor truly leaves the entire auth view
  function onMouseLeave(e) {
    if (e.target !== authView) return;  // ignore bubbling from children
    targetMouseX = 0;
    targetMouseY = 0;
  }

  /* ── Resize ───────────────────────────────────────────── */
  function resize() {
    const parent = canvas.parentElement;
    const rect = parent.getBoundingClientRect();
    W = canvas.width  = rect.width  || window.innerWidth;
    H = canvas.height = rect.height || window.innerHeight;
    nodes = [];
    if (!animId) drawTree(0);  // static redraw if paused
  }

  /* ── Branch drawing ───────────────────────────────────── */
  function drawBranch(x, y, angle, len, depth, t, branchIdx = 0) {
    if (depth === 0 || len < 2.5) return;

    // Organic breathing wobble + cursor-reactive sway
    const wobble = reducedMotion ? 0 : Math.sin(t * 0.35 + depth * 0.9) * 0.016;
    const sway   = reducedMotion ? 0 : (smoothMouseX * 0.04) * (1 - depth / 9);
    const a  = angle + wobble + sway;
    const ex = x + Math.cos(a) * len;
    const ey = y + Math.sin(a) * len;

    const progress = depth / 9;
    const alpha = 0.20 + progress * 0.28;
    const width = 0.65 + progress * 1.55;

    ctx.save();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(ex, ey);
    ctx.strokeStyle = `rgba(110, 185, 138, ${alpha.toFixed(3)})`;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();

    // Place nodes at major forks, mid forks, and tips
    if (depth <= 6 && depth >= 2) {
      const isMajor = (depth >= 5);
      const isTip   = (depth === 2);
      const isMid   = (depth === 4 || depth === 3);

      if (isMajor || isTip || isMid) {
        const minDist = 22;
        const tooClose = nodes.some(n => Math.hypot(n.x - ex, n.y - ey) < minDist);
        if (!tooClose) {
          nodes.push({
            x: ex, y: ey, depth, isMajor,
            phase: depth * 1.4 + x * 0.008 + branchIdx * 0.6
          });
        }
      }
    }

    const spread = Math.PI / 6.6;
    const driftL = reducedMotion ? 0 : Math.sin(t * 0.22 + depth) * 0.018;
    const driftR = reducedMotion ? 0 : Math.cos(t * 0.18 + depth) * 0.018;

    drawBranch(ex, ey, a - spread + driftL, len * 0.67, depth - 1, t, branchIdx * 2);
    drawBranch(ex, ey, a + spread + driftR, len * 0.67, depth - 1, t, branchIdx * 2 + 1);
  }

  function drawNodes(t) {
    nodes.forEach(n => {
      const pulse  = reducedMotion ? 1.0 : 0.82 + Math.sin(t * 1.6 + n.phase) * 0.22;
      const baseR  = n.isMajor ? 2.6 : 1.9;
      const r      = baseR * pulse;

      // Outer halo
      ctx.save();
      ctx.shadowBlur  = (n.isMajor ? 12 : 8) * pulse;
      ctx.shadowColor = 'rgba(130, 201, 154, 0.7)';
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(95, 171, 122, ${(0.45 * pulse).toFixed(3)})`;
      ctx.fill();
      ctx.restore();

      // Inner luminous halo
      ctx.save();
      ctx.shadowBlur  = (n.isMajor ? 5 : 3) * pulse;
      ctx.shadowColor = 'rgba(180, 235, 195, 0.85)';
      ctx.beginPath();
      ctx.arc(n.x, n.y, r * 0.75, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(160, 225, 180, ${(0.72 * pulse).toFixed(3)})`;
      ctx.fill();
      ctx.restore();

      // Bright pinpoint core
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(n.x, n.y, Math.max(0.85, r * 0.42), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${(0.96 * pulse).toFixed(3)})`;
      ctx.fill();
      ctx.restore();
    });
  }

  function drawTree(t = 0) {
    ctx.clearRect(0, 0, W, H);
    nodes = [];

    // Smooth lerp — slightly faster response for snappier feel
    const lerp = 0.06;
    smoothMouseX += (targetMouseX - smoothMouseX) * lerp;
    smoothMouseY += (targetMouseY - smoothMouseY) * lerp;

    // Parallax shift — increased for clearly visible effect
    const parallaxX = -smoothMouseX * 22;
    const parallaxY = -smoothMouseY * 10;

    const sx = W * 0.5 + parallaxX;
    const sy = H * 1.06 + parallaxY;
    const trunkLen = H * 0.22;

    // Trunk
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx, sy - trunkLen * 0.45);
    ctx.strokeStyle = 'rgba(110, 185, 138, 0.28)';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();

    drawBranch(sx, sy - trunkLen * 0.45, -Math.PI / 2, trunkLen, 8, t, 0);
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

    window.removeEventListener('resize', resize);
    window.addEventListener('resize', resize);

    // mousemove on window so it fires even when cursor is on the login panel
    window.removeEventListener('mousemove', onMouseMove);
    window.addEventListener('mousemove', onMouseMove, { passive: true });

    // mouseleave only on the auth view element
    authView.removeEventListener('mouseleave', onMouseLeave);
    authView.addEventListener('mouseleave', onMouseLeave, { passive: true });

    resize();
    if (!reducedMotion) {
      animId = requestAnimationFrame(animate);
    }
  }

  function stop() {
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    window.removeEventListener('resize', resize);
    window.removeEventListener('mousemove', onMouseMove);
    authView.removeEventListener('mouseleave', onMouseLeave);
  }

  start();

  window._startTreeCanvas   = start;
  window._treeCanvasCleanup = stop;
})();
