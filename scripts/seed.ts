/**
 * scripts/seed.ts
 *
 * Seeds Supabase with:
 * - Categories (brain/behavior)
 * - Question sets
 * - Prompt templates (teaser, mini_report, full_report, image_prompt)
 *
 * Run with: npx ts-node scripts/seed.ts
 */

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supa = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // 1. Insert category
  const { data: cat, error: catErr } = await supa
    .from("categories")
    .upsert(
      {
        slug: "brain",
        name: "Brain Type Test",
        description:
          "Discover how your brain responds under stress and decision-making. Quick free test with upsells to a full report and deep 30-question assessment.",
        pricing_low: 700,
        pricing_high: 2900,
      },
      { onConflict: "slug" }
    )
    .select()
    .single();

  if (catErr) throw catErr;
  console.log("Category seeded:", cat);

  // 2. Insert question set (Brain v1)
  const qset = {
    title: "Brain Type - Quick Test",
    archetypes: [
      { key: "calm_strategist", name: "Calm Strategist" },
      { key: "stress_freezer", name: "Stress Freezer" },
      { key: "reactive_sprinter", name: "Reactive Sprinter" },
      { key: "over_analyzer", name: "Over-Analyzer" },
      { key: "adaptive_operator", name: "Adaptive Operator" },
    ],
    scoring: {
      map: {
        q1: {
          A: "calm_strategist",
          B: "reactive_sprinter",
          C: "over_analyzer",
          D: "stress_freezer",
        },
        q2: {
          A: "adaptive_operator",
          B: "over_analyzer",
          C: "calm_strategist",
          D: "stress_freezer",
        },
        q3: {
          A: "reactive_sprinter",
          B: "calm_strategist",
          C: "adaptive_operator",
          D: "over_analyzer",
        },
        q4: {
          A: "stress_freezer",
          B: "calm_strategist",
          C: "over_analyzer",
          D: "adaptive_operator",
        },
        q5: {
          A: "over_analyzer",
          B: "adaptive_operator",
          C: "reactive_sprinter",
          D: "calm_strategist",
        },
      },
      method: "plurality",
    },
    questions: [
      {
        id: "q1",
        text: "Under pressure, I usually...",
        options: [
          "A) Plan calmly",
          "B) Act fast",
          "C) Analyze every angle",
          "D) Go quiet",
        ],
      },
      {
        id: "q2",
        text: "When tasks pile up...",
        options: [
          "A) I adapt priorities",
          "B) I make a spreadsheet",
          "C) I focus on the highest leverage",
          "D) I stall until clarity",
        ],
      },
      {
        id: "q3",
        text: "In conversations...",
        options: [
          "A) I speak first",
          "B) I steer with questions",
          "C) I mirror their energy",
          "D) I listen and think",
        ],
      },
      {
        id: "q4",
        text: "Before big decisions...",
        options: [
          "A) I freeze briefly",
          "B) I set constraints",
          "C) I collect data",
          "D) I phone a trusted peer",
        ],
      },
      {
        id: "q5",
        text: "My best days feel...",
        options: [
          "A) Organized deep work",
          "B) Adaptive and social",
          "C) Fast, lots of wins",
          "D) Calm, focused, strategic",
        ],
      },
    ],
  };

  const { error: qsErr } = await supa.from("question_sets").upsert({
    category_id: cat.id,
    version: 1,
    json_schema: qset,
  });

  if (qsErr) throw qsErr;
  console.log("Question set seeded");

  // 3. Insert prompt templates
  const prompts = [
    {
      type: "teaser",
      template: `You are producing a 1-paragraph teaser for a user's brain archetype.

Archetype: {{archetype_name}}
Signals (summarized): {{answers_json}}

Write 80-120 words, second-person, 1 concrete behavior pattern, 1 quick win.
End with a curiosity gap: "The full report covers X, Y."`,
    },
    {
      type: "mini_report",
      template: `You are a neuroscience-savvy coach writing a 3-page web report.

Archetype: {{archetype_name}}
User answers: {{answers_json}}

Format in HTML with <h2> section headings and <p> paragraphs.
Sections:
1. What this means
2. Under Stress
3. Strengths to Lean On
4. Friction to Watch
5. 3 Immediate Protocols (bullets)

Target ~900 words. Practical, clear, no medical claims.`,
    },
    {
      type: "full_report",
      template: `You are generating a comprehensive 10-page brain profile.

Archetype: {{archetype_name}}
Answers: {{answers_json}}

Format in HTML with <h2> and <h3> headings.
Sections:
1. Overview
2. Stress Triggers
3. 7 Brain Dimensions
4. Daily Protocols
5. Habit Stacks
6. Relapse Prevention

Target ~3000 words, deeply structured but simple language.`,
    },
    {
      type: "image_prompt",
      template: `Create a concise Midjourney-style prompt for abstract brain-state art inspired by archetype {{archetype_name}}. No text, no logos, just clean minimal visuals.`,
    },
  ];

  for (const p of prompts) {
    const { error: pErr } = await supa.from("prompts").upsert({
      category_id: cat.id,
      type: p.type,
      template: p.template,
    });
    if (pErr) throw pErr;
  }

  console.log("Prompts seeded");
}

main().catch((err) => {
  console.error("Seed failed", err);
  process.exit(1);
});
