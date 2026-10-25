/**
 * js/pathEngine.js
 * Generates tailored learning paths based on learner level and placement.
 * Pure logic — no DOM access.
 *
 * Exposes global `PathEngine` with:
 *   PathEngine.generate(level, placement) -> Array<{ id, reason }>
 *   PathEngine.totalMinutes(path)         -> number
 *   PathEngine.explain(path)              -> string
 *   PathEngine.test()                     -> runs automated validation in console
 */

const PathEngine = (() => {
  'use strict';

  /* ── Constants ───────────────────────────────────────────────────────── */
  const TYPE_PRIORITY = {
    theory: 0,
    video: 1,
    lecture: 2,
    book: 3,
    assignment: 4,
    quiz: 5,
    paper: 6,
  };

  const CLUSTER_ORDER = {
    foundations: 0,
    operations: 1,
    balancing: 2,
  };

  /* ── Cluster lookup helper ─────────────────────────────────────────── */
  function getItemCluster(item) {
    if (!item) return 'foundations';
    const firstTopic = (item.topics && item.topics[0]) || '';
    if (typeof CLUSTERS !== 'undefined' && CLUSTERS) {
      for (const [cluster, topics] of Object.entries(CLUSTERS)) {
        if (topics.includes(firstTopic)) {
          return cluster;
        }
      }
    }
    // Safe fallback based on catalog schema
    if (['nodes', 'invariant', 'height-balance', 'traversals'].includes(firstTopic)) {
      return 'foundations';
    }
    if (['search-insert', 'deletion'].includes(firstTopic)) {
      return 'operations';
    }
    if (['balancing', 'applications'].includes(firstTopic)) {
      return 'balancing';
    }
    return 'foundations';
  }

  /* ── Topic index helper ────────────────────────────────────────────── */
  function getTopicIndex(topic) {
    if (typeof TOPIC_ORDER !== 'undefined' && Array.isArray(TOPIC_ORDER)) {
      const idx = TOPIC_ORDER.indexOf(topic);
      if (idx !== -1) return idx;
    }
    return 999;
  }

  /* ── Base comparator (ordering rule) ─────────────────────────────────
   * 1. Papers placed at the very end (isPaper: 0 vs 1)
   * 2. Cluster order: foundations -> operations -> balancing
   * 3. Quizzes placed at the end of each cluster (isQuiz: 0 vs 1)
   * 4. First topic in TOPIC_ORDER
   * 5. Difficulty ascending (1-3)
   * 6. Type priority: theory, video, lecture, book, quiz, paper
   * 7. Tie-breaker by id
   */
  function compareCatalogItems(a, b) {
    const aPaper = a.type === 'paper' ? 1 : 0;
    const bPaper = b.type === 'paper' ? 1 : 0;
    if (aPaper !== bPaper) return aPaper - bPaper;

    const aCluster = CLUSTER_ORDER[getItemCluster(a)] ?? 0;
    const bCluster = CLUSTER_ORDER[getItemCluster(b)] ?? 0;
    if (aCluster !== bCluster) return aCluster - bCluster;

    const aQuiz = a.type === 'quiz' ? 1 : 0;
    const bQuiz = b.type === 'quiz' ? 1 : 0;
    if (aQuiz !== bQuiz) return aQuiz - bQuiz;

    const aTopicIdx = getTopicIndex(a.topics && a.topics[0]);
    const bTopicIdx = getTopicIndex(b.topics && b.topics[0]);
    if (aTopicIdx !== bTopicIdx) return aTopicIdx - bTopicIdx;

    const aDiff = a.difficulty || 1;
    const bDiff = b.difficulty || 1;
    if (aDiff !== bDiff) return aDiff - bDiff;

    const aType = TYPE_PRIORITY[a.type] ?? 99;
    const bType = TYPE_PRIORITY[b.type] ?? 99;
    if (aType !== bType) return aType - bType;

    return a.id.localeCompare(b.id);
  }

  /* ── Prerequisite enforcement (Kahn's Topological Sort) ──────────────
   * Guarantees: if an item's prereq item is in the path, it appears earlier.
   * If a prereq was removed / not in the path, that requirement is dropped.
   * Stable: strictly preserves original sorted order when prerequisites allow.
   */
  function enforcePrerequisites(sortedItems) {
    const itemMap = new Map();
    const idToIndex = new Map();
    for (let i = 0; i < sortedItems.length; i++) {
      itemMap.set(sortedItems[i].id, sortedItems[i]);
      idToIndex.set(sortedItems[i].id, i);
    }

    const presentIds = new Set(sortedItems.map(item => item.id));
    const dependentsFor = new Map();
    const inDegree = new Map();

    for (const item of sortedItems) {
      // Only enforce prereqs that exist in this path
      const activePrereqs = (item.prereq || []).filter(pid => presentIds.has(pid));
      inDegree.set(item.id, activePrereqs.length);
      dependentsFor.set(item.id, []);
    }

    for (const item of sortedItems) {
      const activePrereqs = (item.prereq || []).filter(pid => presentIds.has(pid));
      for (const pid of activePrereqs) {
        if (!dependentsFor.has(pid)) dependentsFor.set(pid, []);
        dependentsFor.get(pid).push(item.id);
      }
    }

    // Ready queue: items with 0 unmet in-path prereqs
    const ready = [];
    for (const item of sortedItems) {
      if (inDegree.get(item.id) === 0) {
        ready.push(item.id);
      }
    }

    const result = [];
    while (ready.length > 0) {
      // Pick item with smallest original sort index for stability
      ready.sort((a, b) => idToIndex.get(a) - idToIndex.get(b));
      const currId = ready.shift();
      result.push(itemMap.get(currId));

      for (const depId of (dependentsFor.get(currId) || [])) {
        const deg = inDegree.get(depId) - 1;
        inDegree.set(depId, deg);
        if (deg === 0) {
          ready.push(depId);
        }
      }
    }

    // Safety fallback (should never trigger in DAG)
    if (result.length < sortedItems.length) {
      const added = new Set(result.map(x => x.id));
      for (const item of sortedItems) {
        if (!added.has(item.id)) result.push(item);
      }
    }

    return result;
  }

  /* ── Deduplication helper ─────────────────────────────────────────── */
  function dedupeItems(items) {
    const seen = new Set();
    const unique = [];
    for (const item of items) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        unique.push(item);
      }
    }
    return unique;
  }

  /* ── Level-specific path generators ───────────────────────────────── */

  /**
   * Beginner:
   * - Include every catalog item.
   * - Full sort and prerequisite enforcement.
   */
  function generateBeginner() {
    const all = typeof Catalog !== 'undefined' ? Catalog.all() : [];
    const sorted = dedupeItems(all).sort(compareCatalogItems);
    const ordered = enforcePrerequisites(sorted);

    return ordered.map(item => {
      let reason = 'Starting from the basics';
      if (item.type === 'quiz') {
        reason = 'Checkpoint to test your understanding';
      } else if (item.type === 'assignment') {
        reason = 'Hands-on structured practice to build real depth';
      } else if (item.type === 'paper') {
        reason = 'Academic perspective on real-world applications';
      } else if (item.difficulty === 2) {
        reason = 'Deeper practice on this topic';
      } else if (item.difficulty >= 3) {
        reason = 'Advanced topic to master';
      }
      return { id: item.id, reason };
    });
  }

  /**
   * Intermediate:
   * - Per cluster using placement:
   *   - solid: drop difficulty 1 items of that cluster (keep cluster quiz and diff 2-3).
   *   - partial or weak: keep all items of that cluster except papers.
   * - Include papers only for the balancing cluster when solid.
   * - Assignments: Intermediate gets one per cluster (the first listed: as-1, as-3, as-5).
   */
  function generateIntermediate(placement) {
    const all = typeof Catalog !== 'undefined' ? Catalog.all() : [];
    const candidates = [];
    const reasonMap = new Map();

    for (const item of all) {
      const cluster = getItemCluster(item);
      const rating = (placement && placement[cluster]) || (cluster === 'foundations' ? 'solid' : 'partial');

      // Rule: papers only for balancing cluster when solid (landmark papers pp-1 and pp-3)
      if (item.type === 'paper') {
        if (cluster === 'balancing' && rating === 'solid' && (item.id === 'pp-1' || item.id === 'pp-3')) {
          candidates.push(item);
          reasonMap.set(item.id, 'Research paper on balanced tree implementations');
        }
        continue;
      }

      // Rule: Intermediate gets one assignment per cluster (the first listed)
      if (item.type === 'assignment') {
        if (item.id === 'as-1' || item.id === 'as-3' || item.id === 'as-5') {
          candidates.push(item);
          reasonMap.set(item.id, 'Hands-on structured assignment for this cluster');
        }
        continue;
      }

      if (rating === 'solid') {
        // solid: drop difficulty 1 items (keep cluster quiz and diff 2-3)
        if (item.type === 'quiz' || (item.difficulty || 1) >= 2) {
          candidates.push(item);
          if (item.type === 'quiz') {
            reasonMap.set(item.id, 'Cluster checkpoint to verify your knowledge');
          } else {
            reasonMap.set(item.id, 'You showed strong foundations here, so we skipped the introduction.');
          }
        }
      } else {
        // partial or weak: keep all items of that cluster except papers
        candidates.push(item);
        if (item.type === 'quiz') {
          reasonMap.set(item.id, 'Cluster checkpoint to verify your knowledge');
        } else if ((item.difficulty || 1) === 1) {
          reasonMap.set(item.id, 'Core concept for your level');
        } else {
          reasonMap.set(item.id, 'Deeper practice on this topic');
        }
      }
    }

    const sorted = dedupeItems(candidates).sort(compareCatalogItems);
    const ordered = enforcePrerequisites(sorted);

    return ordered.map(item => ({
      id: item.id,
      reason: reasonMap.get(item.id) || 'Core concept for your level',
    }));
  }

  /**
   * Revision:
   * - First, the three videos in order (recap)
   * - Then each cluster's quiz
   * - Then, only for clusters rated partial or weak: key theory refresher item and assignment
   * - No books or papers
   */
  function generateRevision(placement) {
    const result = [];
    const seen = new Set();

    function addItem(id, reason) {
      if (!seen.has(id)) {
        seen.add(id);
        result.push({ id, reason });
      }
    }

    // 1. The three videos in order (recap)
    const videoIds = ['vid-1', 'vid-2', 'vid-3'];
    for (const vid of videoIds) {
      if (typeof Catalog !== 'undefined' && Catalog.byId(vid)) {
        addItem(vid, 'Quick recap first');
      }
    }

    // 2. Each cluster's quiz
    const quizItems = typeof Catalog !== 'undefined' ? Catalog.byType('quiz') : [];
    // Sort quizzes by cluster/topic order
    const sortedQuizzes = quizItems.slice().sort(compareCatalogItems);
    for (const qz of sortedQuizzes) {
      addItem(qz.id, 'Quick check on core concepts');
    }

    // 3. For partial or weak clusters: add key refresher theory item and assignment per weak/partial cluster
    const supplementary = [];
    const keyRefreshers = {
      foundations: 'th-invariant',
      operations: 'th-balance',
      balancing: 'th-balance',
    };
    const clusterAssignments = {
      foundations: 'as-1',
      operations: 'as-3',
      balancing: 'as-5',
    };

    if (placement) {
      for (const [cluster, rating] of Object.entries(placement)) {
        if (rating === 'weak' || rating === 'partial') {
          const refId = keyRefreshers[cluster];
          if (refId && typeof Catalog !== 'undefined') {
            const item = Catalog.byId(refId);
            if (item) supplementary.push(item);
          }
          const asId = clusterAssignments[cluster];
          if (asId && typeof Catalog !== 'undefined') {
            const asItem = Catalog.byId(asId);
            if (asItem) supplementary.push(asItem);
          }
        }
      }
    }

    const sortedSupp = dedupeItems(supplementary).sort(compareCatalogItems);
    const orderedSupp = enforcePrerequisites(sortedSupp);

    for (const item of orderedSupp) {
      addItem(item.id, 'Added because this area needs a refresh');
    }

    return result;
  }

  /* ── Public API ──────────────────────────────────────────────────────── */

  /**
   * Generates an ordered array of `{ id, reason }` path steps.
   * Pure function — no DOM access.
   */
  function generate(level, placement) {
    // Resolve defaults if called without args or partially
    if (!level || !placement) {
      const profile = (typeof State !== 'undefined' && typeof State.getProfile === 'function')
        ? State.getProfile()
        : null;
      level = level || (profile && profile.level) || 'beginner';
      placement = placement || (profile && profile.placement);
    }

    let normLevel = String(level || 'beginner').toLowerCase().trim();
    if (normLevel.includes('revis')) {
      normLevel = 'revision';
    } else if (normLevel.includes('inter')) {
      normLevel = 'intermediate';
    } else {
      normLevel = 'beginner';
    }

    let path = [];

    if (normLevel === 'intermediate') {
      const intPlacement = Object.assign({
        foundations: 'solid',
        operations: 'partial',
        balancing: 'partial',
      }, placement);
      path = generateIntermediate(intPlacement);
    } else if (normLevel === 'revision') {
      const revPlacement = Object.assign({
        foundations: 'solid',
        operations: 'solid',
        balancing: 'solid',
      }, placement);
      path = generateRevision(revPlacement);
    } else {
      // Default to beginner: complete curriculum from the basics
      path = generateBeginner();
    }

    // Attach metadata for explain() without mutating element shape
    path.level = normLevel;
    path.placement = placement;

    return path;
  }

  /**
   * Sums total estimated minutes for an array of path items.
   * Accepts Array<{ id }> or Array<string>.
   */
  function totalMinutes(path) {
    if (!Array.isArray(path)) return 0;
    let sum = 0;
    for (const step of path) {
      const id = typeof step === 'string' ? step : step?.id;
      if (!id || typeof Catalog === 'undefined') continue;
      const item = Catalog.byId(id);
      if (item && typeof item.minutes === 'number') {
        sum += item.minutes;
      }
    }
    return sum;
  }

  /**
   * Returns a human-readable one-line summary of the path.
   * e.g. "Intermediate path: 17 steps, about 5h 40m. Skipped introductory theory (foundations rated strong)."
   */
  function explain(path, level, placement) {
    if (!Array.isArray(path)) return '';

    level = level || path.level;
    if (!level && typeof State !== 'undefined' && typeof State.getProfile === 'function') {
      level = State.getProfile()?.level;
    }
    level = (level || 'beginner').toLowerCase();

    placement = placement || path.placement;
    if (!placement && typeof State !== 'undefined' && typeof State.getProfile === 'function') {
      placement = State.getProfile()?.placement;
    }
    placement = placement || {};

    const steps = path.length;
    const mins = totalMinutes(path);
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    const timeStr = hours > 0
      ? (remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`)
      : `${remMins}m`;

    const levelCap = level.charAt(0).toUpperCase() + level.slice(1);

    let note = '';
    if (level === 'beginner') {
      note = 'Comprehensive curriculum from first principles to advanced applications.';
    } else if (level === 'intermediate') {
      if (placement.foundations === 'solid') {
        note = 'Skipped introductory theory (foundations rated strong).';
      } else if (placement.operations === 'solid') {
        note = 'Skipped introductory theory (operations rated strong).';
      } else if (placement.balancing === 'solid') {
        note = 'Skipped introductory theory (balancing rated strong).';
      } else {
        note = 'Targeted intermediate progression with self-balancing research papers.';
      }
    } else if (level === 'revision') {
      const refreshed = Object.entries(placement)
        .filter(([_, r]) => r === 'weak' || r === 'partial')
        .map(([k]) => k);
      if (refreshed.length === 0) {
        note = 'Fast video recap and checkpoints (all areas rated solid).';
      } else {
        note = `Video recap and checkpoints with refresh on ${refreshed.join(', ')}.`;
      }
    }

    return `${levelCap} path: ${steps} steps, about ${timeStr}. ${note}`;
  }

  /**
   * Console-only test runner for validation.
   */
  function test() {
    console.group('%c[PathEngine] Automated Validation', 'color: #10b981; font-weight: bold; font-size: 13px;');

    const pWeak = { foundations: 'weak', operations: 'weak', balancing: 'weak' };
    const pMixed = { foundations: 'solid', operations: 'partial', balancing: 'partial' };
    const pSolid = { foundations: 'solid', operations: 'solid', balancing: 'solid' };

    // 1. Beginner
    const begPath = generate('beginner', pWeak);
    console.group(`Beginner (all weak): ${begPath.length} steps | ${totalMinutes(begPath)}m`);
    console.log('Summary:', explain(begPath, 'beginner', pWeak));
    console.log('Step Titles:');
    begPath.forEach((s, idx) => {
      const it = Catalog.byId(s.id);
      console.log(`  ${idx + 1}. [${s.id}] ${it ? it.title : ''} (${it?.type}, diff ${it?.difficulty}) — "${s.reason}"`);
    });
    console.groupEnd();

    // 2. Intermediate
    const intPath = generate('intermediate', pMixed);
    console.group(`Intermediate (foundations solid, others partial): ${intPath.length} steps | ${totalMinutes(intPath)}m`);
    console.log('Summary:', explain(intPath, 'intermediate', pMixed));
    console.log('Step Titles:');
    intPath.forEach((s, idx) => {
      const it = Catalog.byId(s.id);
      console.log(`  ${idx + 1}. [${s.id}] ${it ? it.title : ''} (${it?.type}, diff ${it?.difficulty}) — "${s.reason}"`);
    });
    console.groupEnd();

    // 3. Revision
    const revPath = generate('revision', pSolid);
    console.group(`Revision (all solid): ${revPath.length} steps | ${totalMinutes(revPath)}m`);
    console.log('Summary:', explain(revPath, 'revision', pSolid));
    console.log('Step Titles:');
    revPath.forEach((s, idx) => {
      const it = Catalog.byId(s.id);
      console.log(`  ${idx + 1}. [${s.id}] ${it ? it.title : ''} (${it?.type}, diff ${it?.difficulty}) — "${s.reason}"`);
    });
    console.groupEnd();

    // Rules verification
    function checkPrereqs(path, label) {
      const seen = new Set();
      for (const step of path) {
        const item = Catalog.byId(step.id);
        if (item && Array.isArray(item.prereq)) {
          for (const pid of item.prereq) {
            const inPath = path.some(s => s.id === pid);
            if (inPath && !seen.has(pid)) {
              console.error(`[FAIL] ${label}: ${step.id} appears before prerequisite ${pid}!`);
              return false;
            }
          }
        }
        seen.add(step.id);
      }
      return true;
    }

    function checkNoDuplicates(path) {
      const ids = path.map(s => s.id);
      return new Set(ids).size === ids.length;
    }

    const begNoDup = checkNoDuplicates(begPath);
    const intNoDup = checkNoDuplicates(intPath);
    const revNoDup = checkNoDuplicates(revPath);

    const begPrereq = checkPrereqs(begPath, 'Beginner');
    const intPrereq = checkPrereqs(intPath, 'Intermediate');
    const revPrereq = checkPrereqs(revPath, 'Revision');

    const lengthOk = begPath.length > intPath.length && intPath.length > revPath.length;

    // ── Adaptation Tests (Prompt 5) ──
    const testPath = [
      { id: 'th-nodes', status: 'done' },
      { id: 'qz-foundations', status: 'current' },
      { id: 'lec-01', status: 'locked' },
      { id: 'lec-03', status: 'locked' },
      { id: 'bk-wengrow', status: 'locked' },
    ];

    // 1. Solid -> check skips on intermediate
    const adaptSolid = adapt(testPath, 'qz-foundations', 'solid', { level: 'intermediate' });
    const solidSkipsOk = adaptSolid.skipped.length === 2 && adaptSolid.skipped.includes('lec-01');

    // 2. Partial -> check one insert
    const adaptPartial = adapt(testPath, 'qz-foundations', 'partial', { level: 'intermediate' });
    const partialInsertOk = adaptPartial.added.length === 1 && adaptPartial.added[0].tag === 'Added for you';

    // 3. Needs Review -> check two inserts, then move on after 2 rounds
    const stateNR = { level: 'intermediate', remediationCounts: {} };
    const adaptNR1 = adapt(testPath, 'qz-foundations', 'needs_review', stateNR);
    const nr1Ok = adaptNR1.added.length >= 1;

    const adaptNR2 = adapt(adaptNR1.path, 'qz-foundations', 'needs_review', stateNR);
    const adaptNR3 = adapt(adaptNR2.path, 'qz-foundations', 'needs_review', stateNR);
    const moveOnOk = adaptNR3.moveOn === true && adaptNR3.message.includes('move on');

    console.log('4. Adapt Solid skips difficulty 1 items (Intermediate):', solidSkipsOk ? '✅ PASS' : '❌ FAIL');
    console.log('5. Adapt Partial inserts 1 supporting item with "Added for you":', partialInsertOk ? '✅ PASS' : '❌ FAIL');
    console.log('6. Adapt Needs Review inserts supporting items and moves on after 2 rounds:', (nr1Ok && moveOnOk) ? '✅ PASS' : '❌ FAIL');
    console.groupEnd();

    return {
      begLength: begPath.length,
      intLength: intPath.length,
      revLength: revPath.length,
      valid: lengthOk && begNoDup && intNoDup && revNoDup && begPrereq && intPrereq && revPrereq && solidSkipsOk && partialInsertOk && moveOnOk,
    };
  }

  /* ── Adaptation Engine (Prompt 5) ─────────────────────────────────── */

  function getClusterDisplayName(cluster, quizItem) {
    if (quizItem && Array.isArray(quizItem.topics) && quizItem.topics[0]) {
      const t = quizItem.topics[0];
      if (t === 'deletion') return 'Deletion';
      if (t === 'search-insert') return 'Search & Insert';
      if (t === 'balancing') return 'Self-Balancing Trees';
      if (t === 'height-balance') return 'Height & Balance';
      if (t === 'invariant') return 'BST Invariant';
      if (t === 'nodes') return 'Foundations';
    }
    if (cluster === 'operations') return 'Operations';
    if (cluster === 'balancing') return 'Balancing';
    return 'Foundations';
  }

  /**
   * Adapts the path after a quiz step is evaluated.
   * Pure function — no DOM access.
   *
   * @param {Array<{ id: string, status?: string, reason?: string, tag?: string }>} path
   * @param {string} quizItemId
   * @param {string} rating ('solid' | 'partial' | 'needs_review' | 'weak')
   * @param {Object} [state] Learner profile & adaptation state
   * @returns {{
   *   path: Array<{ id: string, status: string, reason: string, tag?: string }>,
   *   added: Array<{ id: string, reason: string, tag: string }>,
   *   skipped: Array<string>,
   *   retryQuiz: boolean,
   *   moveOn: boolean,
   *   message: string,
   *   cluster: string,
   *   clusterName: string
   * }}
   */
  function adapt(path, quizItemId, rating, state) {
    if (!Array.isArray(path)) return { path: [], added: [], skipped: [], retryQuiz: false, moveOn: false, message: '' };

    const newPath = path.map(item => Object.assign({}, item));
    const quizIdx = newPath.findIndex(s => s.id === quizItemId);
    if (quizIdx === -1) {
      return { path: newPath, added: [], skipped: [], retryQuiz: false, moveOn: false, message: '' };
    }

    const quizItem = typeof Catalog !== 'undefined' ? Catalog.byId(quizItemId) : null;
    const cluster = getItemCluster(quizItem);
    const clusterName = getClusterDisplayName(cluster, quizItem);

    // Normalize rating
    let normRating = String(rating || 'needs_review').toLowerCase().trim();
    if (normRating.includes('solid') || normRating.includes('pass')) normRating = 'solid';
    else if (normRating.includes('part')) normRating = 'partial';
    else normRating = 'needs_review';

    state = state || {};
    if (!state.remediationCounts) state.remediationCounts = {};
    const currentRounds = state.remediationCounts[quizItemId] || 0;

    const level = (state.level || (typeof State !== 'undefined' && State.getProfile()?.level) || 'beginner').toLowerCase();
    const isInterOrRev = level.includes('inter') || level.includes('revis');
    const inPathIds = new Set(newPath.map(s => s.id));
    if (Array.isArray(state.completedIds)) {
      state.completedIds.forEach(id => inPathIds.add(id));
    }

    // ── Case 1: Solid ───────────────────────────────────────────────
    if (normRating === 'solid') {
      const skippedIds = [];
      if (isInterOrRev) {
        let skipCount = 0;
        for (let i = quizIdx + 1; i < newPath.length && skipCount < 2; i++) {
          const step = newPath[i];
          if (step.status !== 'done' && step.status !== 'skipped') {
            const item = typeof Catalog !== 'undefined' ? Catalog.byId(step.id) : null;
            if (item && item.type !== 'quiz' && getItemCluster(item) === cluster && (item.difficulty || 1) === 1) {
              step.status = 'skipped';
              step.reason = "Skipped because you've shown mastery here";
              step.tag = "Skipped (mastered)";
              skippedIds.push(step.id);
              skipCount++;
            }
          }
        }
      }

      const message = skippedIds.length > 0
        ? `Your path adapted: ${skippedIds.length} ${skippedIds.length === 1 ? 'resource' : 'resources'} skipped because you showed mastery`
        : `Solid understanding demonstrated on ${clusterName}!`;

      return {
        path: newPath,
        added: [],
        skipped: skippedIds,
        retryQuiz: false,
        moveOn: false,
        message,
        cluster,
        clusterName,
      };
    }

    // ── Case 2 & 3: Partial or Needs Review ────────────────────────
    // Rule: Maximum 2 remediation rounds per quiz. After that, show "Let's move on and come back to this later"
    if (currentRounds >= 2) {
      return {
        path: newPath,
        added: [],
        skipped: [],
        retryQuiz: false,
        moveOn: true,
        message: "Let's move on and come back to this later",
        cluster,
        clusterName,
      };
    }

    state.remediationCounts[quizItemId] = currentRounds + 1;

    const allCatalog = typeof Catalog !== 'undefined' ? Catalog.all() : [];
    const addedItems = [];

    // Helper to check if a catalog video is already done
    function isVideoDone(vidId) {
      const vNum = vidId === 'vid-1' ? 1 : (vidId === 'vid-2' ? 2 : 3);
      if (state.videoProgress && state.videoProgress[vNum]) return true;
      if (typeof State !== 'undefined' && State.getVideoProgress && State.getVideoProgress()[vNum]) return true;
      if (newPath.some(s => s.id === vidId && (s.status === 'done' || s.status === 'skipped'))) return true;
      return false;
    }

    if (normRating === 'partial') {
      // Rule: insert ONE supporting item right after quiz:
      // lowest-difficulty catalog item of the same cluster that is not already in path and not a paper.
      const candidates = allCatalog.filter(item => {
        if (inPathIds.has(item.id)) return false;
        if (item.type === 'paper' || item.type === 'quiz') return false;
        if (item.type === 'video' && isVideoDone(item.id)) return false;
        return getItemCluster(item) === cluster;
      }).sort((a, b) => {
        const diffDiff = (a.difficulty || 1) - (b.difficulty || 1);
        if (diffDiff !== 0) return diffDiff;
        const typeDiff = (TYPE_PRIORITY[a.type] ?? 99) - (TYPE_PRIORITY[b.type] ?? 99);
        if (typeDiff !== 0) return typeDiff;
        return (a.minutes || 0) - (b.minutes || 0);
      });

      if (candidates.length > 0) {
        const picked = candidates[0];
        const stepObj = {
          id: picked.id,
          status: 'locked',
          reason: `Added because your answer on ${clusterName.toLowerCase()} needed more support`,
          tag: 'Added for you',
          remediationFor: quizItemId,
        };
        newPath.splice(quizIdx + 1, 0, stepObj);
        inPathIds.add(picked.id);
        addedItems.push(stepObj);
      }
    } else {
      // Rule (Needs Review): insert up to TWO items right after quiz:
      // (1) the cluster's Manim video if not already in path / not already done
      // (2) the lowest-difficulty theory item of the cluster not yet done / not in path

      const clusterVideoMap = {
        foundations: 'vid-1',
        operations: 'vid-2',
        balancing: 'vid-3',
      };
      const expectedVid = clusterVideoMap[cluster];

      if (expectedVid && !inPathIds.has(expectedVid) && !isVideoDone(expectedVid)) {
        const vidItem = typeof Catalog !== 'undefined' ? Catalog.byId(expectedVid) : null;
        if (vidItem) {
          const stepObj = {
            id: vidItem.id,
            status: 'locked',
            reason: `Added because your answer on ${clusterName.toLowerCase()} needed more support`,
            tag: 'Added for you',
            remediationFor: quizItemId,
          };
          addedItems.push(stepObj);
          inPathIds.add(vidItem.id);
        }
      }

      const theoryCandidates = allCatalog.filter(item => {
        if (inPathIds.has(item.id)) return false;
        if (item.type !== 'theory') return false;
        return getItemCluster(item) === cluster;
      }).sort((a, b) => ((a.difficulty || 1) - (b.difficulty || 1)));

      if (theoryCandidates.length > 0) {
        const pickedTheory = theoryCandidates[0];
        const stepObj = {
          id: pickedTheory.id,
          status: 'locked',
          reason: `Added because your answer on ${clusterName.toLowerCase()} needed more support`,
          tag: 'Added for you',
          remediationFor: quizItemId,
        };
        addedItems.push(stepObj);
        inPathIds.add(pickedTheory.id);
      } else {
        // Fallback for clusters without unassigned theory items: lowest-difficulty non-paper/non-quiz item
        const fallbackCandidates = allCatalog.filter(item => {
          if (inPathIds.has(item.id)) return false;
          if (item.type === 'paper' || item.type === 'quiz') return false;
          return getItemCluster(item) === cluster;
        }).sort((a, b) => (a.difficulty || 1) - (b.difficulty || 1));

        if (fallbackCandidates.length > 0 && addedItems.length < 2) {
          const pickedFallback = fallbackCandidates[0];
          const stepObj = {
            id: pickedFallback.id,
            status: 'locked',
            reason: `Added because your answer on ${clusterName.toLowerCase()} needed more support`,
            tag: 'Added for you',
            remediationFor: quizItemId,
          };
          addedItems.push(stepObj);
          inPathIds.add(pickedFallback.id);
        }
      }

      newPath.splice(quizIdx + 1, 0, ...addedItems);
    }

    const count = addedItems.length;
    const message = count > 0
      ? `Your path adapted: ${count} ${count === 1 ? 'resource' : 'resources'} added to help with ${clusterName}`
      : `Review suggested for ${clusterName}. Try checking the key concepts.`;

    return {
      path: newPath,
      added: addedItems,
      skipped: [],
      retryQuiz: true,
      moveOn: false,
      message,
      cluster,
      clusterName,
    };
  }

  return {
    generate,
    totalMinutes,
    explain,
    adapt,
    test,
  };
})();

if (typeof window !== "undefined") {
  window.PathEngine = PathEngine;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = PathEngine;
}
