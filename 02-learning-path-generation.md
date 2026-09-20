# Part 2 — Personalized Learning Path Generation

## Overview
The agent generates a learning path as a sequenced set of stages, where progression is gated by demonstrated understanding rather than passive completion. This document describes the actual logic implemented in the platform (not a theoretical model).

## The Path Structure
For a given topic (currently: Trees & BSTs), the path is a fixed sequence of 4 content stages, followed by a synthesis stage:

```
Stage 1: Foundations → Stage 2: Lectures → Stage 3: Books → Stage 4: Research → Summary → Animations
```

Each stage has two independent status signals:
- **Completed** — student manually marks they've engaged with the content (a self-reported checkbox)
- **Mastered** — student has passed an AI-graded open-ended assessment demonstrating real understanding

This two-signal design exists because "I read it" and "I understand it" are different claims, and sir's brief specifically asks how the agent decides when a student has achieved mastery — Completed alone can't answer that; Mastered can.

## Algorithm: Stage Progression

```
FOR each stage in sequence:
    IF stage is first stage:
        unlock stage
    ELSE:
        IF previous stage is Mastered:
            unlock current stage
        ELSE:
            keep current stage locked

    Student engages with stage content (theory/lectures/books/research)
    Student may open Socratic AI Tutor chat for that stage → guided Q&A, 
        no direct answers given, misconceptions logged as gaps

    Student manually ticks "Completed" when done engaging

    Student submits open-ended answer to stage's assessment question
    → sent to Gemini API with grading prompt
    → returns: understanding rating (Solid/Partial/Needs Review) + feedback

    IF rating is Solid or Partial:
        mark stage as Mastered
    IF rating is Needs Review (misconception detected):
        log flagged gap
        show corrective feedback
        allow student to retry the assessment

WHEN all 4 stages are Mastered:
    unlock Summary stage
```

## How difficulty adapts
Difficulty adaptation happens at the **assessment feedback level**, not by changing question difficulty dynamically (the 4 core questions are fixed per stage, by design — this keeps the assessment consistent and comparable across students). Instead:
- If a student's answer reveals a misconception, the AI tutor's follow-up guidance (via chat) can be revisited before re-attempting the assessment
- Flagged gaps accumulate per student, so if the same type of misconception recurs across stages (e.g. confusing traversal orders), that's a visible pattern the agent — and eventually the final summary — can address directly

## How resources are recommended
Currently, resource recommendation is **curated, not dynamically generated** — each stage has a fixed set of top lectures, books, and research links selected in advance by the team. The brief asks how the agent "recommends resources"; the honest answer for this scope is: curation is done by the team upfront, and the agent's personalization layer sits on top of that fixed content (via chat guidance and assessment feedback), rather than the agent selecting different resources per student. This is a reasonable and explainable scope limitation for a 2-week project — full dynamic resource recommendation would require a much larger content library and recommendation engine.

## How mastery is decided
Mastery is decided by AI evaluation of a free-text, open-ended answer — not multiple choice, not simple keyword matching. The Gemini API is prompted to assess understanding as Solid / Partial / Needs Review based on conceptual accuracy, and this assessment is what flips the Mastered flag. This directly answers sir's question about deciding "when a student has achieved mastery of a topic."

## Known scope limitation (be upfront about this if asked)
This is a single-topic, single-difficulty-level path. It does not yet dynamically reorder stages, skip stages for advanced students, or generate resources on the fly. The architecture (from Part 1) is built to be topic-swappable, but full adaptive-difficulty path generation is a larger system than what's buildable in this timeframe — worth stating clearly in the report rather than overclaiming.
