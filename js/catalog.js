/**
 * js/catalog.js
 * Exposes a global `Catalog` object backed by CATALOG / TOPIC_ORDER
 * defined in data/catalog.js (loaded before this file).
 *
 * API:
 *   Catalog.all()          – every item
 *   Catalog.byId(id)       – single item or undefined
 *   Catalog.byTopic(topic) – items whose topics[] contains the given topic
 *   Catalog.byType(type)   – items of a given type
 *   Catalog.validate()     – console.warn for any integrity issue
 */

const Catalog = (() => {
  /* ── Allowed values ────────────────────────────────────────────────── */
  const VALID_TYPES = new Set(["theory", "video", "lecture", "book", "assignment", "quiz", "paper"]);
  const REQUIRED_FIELDS = [
    "id", "title", "type", "topics", "difficulty",
    "minutes", "prereq", "source", "url", "searchQuery", "note",
  ];

  /* ── Build id-lookup index once ────────────────────────────────────── */
  const _index = new Map();
  for (const item of CATALOG) {
    _index.set(item.id, item);
  }

  /* ── Public API ────────────────────────────────────────────────────── */

  /** Returns a shallow copy of the full catalog array. */
  function all() {
    return CATALOG.slice();
  }

  /** Returns the item with the given id, or undefined. */
  function byId(id) {
    return _index.get(id);
  }

  /** Returns all items whose topics[] contains the given topic string. */
  function byTopic(topic) {
    return CATALOG.filter((item) => item.topics.includes(topic));
  }

  /** Returns all items whose type matches the given string. */
  function byType(type) {
    return CATALOG.filter((item) => item.type === type);
  }

  /**
   * Validates catalog integrity and logs a console.warn for each issue.
   * Issues checked:
   *   1. Missing or empty required fields.
   *   2. Unknown type value.
   *   3. Topic not in TOPIC_ORDER.
   *   4. Prerequisite id that does not exist in the catalog.
   */
  function validate() {
    const knownTopics = new Set(TOPIC_ORDER);
    let warningCount = 0;

    function warn(id, msg) {
      console.warn(`[Catalog] ${id}: ${msg}`);
      warningCount++;
    }

    for (const item of CATALOG) {
      const itemId = item.id || "(no id)";

      /* 1 – Required fields */
      for (const field of REQUIRED_FIELDS) {
        if (!(field in item) || item[field] === undefined) {
          warn(itemId, `missing required field "${field}"`);
        }
      }

      /* 2 – Valid type */
      if (item.type !== undefined && !VALID_TYPES.has(item.type)) {
        warn(itemId, `unknown type "${item.type}" (expected one of: ${[...VALID_TYPES].join(", ")})`);
      }

      /* 3 – Valid topics */
      if (Array.isArray(item.topics)) {
        for (const t of item.topics) {
          if (!knownTopics.has(t)) {
            warn(itemId, `unknown topic "${t}" (not in TOPIC_ORDER)`);
          }
        }
      }

      /* 4 – Valid prerequisite ids */
      if (Array.isArray(item.prereq)) {
        for (const pid of item.prereq) {
          if (!_index.has(pid)) {
            warn(itemId, `prereq "${pid}" does not exist in the catalog`);
          }
        }
      }
    }

    if (warningCount === 0) {
      console.log("[Catalog] validate() passed — no issues found across", CATALOG.length, "items.");
    } else {
      console.warn(`[Catalog] validate() finished with ${warningCount} warning(s).`);
    }
  }

  return { all, byId, byTopic, byType, validate };
})();

if (typeof window !== "undefined") {
  window.Catalog = Catalog;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = Catalog;
}
