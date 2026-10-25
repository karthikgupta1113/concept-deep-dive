/**
 * data/catalog.js
 * Raw catalog data for the Concept Deep-Dive app.
 * Plain JS — no fetch, works from both a local server and the file system.
 */

/* ── Topic ordering ─────────────────────────────────────────────────────── */

const TOPIC_ORDER = [
  "nodes",
  "invariant",
  "height-balance",
  "traversals",
  "search-insert",
  "deletion",
  "balancing",
  "applications",
];

/* ── Cluster groupings (used later for placement & adaptation) ──────────── */

const CLUSTERS = {
  foundations: ["nodes", "invariant", "height-balance", "traversals"],
  operations:  ["search-insert", "deletion"],
  balancing:   ["balancing", "applications"],
};

/* ── Catalog items ──────────────────────────────────────────────────────── */

const CATALOG = [
  /* ── Theory ─────────────────────────────────────────────────────────── */
  {
    id: "th-nodes",
    title: "Anatomy of a Tree",
    type: "theory",
    topics: ["nodes"],
    difficulty: 1,
    minutes: 6,
    prereq: [],
    source: "Foundations",
    url: null,
    searchQuery: null,
    note: "Node, root, leaf, internal node, edge, Binary Tree vs BST",
  },
  {
    id: "th-invariant",
    title: "The BST Invariant",
    type: "theory",
    topics: ["invariant"],
    difficulty: 1,
    minutes: 7,
    prereq: ["th-nodes"],
    source: "Foundations",
    url: null,
    searchQuery: null,
    note: "left < node < right with the 50,30,70,20,40 worked example",
  },
  {
    id: "th-height",
    title: "Height & Depth",
    type: "theory",
    topics: ["height-balance"],
    difficulty: 1,
    minutes: 5,
    prereq: ["th-invariant"],
    source: "Foundations",
    url: null,
    searchQuery: null,
    note: "Why height decides speed",
  },
  {
    id: "th-balance",
    title: "Balance Factor",
    type: "theory",
    topics: ["height-balance"],
    difficulty: 2,
    minutes: 5,
    prereq: ["th-height"],
    source: "Foundations",
    url: null,
    searchQuery: null,
    note: "Healthy vs lopsided trees",
  },
  {
    id: "th-traversal",
    title: "Tree Traversals",
    type: "theory",
    topics: ["traversals"],
    difficulty: 2,
    minutes: 8,
    prereq: ["th-invariant"],
    source: "Foundations",
    url: null,
    searchQuery: null,
    note: "In-order, pre-order, post-order",
  },

  /* ── Videos ──────────────────────────────────────────────────────────── */
  {
    id: "vid-1",
    title: "Part 1: Foundations & Traversals",
    type: "video",
    topics: ["nodes", "invariant", "height-balance", "traversals"],
    difficulty: 1,
    minutes: 8,
    prereq: [],
    source: "Concept Deep-Dive",
    url: "assets/videos/video1_foundations.mp4",
    searchQuery: null,
    note: "Animated walkthrough",
  },
  {
    id: "vid-2",
    title: "Part 2: Search, Insertion & Deletion",
    type: "video",
    topics: ["search-insert", "deletion"],
    difficulty: 2,
    minutes: 8,
    prereq: ["th-invariant"],
    source: "Concept Deep-Dive",
    url: "assets/videos/video2_core_operations.mp4",
    searchQuery: null,
    note: "All three deletion cases",
  },
  {
    id: "vid-3",
    title: "Part 3: Self-Balancing Trees & Real-World Use",
    type: "video",
    topics: ["balancing", "applications"],
    difficulty: 2,
    minutes: 10,
    prereq: ["th-balance"],
    source: "Concept Deep-Dive",
    url: "assets/videos/video3_self_balancing.mp4",
    searchQuery: null,
    note: "AVL rotations, Red-Black trees, applications",
  },

  /* ── Lectures ────────────────────────────────────────────────────────── */
  {
    id: "lec-01",
    title: "NPTEL Lecture 6: Trees (Dr. Naveen Garg, IIT Delhi)",
    type: "lecture",
    topics: ["nodes"],
    difficulty: 1,
    minutes: 50,
    prereq: [],
    source: "NPTEL",
    url: "https://www.youtube.com/watch?v=tORLeHHtazM",
    searchQuery: null,
    note: "What a tree is, basic terminology",
  },
  {
    id: "lec-02",
    title: "MIT 6.006 (2020) Lecture 6: Binary Trees, Part 1",
    type: "lecture",
    topics: ["nodes", "invariant"],
    difficulty: 2,
    minutes: 50,
    prereq: [],
    source: "MIT OCW",
    url: "https://www.youtube.com/playlist?list=PLUl4u3cNGP63EdVPNLG3ToM6LaEUuStEY",
    searchQuery: null,
    note: "Binary tree structure, pointer-based implementation",
  },
  {
    id: "lec-03",
    title: "mycodeschool: Binary Search Tree Introduction",
    type: "lecture",
    topics: ["invariant"],
    difficulty: 1,
    minutes: 15,
    prereq: [],
    source: "YouTube",
    url: null,
    searchQuery: "mycodeschool binary search tree",
    note: "Visual beginner-friendly intro to BSTs",
  },
  {
    id: "lec-04",
    title: "NPTEL Lecture 7: Tree Walks / Traversals",
    type: "lecture",
    topics: ["traversals"],
    difficulty: 2,
    minutes: 50,
    prereq: [],
    source: "NPTEL",
    url: "https://nptel.ac.in/courses/106102064",
    searchQuery: null,
    note: "In-order, pre-order, post-order",
  },
  {
    id: "lec-05",
    title: "Abdul Bari: Binary Search Tree",
    type: "lecture",
    topics: ["traversals", "search-insert"],
    difficulty: 1,
    minutes: 25,
    prereq: [],
    source: "YouTube",
    url: null,
    searchQuery: "Abdul Bari Binary Search Tree",
    note: "Traversal logic explained clearly",
  },
  {
    id: "lec-06",
    title: "MIT 6.006 Lecture 5: Binary Search Trees, BST Sort",
    type: "lecture",
    topics: ["search-insert"],
    difficulty: 2,
    minutes: 50,
    prereq: [],
    source: "MIT OCW",
    url: "https://ocw.mit.edu/courses/electrical-engineering-and-computer-science/6-006-introduction-to-algorithms-fall-2011/lecture-videos/lecture-5-binary-search-trees-bst-sort/",
    searchQuery: null,
    note: "Insertion, search, min/max",
  },
  {
    id: "lec-07",
    title: "freeCodeCamp: Data Structures Full Course (Tree section)",
    type: "lecture",
    topics: ["search-insert"],
    difficulty: 2,
    minutes: 30,
    prereq: [],
    source: "YouTube",
    url: null,
    searchQuery: "freeCodeCamp data structures course trees",
    note: "Coded implementation of core BST operations",
  },
  {
    id: "lec-08",
    title: "NPTEL Lecture 17: BST Deletion",
    type: "lecture",
    topics: ["deletion"],
    difficulty: 3,
    minutes: 50,
    prereq: [],
    source: "NPTEL",
    url: null,
    searchQuery: "NPTEL Data Structures Algorithms Naveen Garg Lecture 17",
    note: "Successor and predecessor logic",
  },
  {
    id: "lec-09",
    title: "MIT 6.006 Lecture 6: AVL Trees, AVL Sort",
    type: "lecture",
    topics: ["balancing"],
    difficulty: 3,
    minutes: 50,
    prereq: [],
    source: "MIT OCW",
    url: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/resources/lecture-videos/",
    searchQuery: null,
    note: "Why BSTs degrade and how AVL rotations fix it",
  },
  {
    id: "lec-10",
    title: "MIT OCW 6.006 Full Lecture Archive",
    type: "lecture",
    topics: ["balancing", "applications"],
    difficulty: 3,
    minutes: 60,
    prereq: [],
    source: "MIT OCW",
    url: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/video_galleries/lecture-videos/",
    searchQuery: null,
    note: "Reference hub for advanced tree topics",
  },

  /* ── Books ───────────────────────────────────────────────────────────── */
  {
    id: "bk-wengrow",
    title: "A Common-Sense Guide to Data Structures and Algorithms (Jay Wengrow)",
    type: "book",
    topics: ["nodes", "invariant", "traversals", "search-insert"],
    difficulty: 2,
    minutes: 45,
    prereq: [],
    source: "Book",
    url: null,
    searchQuery: "A Common-Sense Guide to Data Structures and Algorithms Jay Wengrow",
    note: "Intuition before CLRS",
  },
  {
    id: "bk-goodrich",
    title: "Data Structures and Algorithms in Java/Python (Goodrich, Tamassia)",
    type: "book",
    topics: ["search-insert", "deletion", "balancing"],
    difficulty: 2,
    minutes: 60,
    prereq: [],
    source: "Book",
    url: null,
    searchQuery: "Goodrich Tamassia Data Structures and Algorithms",
    note: "Theory plus working implementation code",
  },
  {
    id: "bk-clrs",
    title: "Introduction to Algorithms (CLRS)",
    type: "book",
    topics: ["invariant", "search-insert", "deletion", "balancing"],
    difficulty: 3,
    minutes: 90,
    prereq: [],
    source: "Book",
    url: null,
    searchQuery: "Introduction to Algorithms CLRS",
    note: "Most rigorous treatment of BSTs and red-black trees",
  },

  /* ── Papers ──────────────────────────────────────────────────────────── */
  {
    id: "pp-1",
    title: "A Comparative Analysis of Self-Balancing Binary Search Trees",
    type: "paper",
    topics: ["balancing"],
    difficulty: 3,
    minutes: 30,
    prereq: [],
    source: "Paper",
    url: "https://www.math.nagoya-u.ac.jp/~richard/teaching/s2024/SML_Liu_2.pdf",
    searchQuery: null,
    note: "AVL vs Red-Black",
  },
  {
    id: "pp-2",
    title: "Transactions on Red-Black and AVL Trees in NVRAM",
    type: "paper",
    topics: ["balancing", "applications"],
    difficulty: 3,
    minutes: 30,
    prereq: [],
    source: "arXiv",
    url: "https://arxiv.org/pdf/2006.16284",
    searchQuery: null,
    note: "Red-Black properties and a hardware application",
  },
  {
    id: "pp-3",
    title: "A Survey on Balanced Binary Search Trees Methods",
    type: "paper",
    topics: ["balancing", "applications"],
    difficulty: 3,
    minutes: 30,
    prereq: [],
    source: "ResearchGate",
    url: "https://www.researchgate.net/publication/357983864_A_Survey_on_Balanced_Binary_Search_Trees_methods",
    searchQuery: null,
    note: "May need a ResearchGate access request",
  },
  {
    id: "pp-4",
    title: "AVL and Red-Black Tree as a Single Balanced Tree",
    type: "paper",
    topics: ["balancing"],
    difficulty: 3,
    minutes: 30,
    prereq: [],
    source: "ResearchGate",
    url: "https://www.researchgate.net/publication/324062356_AVL_and_Red_Black_tree_as_a_single_balanced_tree",
    searchQuery: null,
    note: "Trees are still an active research area",
  },
  {
    id: "pp-5",
    title: "Maintaining AUC and H-measure over Time",
    type: "paper",
    topics: ["applications"],
    difficulty: 3,
    minutes: 30,
    prereq: [],
    source: "arXiv",
    url: "https://arxiv.org/pdf/2112.06160",
    searchQuery: null,
    note: "Self-balancing trees inside an ML system",
  },

  /* ── Quizzes ─────────────────────────────────────────────────────────── */
  {
    id: "qz-foundations",
    title: "Checkpoint: Foundations",
    type: "quiz",
    topics: ["nodes", "invariant", "height-balance", "traversals"],
    difficulty: 1,
    minutes: 5,
    prereq: [],
    source: "Assessment",
    url: null,
    searchQuery: null,
    note: "Explain in your own words why a BST's in-order traversal always returns values in sorted order.",
  },
  {
    id: "qz-height",
    title: "Checkpoint: Height & Degeneration",
    type: "quiz",
    topics: ["height-balance", "search-insert"],
    difficulty: 2,
    minutes: 5,
    prereq: [],
    source: "Assessment",
    url: null,
    searchQuery: null,
    note: "Why is tree height critical for operation runtime, and what structural condition causes a BST to degenerate into a linked list?",
  },
  {
    id: "qz-deletion",
    title: "Checkpoint: Deletion",
    type: "quiz",
    topics: ["deletion"],
    difficulty: 3,
    minutes: 5,
    prereq: [],
    source: "Assessment",
    url: null,
    searchQuery: null,
    note: "When deleting a BST node with two children, why is replacing it with its in-order successor necessary to maintain the BST invariant?",
  },
  {
    id: "qz-balancing",
    title: "Checkpoint: Self-Balancing Trees",
    type: "quiz",
    topics: ["balancing", "applications"],
    difficulty: 3,
    minutes: 5,
    prereq: [],
    source: "Assessment",
    url: null,
    searchQuery: null,
    note: "How do self-balancing trees (like AVL or Red-Black trees) extend basic BST principles to guarantee O(log n) operations?",
  },

  /* ── Structured Assignments (Prompt 3) ───────────────────────────────── */
  {
    id: "as-1",
    title: "Explain it back",
    type: "assignment",
    topics: ["nodes", "invariant"],
    difficulty: 1,
    minutes: 15,
    prereq: ["th-invariant"],
    source: "Structured Assignment",
    url: null,
    searchQuery: null,
    note: "Explain what makes a BST different from a plain binary tree, to a friend who has never seen one.",
    brief: "Explain what makes a binary search tree different from a plain binary tree, to a friend who has never seen one. Use a small example with numbers.",
    rubric: [
      { id: "def", title: "Correct definition", description: "Clear definition contrasting general binary trees with BST ordering." },
      { id: "example", title: "Uses a numbered example", description: "Provides a concrete numeric example illustrating left < parent < right." },
      { id: "every_node", title: "Says the rule applies at every node", description: "Explicitly states the ordering property holds recursively at every subtree node, not just the root." },
      { id: "clarity", title: "Clarity", description: "Explanation is coherent, accessible, and free of contradictions." }
    ],
    hints: [
      "What extra rule does a BST add?",
      "Pick node 30 with children 20 and 40. Which is smaller?",
      "Rule: left < node < right, at every node, not just the root."
    ],
    inputs: [
      { id: "explanation", type: "textarea", label: "Your Explanation", placeholder: "Explain to a friend what makes a BST special, with a numbered example..." }
    ],
    deterministic: null
  },
  {
    id: "as-2",
    title: "Build the tree",
    type: "assignment",
    topics: ["traversals", "height-balance"],
    difficulty: 2,
    minutes: 15,
    prereq: ["th-traversal"],
    source: "Structured Assignment",
    url: null,
    searchQuery: null,
    note: "Insert 45, 20, 60, 10, 30, 50, 70 into an empty BST and determine traversals and height.",
    brief: "Insert 45, 20, 60, 10, 30, 50, 70 into an empty BST, in that order. Inputs: in-order list, pre-order list, post-order list, tree height (number).",
    rubric: [
      { id: "inorder", title: "In-order traversal correctness", description: "Correct in-order sequence: 10, 20, 30, 45, 50, 60, 70." },
      { id: "preorder", title: "Pre-order traversal correctness", description: "Correct pre-order sequence: 45, 20, 10, 30, 60, 50, 70." },
      { id: "postorder", title: "Post-order traversal correctness", description: "Correct post-order sequence: 10, 30, 20, 50, 70, 60, 45." },
      { id: "height", title: "Tree height calculation", description: "Correct tree height: 2 (edges from root to deepest leaf: 45 -> 20 -> 10)." }
    ],
    hints: [
      "Draw the tree first. Where does 20 go relative to 45?",
      "In-order must come out sorted.",
      "Pre-order starts at the root: 45, then the whole left subtree."
    ],
    inputs: [
      { id: "inOrder", type: "text", label: "In-Order List", placeholder: "e.g. 10, 20, 30, ..." },
      { id: "preOrder", type: "text", label: "Pre-Order List", placeholder: "e.g. 45, 20, ..." },
      { id: "postOrder", type: "text", label: "Post-Order List", placeholder: "e.g. 10, 30, ..." },
      { id: "height", type: "number", label: "Tree Height", placeholder: "e.g. 2" }
    ],
    deterministic: {
      inOrder: "10,20,30,45,50,60,70",
      preOrder: "45,20,10,30,60,50,70",
      postOrder: "10,30,20,50,70,60,45",
      height: 2
    }
  },
  {
    id: "as-3",
    title: "Spot the violation",
    type: "assignment",
    topics: ["search-insert", "invariant"],
    difficulty: 2,
    minutes: 15,
    prereq: ["th-invariant"],
    source: "Structured Assignment",
    url: null,
    searchQuery: null,
    note: "Identify which node breaks the BST rule in the given tree and explain why.",
    brief: "This tree is described as parent → (left, right): 40 → (25, 60); 25 → (15, 45); 60 → (55, 70). One node breaks the BST rule. Which one, and why?",
    rubric: [
      { id: "node", title: "Names the right node", description: "Correctly identifies node 45 as the violator." },
      { id: "left_subtree", title: "Explains left subtree violation", description: "Explains node 45 sits in the left subtree of 40 but is greater than 40." },
      { id: "whole_subtree", title: "Subtree rule understanding", description: "Demonstrates that the BST property applies to all nodes in the subtree, not just immediate parents." },
      { id: "clarity", title: "Clarity", description: "Clear, precise explanation." }
    ],
    hints: [
      "Check each node against its parent first.",
      "45 is bigger than its parent 25, fine. But where is 25 relative to 40?",
      "Everything under 40's left side must be smaller than 40."
    ],
    inputs: [
      { id: "violatingNode", type: "text", label: "Violating Node", placeholder: "e.g. 45" },
      { id: "explanation", type: "textarea", label: "Why does it break the BST rule?", placeholder: "Explain why this node violates the global BST invariant..." }
    ],
    deterministic: {
      violatingNode: "45"
    }
  },
  {
    id: "as-4",
    title: "Delete with reasoning",
    type: "assignment",
    topics: ["deletion"],
    difficulty: 3,
    minutes: 20,
    prereq: ["th-deletion"],
    source: "Structured Assignment",
    url: null,
    searchQuery: null,
    note: "Delete node 30 with two children, identify the replacement, and provide the final tree shape.",
    brief: "Tree: 50 → (30, 70); 30 → (20, 40); 40 → (35, none); 70 → (60, 80). Delete 30. Which value replaces it, and why does that value keep the tree valid? Give the final shape as parent → (left, right).",
    rubric: [
      { id: "successor", title: "Identifies in-order successor", description: "Identifies 35 as the in-order successor (smallest in the right subtree)." },
      { id: "invariant", title: "Justifies with the invariant", description: "Explains why replacing with 35 preserves the ordering for all surrounding nodes." },
      { id: "shape", title: "Correct final shape", description: "Final structure: 50 → (35, 70); 35 → (20, 40); 40 → (none, none)." },
      { id: "clarity", title: "Clarity", description: "Rigorous step-by-step reasoning." }
    ],
    hints: [
      "30 has two children. Which node comes right after 30 in sorted order?",
      "Go to 30's right child, then keep going left.",
      "That node moves up; its own child takes its old place."
    ],
    inputs: [
      { id: "replacementValue", type: "text", label: "Replacement Value for 30", placeholder: "e.g. 35" },
      { id: "reasoning", type: "textarea", label: "Why does this value preserve the BST invariant?", placeholder: "Explain why the in-order successor is chosen..." },
      { id: "finalShape", type: "textarea", label: "Final Shape (parent → left, right)", placeholder: "e.g. 50 → (35, 70); 35 → (20, 40); 40 → (none, none)" }
    ],
    deterministic: {
      replacementValue: "35",
      finalShape: "50 → (35, 70); 35 → (20, 40); 40 → (none, none)"
    }
  },
  {
    id: "as-5",
    title: "Diagnose the imbalance",
    type: "assignment",
    topics: ["balancing"],
    difficulty: 2,
    minutes: 15,
    prereq: ["th-balance"],
    source: "Structured Assignment",
    url: null,
    searchQuery: null,
    note: "Calculate height of degenerate BST and determine AVL rotation required.",
    brief: "Insert 10, 20, 30, 40, 50 into a plain BST, in order. What is the height? After the first three inserts, which rotation would an AVL tree apply?",
    rubric: [
      { id: "height", title: "Height correct", description: "Correct height is 4 for sorted sequence 10, 20, 30, 40, 50." },
      { id: "rotation", title: "Rotation correct", description: "Correct rotation is left rotation (RR case) at root 10." },
      { id: "degradation", title: "Explains sorted degradation", description: "Explains how monotonically sorted keys cause linear chain O(n) degeneration." },
      { id: "clarity", title: "Clarity", description: "Clear and precise explanation." }
    ],
    hints: [
      "Where does each new value go?",
      "Every value goes to the right of the last one.",
      "A right-heavy chain is fixed by rotating left at the top node."
    ],
    inputs: [
      { id: "height", type: "text", label: "Height of plain BST", placeholder: "e.g. 4" },
      { id: "rotation", type: "text", label: "AVL Rotation after 10, 20, 30", placeholder: "e.g. left rotation (RR)" },
      { id: "degradationReason", type: "textarea", label: "Why does sorted input degrade a BST?", placeholder: "Explain why sequential insertion creates a degenerated structure..." }
    ],
    deterministic: {
      height: "4",
      rotation: "left rotation"
    }
  },
  {
    id: "as-6",
    title: "Choose the structure",
    type: "assignment",
    topics: ["balancing", "applications"],
    difficulty: 3,
    minutes: 20,
    prereq: ["th-balance"],
    source: "Structured Assignment",
    url: null,
    searchQuery: null,
    note: "Choose between AVL and Red-Black trees for write-heavy vs read-heavy workloads.",
    brief: "A database index has constant inserts and deletes. A dictionary app is read-heavy. Choose AVL or Red-Black for each, and justify.",
    rubric: [
      { id: "write_heavy", title: "Correct choice for write-heavy", description: "Chooses Red-Black tree for write-heavy database index." },
      { id: "read_heavy", title: "Correct choice for read-heavy", description: "Chooses AVL tree for read-heavy dictionary app." },
      { id: "tradeoffs", title: "Explains strict vs looser balance", description: "Explains AVL's stricter balance optimizes search at the cost of more rotations during modification." },
      { id: "clarity", title: "Clarity", description: "Articulate, well-reasoned architectural comparison." }
    ],
    hints: [
      "Which one rebalances more strictly?",
      "Strict balance means faster lookups but more rotations.",
      "Many writes → fewer rotations is better."
    ],
    inputs: [
      { id: "dbStructure", type: "text", label: "Structure for Database Index (Write-Heavy)", placeholder: "e.g. Red-Black Tree" },
      { id: "dictStructure", type: "text", label: "Structure for Dictionary App (Read-Heavy)", placeholder: "e.g. AVL Tree" },
      { id: "justification", type: "textarea", label: "Justification comparing balance strictness and rotation costs", placeholder: "Explain the tradeoff between AVL and Red-Black trees..." }
    ],
    deterministic: {
      dbStructure: "Red-Black",
      dictStructure: "AVL"
    }
  },
];

if (typeof window !== "undefined") {
  window.CATALOG = CATALOG;
  window.TOPIC_ORDER = TOPIC_ORDER;
  window.CLUSTERS = CLUSTERS;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { CATALOG, TOPIC_ORDER, CLUSTERS };
}
