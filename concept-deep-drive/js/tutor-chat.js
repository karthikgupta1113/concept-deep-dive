/**
 * tutor-chat.js — Socratic AI Tutor Chat Service
 * Handles Socratic prompt preparation, Gemini API requests, response parsing, and Socratic mock fallback.
 */

(function initTutorChatService() {

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
    "You are creating a personalized learning summary for a student who has completed a deep-dive on {topic}. " +
    "Here is what they demonstrated understanding of across 4 stages:\n{assessment_summaries}\n\n" +
    "Here are concepts they struggled with along the way: {flagged_gaps}.\n\n" +
    "Write a DETAILED, in-depth integrated summary — aim for substantial depth in each section, not brief bullet points. " +
    "Structure your response using exactly these four section headings (with ## prefix):\n" +
    "## Core Concept\n" +
    "## What You Understood Well\n" +
    "## Areas to Reinforce\n" +
    "## Putting It All Together\n\n" +
    "For each of the 4 sections, write at least 3-4 full paragraphs of clear, well-explained content. " +
    "Use concrete examples where helpful. " +
    "In 'What You Understood Well', reinforce the concepts they demonstrated mastery of with extra depth and nuance — go beyond just saying they understood it, explain *why* those concepts matter and how they connect. " +
    "In 'Areas to Reinforce', give thorough, clarifying explanations for every concept they struggled with — don't just restate the gap, actually re-teach it clearly with a concrete example or analogy. " +
    "In 'Putting It All Together', weave everything into one coherent, richly explained mental model that connects theory, lectures, books, and research papers. " +
    "Tone: encouraging, direct, and thorough. " +
    "This should feel like a genuinely valuable, comprehensive learning resource — not a short recap.";

  window.TutorChatService = {

    getApiKey() {
      return localStorage.getItem('cdd_gemini_api_key') || '';
    },

    saveApiKey(key) {
      if (key) {
        localStorage.setItem('cdd_gemini_api_key', key.trim());
      } else {
        localStorage.removeItem('cdd_gemini_api_key');
      }
    },

    getQuestionForStage(stageId) {
      return STAGE_QUESTIONS[stageId] || STAGE_QUESTIONS[0];
    },

    /**
     * Evaluates a student stage assessment answer.
     */
    async evaluateAssessment(stageId, question, studentAnswer) {
      const apiKey = this.getApiKey();
      if (apiKey) {
        try {
          return await this.callGeminiAssessmentAPI(stageId, question, studentAnswer, apiKey);
        } catch (err) {
          console.warn("[tutor-chat] Gemini Assessment API failed, falling back to mock evaluator:", err);
          return this.getMockAssessmentResponse(stageId, studentAnswer);
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, 600 + Math.random() * 600));
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
      const apiKey = this.getApiKey();
      if (apiKey) {
        try {
          return await this.callGeminiAPI(stageId, messageHistory, apiKey);
        } catch (err) {
          console.warn("[tutor-chat] Gemini API failed, falling back to mock:", err);
          return this.getMockResponse(stageId, messageHistory);
        }
      } else {
        // Yield to browser event loop briefly to simulate network lag
        await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 800));
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
      const apiKey = this.getApiKey();
      if (apiKey) {
        try {
          return await this.callGeminiSummaryAPI(assessmentSummaries, flaggedGaps, topic, apiKey);
        } catch (err) {
          console.warn("[tutor-chat] Gemini Summary API failed, falling back to mock synthesis:", err);
          return this.getMockSummaryResponse(assessmentSummaries, flaggedGaps, topic);
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 800));
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
            temperature: 0.5,
            maxOutputTokens: 3000
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini Summary API Error (${response.status}): ${errText}`);
      }

      const data = await response.json();
      if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
        return data.candidates[0].content.parts[0].text;
      } else {
        throw new Error("Invalid response payload from Gemini Summary API");
      }
    },

    getMockSummaryResponse(assessmentSummaries, flaggedGaps, topic) {
      const gapsList = (flaggedGaps && flaggedGaps !== "None logged") ? flaggedGaps : null;
      
      return `## Core Concept
Binary Search Trees (BSTs) provide logarithmic-time O(log n) searching, insertion, and deletion by enforcing a strict invariant: every node's left child holds a strictly smaller value, and every right child holds a strictly larger value.

## What You Understood Well
- **Foundations & Tree Mechanics**: Demonstrated clear understanding of tree hierarchy, root and child nodes, and depth-first traversal principles across Stage 1.
- **In-Order Traversal & Sorting**: Solid grasp of how in-order traversal (left → root → right) extracts elements in strictly ascending order.
- **Textbook & Paper Mechanics**: Successfully reasoned through BST operations, deletion edge cases, and self-balancing BST tree variants.

## Areas to Reinforce
${gapsList ? `- **Targeted Concept Clarity**: Specifically regarding *"${gapsList}"*, keep in mind that tree balance governs worst-case performance. If a tree degrades into a linear chain (height h = n), searching becomes O(n). Self-balancing trees (AVL rotations, Red-Black color flips) ensure height stays bounded at O(log n).` : `- **Tree Balancing & Deletion**: The primary operational nuance to reinforce is deleting a two-child node by substituting its in-order successor (the minimum node in its right subtree), preserving the BST property.`}

## Putting It All Together
1. **Hierarchical Search Space**: Trees halve the active search area at each node comparison when balanced, operating as dynamic sorted arrays with dynamic pointer manipulation.
2. **Guaranteed Bounded Height**: Self-balancing trees ensure runtime stability, avoiding pathological degenerate linear structures.
3. **Foundation for Storage Engines**: Multi-way search trees (B-Trees and B+ Trees) generalize these BST invariants to disk blocks, powering modern filesystems and relational databases.`;
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
