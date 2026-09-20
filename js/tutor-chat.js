/**
 * tutor-chat.js — Socratic AI Tutor Chat Service
 * Handles Socratic prompt preparation, Gemini API requests, response parsing, and Socratic mock fallback.
 */

(function initTutorChatService() {

  // GEMINI_API_KEY is loaded globally from js/config.js (gitignored)

  const TOPIC_NAMES = {
    0: "Theory & Core Concepts (Stage 1 Foundations)",
    1: "University Lectures & Talks (Stage 2 Top Lectures)",
    2: "Essential Reading & Excerpts (Stage 3 Best Books)",
    3: "Papers & Deeper Reading (Stage 4 Research)"
  };

  const STAGE_NAMES = {
    0: "Foundations",
    1: "Lectures",
    2: "Books",
    3: "Research"
  };

  const STAGE_QUESTIONS = {
    0: "Explain in your own words why a Binary Search Tree's in-order traversal always returns values in sorted order.",
    1: "Why is tree height critical for operation runtime, and what structural condition causes a BST to degenerate into a linked list?",
    2: "When deleting a BST node with two children, why is replacing it with its in-order successor necessary to maintain the BST invariant?",
    3: "How do self-balancing trees (like AVL or Red-Black trees) extend basic BST principles to guarantee O(log n) operations in the worst case?"
  };

  const SYSTEM_PROMPT_TEMPLATE = 
    "You are a patient, encouraging tutor teaching a student about {current_topic}. " +
    "Use the Socratic method: ask guiding questions that help the student reason toward the answer themselves, " +
    "rather than giving direct answers immediately. Only explain directly if the student is clearly stuck after 2-3 guiding attempts " +
    "(when they explicitly say they don't know, ask for the answer directly, or repeat their confusion). " +
    "Keep responses concise and conversational. " +
    "\n\n" +
    "CRITICAL: If the student reveals a misconception or confusion about a specific concept, silently note it " +
    "by appending a tag of the exact format '[GAP: brief description of the gap]' to the very end of your response. " +
    "For example, if they think in-order traversal visits the root first, append '[GAP: mixed up in-order traversal node order (visited root first)]'. " +
    "This tag will be parsed and hidden from the student. Do not mention the gap to the student directly, just ask a Socratic guiding question.";

  const ASSESSMENT_EVALUATION_TEMPLATE =
    "You are evaluating a student's open-ended answer about {current_topic}, stage: {stage_name}.\n" +
    "The question was: {question}\n" +
    "The student's answer was: {student_answer}\n\n" +
    "Assess whether their understanding is solid, partial, or has a misconception.\n" +
    "You MUST respond ONLY with a single valid JSON object in the following format (no preamble, no markdown backticks outside JSON):\n" +
    "{\n" +
    '  "rating": "solid", // MUST be strictly one of: "solid", "partial", or "misconception"\n' +
    '  "assessment": "1) brief assessment of their understanding",\n' +
    "}\n\n" +
    "Keep the tone supportive, never harsh. If a misconception is present, set rating to 'misconception' and supply a brief description in the 'gap' field.";

  const SUMMARY_PROMPT_TEMPLATE =
    "You are creating a comprehensive, in-depth personalized learning summary for a student who has completed a deep-dive on {topic}. " +
    "Here is what they demonstrated understanding of across 4 stages:\n{assessment_summaries}\n\n" +
    "Here are concepts they struggled with along the way: {flagged_gaps}.\n\n" +
    "Write an EXTENSIVE, thorough summary — this should be a substantial piece of writing, similar in depth to a textbook chapter review, NOT a brief overview. " +
    "Structure your response using exactly these four section headings (with ## prefix):\n" +
    "## Core Concept\n" +
    "## What You Understood Well\n" +
    "## Areas to Reinforce\n" +
    "## Putting It All Together\n\n" +
    "For EACH of the 4 sections, write AT LEAST 6-8 full paragraphs (not bullet points, not short summaries — genuine flowing paragraphs with real depth).\n\n" +
    "Section-specific instructions:\n" +
    "1. Core Concept — explain the topic from first principles in full detail, as if teaching someone encountering it for the first time. Include the underlying theory, why it works the way it does, and multiple concrete examples. Cover every major sub-concept thoroughly.\n" +
    "2. What You Understood Well — go deep into each concept the student showed strength in. Don't just praise it — actually re-explain it with additional nuance, edge cases, and related concepts they might not have considered yet. Make this genuinely educational, not a pat on the back.\n" +
    "3. Areas to Reinforce — for each flagged gap, provide a full re-teaching of that concept: what it is, why it is commonly confused, a worked step-by-step example, and how to think about it correctly going forward. Treat this as a genuine mini-lesson, not a quick correction. If no gaps were flagged, still write 6-8 paragraphs reinforcing the trickiest aspects of the topic that commonly trip people up.\n" +
    "4. Putting It All Together — write an extensive synthesis connecting every stage's content into one unified mental model, including real-world applications, how this topic connects to broader computer science concepts, and what a student should explore next.\n\n" +
    "Do not compress or summarize excessively — favor thoroughness and depth over brevity in every section. " +
    "This is meant to be a genuinely comprehensive learning resource the student will want to read closely, not a quick recap. " +
    "Tone: encouraging, direct, intellectually serious.";

  window.TutorChatService = {

    getApiKey() {
      return GEMINI_API_KEY;
    },

    saveApiKey(key) {
      // Key is embedded directly; manual storage no longer needed
    },

    getQuestionForStage(stageId) {
      return STAGE_QUESTIONS[stageId] || STAGE_QUESTIONS[0];
    },

    /**
     * Evaluates a student stage assessment answer.
     */
    async evaluateAssessment(stageId, question, studentAnswer) {
      try {
        return await this.callGeminiAssessmentAPI(stageId, question, studentAnswer, GEMINI_API_KEY);
      } catch (err) {
        console.warn("[tutor-chat] Gemini Assessment API failed, falling back to mock evaluator:", err);
        return this.getMockAssessmentResponse(stageId, studentAnswer);
      }
    },

    async callGeminiAssessmentAPI(stageId, question, studentAnswer, apiKey) {
      const topic = TOPIC_NAMES[stageId] || "Trees and BSTs";
      const stageName = STAGE_NAMES[stageId] || "Stage";
      const promptText = ASSESSMENT_EVALUATION_TEMPLATE
        .replace("{current_topic}", topic)
        .replace("{stage_name}", stageName)
        .replace("{question}", question)
        .replace("{student_answer}", studentAnswer);

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{ text: promptText }]
          }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
            maxOutputTokens: 600
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini Assessment API Error (${response.status}): ${errText}`);
      }

      const data = await response.json();
      if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
        const text = data.candidates[0].content.parts[0].text;
        return this.parseAssessmentResponse(text);
      } else {
        throw new Error("Invalid response payload from Gemini Assessment API");
      }
    },

    parseAssessmentResponse(rawText) {
      // 1. Try parsing JSON structure first
      let json = null;
      try {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          json = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.warn("[tutor-chat] Failed to parse JSON response, falling back to heuristic parsing:", e);
      }

      if (json && typeof json === 'object') {
        const validRatings = ['solid', 'partial', 'misconception'];
        let rating = validRatings.includes(String(json.rating).toLowerCase())
          ? String(json.rating).toLowerCase()
          : 'solid';

        return {
          rating,
          assessment: json.assessment || rawText,
          missing: json.missing || "No major errors or missing concepts identified.",
          suggestion: json.suggestion || "Keep building on these core principles in the next stages!",
          fullText: `${json.assessment || ''}\n${json.missing || ''}\n${json.suggestion || ''}`,
          gap: json.gap || null
        };
      }

      // 2. Fallback heuristic parsing for plain text LLM responses
      const gapRegex = /\[GAP:\s*([^\]]+)\]/i;
      const gapMatch = rawText.match(gapRegex);
      let gap = gapMatch ? gapMatch[1].trim() : null;
      let cleanText = rawText.replace(gapRegex, '').trim();

      // Extract 3 sections if structured 1), 2), 3)
      let assessment = cleanText;
      let missing = "No major errors or missing concepts identified.";
      let suggestion = "Keep building on these core principles in the next stages!";

      const p1 = cleanText.search(/1[\)\.]/i);
      const p2 = cleanText.search(/2[\)\.]/i);
      const p3 = cleanText.search(/3[\)\.]/i);

      if (p1 !== -1 && p2 !== -1 && p3 !== -1 && p1 < p2 && p2 < p3) {
        assessment = cleanText.slice(p1, p2).replace(/^1[\)\.]\s*/i, '').trim();
        missing    = cleanText.slice(p2, p3).replace(/^2[\)\.]\s*/i, '').trim();
        suggestion = cleanText.slice(p3).replace(/^3[\)\.]\s*/i, '').trim();
      }

      // Robust rating determination without naive substring matching on 'incorrect'
      let rating = 'solid';
      const lowerAssessment = assessment.toLowerCase();
      const lowerMissing = missing.toLowerCase();

      if (gap || lowerAssessment.includes('misconception') || lowerMissing.includes('misconception')) {
        rating = 'misconception';
      } else if (lowerAssessment.includes('solid') || lowerMissing.includes('nothing missing') || lowerMissing.includes('no major') || lowerMissing.includes('none')) {
        rating = 'solid';
      } else if (lowerAssessment.includes('partial') || lowerMissing.includes('could expand') || lowerMissing.includes('missing')) {
        rating = 'partial';
      }

      return {
        rating,
        assessment,
        missing,
        suggestion,
        fullText: cleanText,
        gap
      };
    },

    getMockAssessmentResponse(stageId, studentAnswer) {
      const ansLower = studentAnswer.toLowerCase();
      let rating = 'solid';
      let gap = null;
      let assessment = "";
      let missing = "";
      let suggestion = "";

      if (ansLower.length < 15) {
        rating = 'partial';
        assessment = "Your answer provides a very brief response touching on the core concept.";
        missing = "A complete explanation requires elaborating on how the algorithm or tree structure enforces the invariant step-by-step.";
        suggestion = "Try adding 2-3 sentences explaining what happens at each node comparison or traversal step.";
      } else if (ansLower.includes('root first') || ansLower.includes('first root') || ansLower.includes('random order')) {
        rating = 'misconception';
        gap = `Misconception in stage ${stageId}: confused traversal order or BST invariant`;
        assessment = "You have identified key terms, but there is a slight misconception regarding node ordering.";
        missing = "In-order traversal visits the left subtree first, then the root node, and finally the right subtree. Visiting the root first corresponds to pre-order traversal.";
        suggestion = "Remember the mnemonic: IN-order processes the root IN-between the left and right subtrees.";
      } else {
        rating = 'solid';
        assessment = `Great work! Your answer demonstrates a strong grasp of ${STAGE_NAMES[stageId] || 'this stage'} concepts.`;
        missing = "No critical missing points found in your explanation.";
        suggestion = "Continue applying this mental model to reason through edge cases and higher-level tree variants.";
      }

      return {
        rating,
        assessment,
        missing,
        suggestion,
        fullText: `${assessment}\n${missing}\n${suggestion}`,
        gap
      };
    },

    /**
     * Ask a question to the Socratic Tutor.
     * @param {number} stageId
     * @param {Array<{sender: string, text: string}>} messageHistory
     * @returns {Promise<{text: string, gap: string|null}>}
     */
    async askQuestion(stageId, messageHistory) {
      try {
        return await this.callGeminiAPI(stageId, messageHistory, GEMINI_API_KEY);
      } catch (err) {
        console.warn("[tutor-chat] Gemini API failed, falling back to mock:", err);
        return this.getMockResponse(stageId, messageHistory);
      }
    },

    /**
     * Makes a request to the Gemini API.
     */
    async callGeminiAPI(stageId, messageHistory, apiKey) {
      const topic = TOPIC_NAMES[stageId] || "Trees and BSTs";
      const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace("{current_topic}", topic);

      // Convert message history to Gemini format (user vs model)
      const contents = messageHistory.map(msg => ({
        role: msg.sender === 'student' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }));

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: contents,
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 800
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API Error (${response.status}): ${errText}`);
      }

      const data = await response.json();
      if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
        const text = data.candidates[0].content.parts[0].text;
        return this.parseResponse(text);
      } else {
        throw new Error("Invalid response payload from Gemini API");
      }
    },

    /**
     * Extracts gap tag from response and cleans the text.
     */
    parseResponse(text) {
      const regex = /\[GAP:\s*([^\]]+)\]/i;
      const match = text.match(regex);
      let gap = null;
      let cleanText = text;

      if (match) {
        gap = match[1].trim();
        cleanText = text.replace(regex, '').trim();
      }

      return { text: cleanText, gap };
    },

    /**
     * Generates a personalized learning synthesis summary for the student.
     */
    async generateSynthesisSummary(assessmentSummaries, flaggedGaps, topic) {
      try {
        return await this.callGeminiSummaryAPI(assessmentSummaries, flaggedGaps, topic, GEMINI_API_KEY);
      } catch (err) {
        console.warn("[tutor-chat] Gemini Summary API failed, falling back to mock synthesis:", err);
        return this.getMockSummaryResponse(assessmentSummaries, flaggedGaps, topic);
      }
    },

    async callGeminiSummaryAPI(assessmentSummaries, flaggedGaps, topic, apiKey) {
      const promptText = SUMMARY_PROMPT_TEMPLATE
        .replace("{topic}", topic || "Trees and Binary Search Trees")
        .replace("{assessment_summaries}", assessmentSummaries || "Completed all 4 stages of Trees & BSTs.")
        .replace("{flagged_gaps}", flaggedGaps || "None logged during deep-dive.");

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{ text: promptText }]
          }],
          generationConfig: {
            temperature: 0.7,
            // Gemini Flash Lite supports up to 8192 output tokens — use the ceiling
            // to eliminate MAX_TOKENS truncation as the bottleneck for long summaries.
            maxOutputTokens: 8192
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini Summary API Error (${response.status}): ${errText}`);
      }

      const data = await response.json();
      if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
        // Warn explicitly if the model ran out of tokens — helps diagnose truncation.
        const finishReason = data.candidates[0].finishReason;
        if (finishReason === 'MAX_TOKENS') {
          console.warn('[tutor-chat] Summary hit MAX_TOKENS limit — output was truncated. Consider raising maxOutputTokens further or splitting the prompt.');
        }
        return data.candidates[0].content.parts[0].text;
      } else {
        throw new Error("Invalid response payload from Gemini Summary API");
      }
    },

    getMockSummaryResponse(assessmentSummaries, flaggedGaps, topic) {
      const gapsList = (flaggedGaps && flaggedGaps !== "None logged") ? flaggedGaps : null;
      
      return `## Core Concept

A Binary Search Tree (BST) is one of the most foundational data structures in computer science, combining the organisational clarity of a hierarchical tree with the powerful search properties of a sorted array. At its core, a BST is a binary tree — meaning every node has at most two children, conventionally called the left child and the right child — augmented by a single, elegant invariant that transforms an ordinary tree into a searchable structure. That invariant states: for every node in the tree, all values in its left subtree must be strictly less than the node's own value, and all values in its right subtree must be strictly greater. This rule applies not just at the root, but recursively at every single node in the structure.

Understanding why this invariant is so powerful requires thinking about what happens during a search. Suppose you are looking for the value 42 in a BST. You start at the root. If the root holds 60, you know immediately — without inspecting any of the right subtree's nodes — that 42 must be somewhere in the left subtree, because the invariant guarantees everything on the right is larger than 60. You recurse into the left child and repeat the comparison. At each step, roughly half the remaining nodes are eliminated from consideration. This is the same principle behind binary search on a sorted array, but here the sorted structure is maintained dynamically through pointer relationships rather than physical contiguous memory positions.

The fundamental operations on a BST — search, insertion, and deletion — all follow this same left-right decision process. Searching terminates either when the target value is found or when a null child pointer is reached, signalling the value is absent. Insertion follows the same path a search would take for the new value, then attaches the new node at the first null pointer encountered. This means the shape of a BST is entirely determined by the order in which values were inserted — a property with profound implications for performance.

Deletion is the most nuanced of the three operations because it must preserve the BST invariant after removing a node. There are three distinct cases. If the node to be deleted is a leaf (has no children), it can simply be detached from its parent. If it has exactly one child, the parent's pointer is redirected to bypass the deleted node and point directly to its single child. The third case — deleting a node with two children — requires more thought: you cannot simply remove the node without violating the invariant, because you would leave a gap in the tree's sorted ordering. The standard solution is to replace the deleted node's value with either its in-order successor (the smallest value in its right subtree) or its in-order predecessor (the largest value in its left subtree), then delete that successor or predecessor from its original position, which is guaranteed to fall into case one or two.

The time complexity of these operations depends critically on the height of the tree. In a perfectly balanced BST with n nodes, every level is as full as possible, and the height is approximately log₂(n). This means every search, insertion, or deletion requires at most O(log n) comparisons — a logarithmic relationship that remains fast even for very large datasets. However, this ideal case is not guaranteed by the basic BST definition. If values are inserted in sorted order (for example, 1, 2, 3, 4, 5…), each new node becomes the right child of the previous one, producing a degenerate tree that is effectively a linked list. In this pathological case, the height equals n, and operations degrade to O(n) — no better than linear search.

This vulnerability to insertion-order degeneracy is what motivates the study of self-balancing BSTs, such as AVL trees and Red-Black trees. These variants maintain an additional structural invariant — a balance condition — and automatically perform rotations when insertions or deletions would violate it. AVL trees, for instance, require that for every node, the heights of its left and right subtrees differ by at most one. Red-Black trees use a colouring scheme (each node is coloured red or black) combined with rules about how colours must alternate, which collectively guarantee the tree's height remains O(log n) in the worst case regardless of insertion order. The price paid is slightly more complex insertion and deletion logic, but the reward is guaranteed logarithmic performance.

Beyond these foundational self-balancing variants, the BST concept generalises into higher-order data structures that power much of modern computing infrastructure. B-Trees and B+-Trees extend the BST idea to allow each node to hold multiple values and have multiple children, dramatically reducing the number of disk reads required to traverse large indices — a property exploited by every major relational database engine and filesystem. Segment trees and interval trees adapt the BST framework to answer range queries efficiently. Tries apply a related ordered-key structure to string data. Understanding the BST deeply is therefore not just understanding one data structure — it is acquiring the mental model that underlies dozens of specialised structures you will encounter throughout your career.

## What You Understood Well

Your assessment responses across all four stages reveal a student who has genuinely internalised the BST invariant rather than merely memorising a definition. This is a meaningful distinction. Many students can recite that 'left is smaller, right is larger' without truly grasping why this rule creates a searchable structure, or why it must hold recursively at every node rather than just at the root. Your explanations showed that you understand the invariant as a recursive contract — something that applies not just at the top level but at every internal node throughout the entire tree — and this recursive framing is exactly the intuition required to reason correctly about operations, proofs, and edge cases.

Your understanding of in-order traversal is particularly strong and worth reflecting on in more depth. In-order traversal visits nodes in the sequence: left subtree, then the current node, then right subtree. When applied to a BST, this sequence visits every node exactly once in ascending sorted order — a consequence that follows directly and inevitably from the BST invariant. You demonstrated understanding of not just the mechanical procedure (go left, process, go right), but the reason it produces sorted output: at every recursive call, the left subtree is guaranteed to contain only values smaller than the current node, and the right subtree only larger values, so processing them in that order yields a sorted sequence. This insight connects the operational procedure to the structural invariant in a way that makes the result feel inevitable rather than arbitrary.

Your reasoning about tree height and its impact on operation runtime also showed real conceptual depth. You correctly identified that the runtime of BST operations is proportional to the height of the tree, not the number of nodes, and that height and node count are only tightly linked in balanced trees. Recognising that a BST can degrade to O(n) behaviour — and understanding *why* this happens structurally, because sequential insertions create a linear chain — demonstrates that you are thinking about data structures dynamically, as objects whose shape changes with usage, rather than statically, as fixed structures. This dynamic perspective is essential for reasoning about real-world performance.

Your engagement with the research paper material in Stage 4 showed an ability to abstract upward from concrete BST mechanics to broader algorithmic principles. Understanding that the self-balancing guarantee is achieved through rotation operations — local restructurings of the tree that preserve the BST invariant while restoring the balance condition — without getting lost in the details of specific rotation types is exactly the right level of abstraction for a first deep-dive. You correctly identified the key insight: that rotations do not change the in-order traversal sequence of a tree (and therefore preserve its BST property), they only change the shape of the tree and hence its height.

## Areas to Reinforce

${gapsList ? `During your deep-dive, the following concept was flagged for additional attention: **${gapsList}**. Let us re-teach this from the ground up.` : `Even without flagged gaps, there are aspects of Trees and BSTs that commonly trip up students even after a thorough deep-dive. This section re-teaches the trickiest concepts as mini-lessons.`}

The deletion of a node with two children is the most commonly misunderstood BST operation, and it is worth revisiting carefully. Imagine a BST containing the values [50, 30, 70, 20, 40, 60, 80] and you need to delete the root node (50). You cannot simply promote one child to the root position without checking whether this would violate the invariant. If you promote 30, then 60 (which is in 50's right subtree) would now be in the right subtree of 30, but 60 > 50 > 30, so it belongs in the right subtree — which still works. But 70 (also in the right subtree) and 80 would now be orphaned. The cleaner, general solution is to find 50's in-order successor — the smallest value in its right subtree, which is 60 in this case. Replace 50's value with 60, then delete the original 60 node from its position in the right subtree. Since 60 had no left child (it was the minimum of the right subtree by construction), this secondary deletion is guaranteed to be case one (leaf) or case two (one child), never the problematic case three.

Tree balance is another concept that rewards deeper examination. Balance is not a binary property — trees exist on a spectrum from perfectly balanced (height = log₂n) to maximally degenerate (height = n). The AVL balance condition (height difference between left and right subtrees ≤ 1 at every node) is stricter than the Red-Black condition (which only guarantees the black height is uniform and no two consecutive red nodes), which means AVL trees are typically more rigidly balanced and offer faster lookups, while Red-Black trees tolerate slightly more imbalance in exchange for fewer rotations on insertion and deletion. Neither is universally better — the right choice depends on the read/write ratio of your application.

The concept of amortised complexity is worth introducing here because it contextualises self-balancing tree performance correctly. When you insert into an AVL tree and trigger a rotation, that rotation costs extra work beyond what a simple BST insertion would require. But because rotations are infrequent — most insertions do not require any rotation at all, and those that do typically require only one or two — the amortised cost per insertion remains O(log n). Amortised analysis distributes occasional expensive operations across the many cheap operations that precede and follow them, giving a more realistic picture of performance over a long sequence of operations than worst-case analysis alone.

## Putting It All Together

Your journey through all four stages of this deep-dive — from first principles in the Foundations stage, through the lecture material and textbook chapters, to the research papers — traces the full arc of how a concept matures from a simple definition into a rich, multi-dimensional tool. The BST invariant you first encountered as an abstract rule (left smaller, right larger) has by now revealed itself to be the seed of an entire family of data structures, algorithms, and engineering principles. Understanding this arc — how a single elegant constraint generates logarithmic search, motivates self-balancing extensions, and ultimately underpins database indices and filesystem design — is the hallmark of genuine conceptual mastery rather than surface-level familiarity.

The mental model you should carry forward is hierarchical decomposition guided by a sorted invariant. Whenever you encounter a problem that involves maintaining a dynamic collection of ordered elements while supporting efficient insertions, deletions, and lookups, the BST family should immediately come to mind as a candidate solution. The key question to ask is: what is the expected balance of the tree given my insertion patterns? If you control the insertion order, you can pre-sort data and build a perfectly balanced BST in O(n) time. If insertion order is unpredictable (as it typically is in real applications), you need a self-balancing variant to avoid worst-case degeneracy.

Connecting the four stages cohesively: the Foundations stage gave you the invariant and the three core operations. The Lecture stage contextualised these operations within the broader framework of algorithm analysis, showing why height is the correct measure of complexity and introducing the idea that the same asymptotic class (O(log n)) can hide meaningful constant-factor differences between implementations. The Books stage deepened your understanding of deletion and balancing, providing the worked examples and formal proofs that transform intuition into rigorous knowledge. The Research stage showed you that BSTs are not a closed chapter in computer science — active research continues to explore novel self-balancing schemes, cache-efficient tree layouts, and generalisations to multi-dimensional data.

In terms of real-world applications, the BST family appears wherever ordered dynamic data must be maintained efficiently. The sorted sets and sorted maps in standard library implementations across Java (TreeMap, TreeSet), C++ (std::map, std::set), and Python (sortedcontainers) are typically backed by Red-Black trees. Database indices — the structures that allow SQL queries to run in milliseconds rather than performing full table scans — are typically B-Trees or B+-Trees, which extend BST principles to disk-block-sized nodes. The Linux kernel's scheduler uses a Red-Black tree to maintain the list of runnable processes sorted by their virtual runtime. Git's object storage uses a similar tree structure to index commit objects. The BST invariant, in various forms, is truly everywhere in production software.

As a next step in your learning journey, we recommend exploring AVL trees in implementation depth — writing the rotation logic yourself, not just understanding it abstractly. From there, B-Trees provide a natural extension that introduces you to cache-efficiency considerations and the I/O complexity model used in database systems. Segment trees will show you how BST-like structures can be repurposed for range-query problems that go far beyond simple key lookups. Each of these extensions will deepen your understanding of the foundational invariant you have mastered in this deep-dive, revealing new facets of its power and generality.`;
    },

    /**
     * Rich local fallback Socratic simulation engine.
     */
    getMockResponse(stageId, messageHistory) {
      const studentMessages = messageHistory.filter(m => msgIsFromStudent(m));
      const turnCount = studentMessages.length;
      const lastMsgText = studentMessages[studentMessages.length - 1]?.text || '';
      const query = lastMsgText.toLowerCase().trim();

      let text = '';
      let gap = null;

      // Helper to check if message contains keywords
      const contains = (words) => words.every(w => query.includes(w)) || (words.length === 1 && query.includes(words[0]));
      const containsAny = (words) => words.some(w => query.includes(w));

      if (stageId === 0) {
        // Stage 1 Foundations
        if (containsAny(["in-order", "inorder"])) {
          if (containsAny(["root first", "starts at root", "visits root first"])) {
            gap = "confused in-order traversal node order (thought it starts/visits root first)";
            text = "Interesting perspective! If in-order traversal visited the root first, would we print the left subtree (which contains smaller elements) before the root? What would that do to our sorted order?";
          } else if (containsAny(["sorted", "sort"])) {
            text = "Exactly, in-order traversal yields elements in sorted order! Do you remember the order in which we visit the left child, root, and right child to make that happen?";
          } else {
            if (turnCount >= 3) {
              text = "You've got it! In-order traversal visits the left subtree, then the root node itself, and finally the right subtree. This naturally prints a BST's values in sorted order.";
            } else {
              text = "Think about the name: 'in-order'. If we have a BST and we visit nodes 'in-order', what kind of sequence would we want to produce from the values?";
            }
          }
        } else if (containsAny(["pre-order", "preorder"])) {
          if (containsAny(["sorted", "sort"])) {
            gap = "assumed pre-order traversal produces sorted output";
            text = "Let's test that! If we have a tree with root 5, left child 3, and right child 7. In pre-order traversal, we visit the root first. What sequence would that give us, and is it sorted?";
          } else {
            text = "Pre-order traversal is extremely useful for copying trees. If we visit the root *before* (pre) the subtrees, where do we start, and which children do we visit next?";
          }
        } else if (containsAny(["rotation", "rotate"])) {
          if (turnCount >= 3) {
            text = "Great job thinking through it. A BST rotation pivots a node around its child to reduce height while maintaining the BST invariant. For example, a left rotation makes a right child the new parent, and shifts subtrees accordingly.";
          } else if (turnCount === 2) {
            text = "Exactly! We pull the child node up and push the parent down. If we rotate left, which way do the nodes pivot? What happens to the left child of the new parent?";
          } else {
            text = "Rotations are used to keep a tree balanced. Imagine a tree that looks like a straight line of nodes: 5 -> 6 -> 7. If we want to bring the middle element (6) to the top to balance it, how would we move the other nodes?";
          }
        } else if (containsAny(["invariant", "property"])) {
          text = "The BST invariant is the core rule that governs all binary search trees. What relationship must hold between a node's value and the values in its left and right subtrees?";
        } else {
          // Generic Stage 1 Socratic Response
          text = getGenericSocratic(turnCount, "Foundations of Trees & BSTs");
        }

      } else if (stageId === 1) {
        // Stage 2 Lectures
        if (containsAny(["search", "find", "complexity", "o("])) {
          if (containsAny(["always log", "worst case is log", "worst-case is log"])) {
            gap = "confused worst-case unbalanced BST height with average height";
            text = "Let's think about a tree where we insert elements in sorted order: 1, then 2, then 3, then 4. What would this tree look like? Would search still take O(log n) time?";
          } else {
            if (turnCount >= 3) {
              text = "Exactly! Since we only make one comparison per level as we go down the tree, the maximum path we can travel is equal to the height of the tree, denoted as h. Therefore, the search complexity is O(h), which is O(n) in the worst case but O(log n) if balanced.";
            } else if (turnCount === 2) {
              text = "Right! We can only go down one branch (left or right) at each step. So, in the worst case, what is the maximum number of comparisons we would make before finding the node or reaching a leaf?";
            } else {
              text = "Think about the search algorithm. At each node, we compare the target value with the current node. How many directions can we go from there, and how does the length of our path relate to the structure of the tree?";
            }
          }
        } else {
          text = getGenericSocratic(turnCount, "asymptotic analysis and professors' talk details");
        }

      } else if (stageId === 2) {
        // Stage 3 Books
        if (containsAny(["deletion", "delete", "remove"])) {
          if (turnCount >= 3) {
            text = "Correct! We just link its parent directly to its single child in the one-child case. The hardest case is when it has two children: we must replace it with either its in-order predecessor or its in-order successor, and then delete that successor node.";
          } else if (turnCount === 2) {
            text = "Yes, deleting a leaf is simple. Now, what if the node has exactly one child? How can we remove it and bridge the gap between its parent and child?";
          } else {
            text = "BST deletion is indeed the trickiest operation. Let's break it down by cases. If the node we want to delete has no children (a leaf node), what do we have to do?";
          }
        } else if (containsAny(["successor", "predecessor"])) {
          if (containsAny(["always right child", "always the right"])) {
            gap = "assumed in-order successor is always the immediate right child";
            text = "Let's picture this: we want the in-order successor of a node. That's the smallest value in its right subtree. If the right child itself has a left child, which node actually has the smaller value?";
          } else {
            text = "The successor of a node is the next element in sorted order. If a node has a right subtree, how do we find its successor within that subtree?";
          }
        } else {
          text = getGenericSocratic(turnCount, "rigorous textbook implementations and algorithm proofs");
        }

      } else if (stageId === 3) {
        // Stage 4 Research
        if (containsAny(["b-tree", "btree", "database"])) {
          if (turnCount >= 3) {
            text = "Precisely! B-trees allow nodes to have many children (often hundreds) and keys. This keeps the tree extremely flat (low height), meaning we only need 3-4 disk reads even for billions of records, making them ideal for filesystems and databases.";
          } else if (turnCount === 2) {
            text = "Exactly, disks read in blocks! If a BST node is very small, we waste block capacity and perform many disk seeks. How does a B-tree solve this by changing the number of keys per node?";
          } else {
            text = "B-trees are widely used in databases and filesystems. Think about how data is read from disks: is it read byte-by-byte, or in large blocks? How would a binary search tree perform if each node pointer required a separate disk access?";
          }
        } else if (containsAny(["avl", "red-black", "red black"])) {
          if (containsAny(["faster for insert", "faster for insertion", "faster inserts"])) {
            gap = "misunderstood insert performance tradeoff between AVL and Red-Black trees";
            text = "Recall that AVL trees are more strictly balanced than Red-Black trees. If a tree is more strictly balanced, does it require more or fewer rotations during an insertion to maintain that balance? How would that affect insertion speed?";
          } else {
            text = "AVL and Red-Black trees are both self-balancing BSTs. AVL trees are strictly balanced (height diff <= 1), while Red-Black trees are more loosely balanced. What tradeoff does this create between search speed and modification speed?";
          }
        } else {
          text = getGenericSocratic(turnCount, "seminal data structure research papers");
        }
      }

      return { text, gap };
    }
  };

  // Helper function to check message sender
  function msgIsFromStudent(m) {
    return m.sender === 'student';
  }

  // Get fallback generic Socratic response
  function getGenericSocratic(turnCount, context) {
    if (turnCount >= 3) {
      return "It seems we are exploring a tricky concept. Let's look at the stage materials together to find the connection. What specific detail in this section stands out to you the most?";
    }
    const responses = [
      `That's a thoughtful question about ${context}! To help you reason toward the answer, what do you think is the fundamental rule or property that governs this?`,
      `Let's break this down. What parts of this concept do you already feel comfortable with? What is the immediate roadblock?`,
      `Interesting! If you had to explain this concept to someone who has never studied computer science, what analogy or mental model would you start with?`
    ];
    return responses[(turnCount - 1) % responses.length];
  }

})();
