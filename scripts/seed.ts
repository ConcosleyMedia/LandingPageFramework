/**
 * scripts/seed.ts
 *
 * Seeds Supabase with:
 * - Category metadata
 * - Question sets (v1)
 * - Prompt templates (teaser, mini_report, full_report, image_prompt)
 *
 * Usage:
 *   npm run seed            # seeds the default "brain" category
 *   npm run seed -- slug    # seeds the specified slug (e.g. astrology)
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import "dotenv/config";

const supa = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DEFAULT_CATEGORY = {
  name: "Brain Type Test",
  description:
    "Discover how your brain responds under stress and decision-making. Quick free test with upsells to a full report and deep 30-question assessment.",
  pricing_low: 700,
  pricing_high: 2900,
};

const DEFAULT_QSET = {
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

const DEFAULT_PROMPTS: Record<string, string> = {
  teaser: `You are producing a 1-paragraph teaser for a user's archetype.

Archetype: {{archetype_name}}
Signals (summarized): {{answers_json}}

Write 80-120 words, second-person, one concrete behavior pattern, one quick win.
End with a curiosity gap: "The full report covers X, Y."`,
  mini_report: `You are a neuroscience-savvy coach writing a 3-page web report.

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
  full_report: `You are generating a comprehensive 10-page profile.

Archetype: {{archetype_name}}
Answers: {{answers_json}}

Format in HTML with <h2> and <h3> headings.
Sections:
1. Overview
2. Stress Triggers
3. 7 Dimensions
4. Daily Protocols
5. Habit Stacks
6. Relapse Prevention

Target ~3000 words, deeply structured but simple language.`,
  image_prompt: `Create a concise Midjourney-style prompt for abstract art inspired by archetype {{archetype_name}}. No text, no logos, clean minimal visuals.`,
};

function toTitleCase(slug: string): string {
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function loadQuestionSet(slug: string) {
  const explicitPath = resolve(process.cwd(), `content/question_sets/${slug}_v1.json`);
  if (existsSync(explicitPath)) {
    return JSON.parse(readFileSync(explicitPath, "utf8"));
  }

  const fallbackPath = resolve(process.cwd(), "content/question_sets/brain_v1.json");
  if (slug !== "brain") {
    console.warn(`Question set '${slug}_v1.json' not found. Using brain_v1.json as fallback.`);
  }
  if (existsSync(fallbackPath)) {
    return JSON.parse(readFileSync(fallbackPath, "utf8"));
  }

  console.warn("Brain question set JSON missing. Using inline defaults.");
  return DEFAULT_QSET;
}

function loadPromptTemplate(slug: string, type: string) {
  const explicitPath = resolve(process.cwd(), `content/prompts/${slug}/${type}.hbs`);
  if (existsSync(explicitPath)) {
    return readFileSync(explicitPath, "utf8");
  }

  const fallbackPath = resolve(process.cwd(), `content/prompts/brain/${type}.hbs`);
  if (slug !== "brain") {
    console.warn(`Prompt template '${type}' for slug '${slug}' not found. Falling back to brain template.`);
  }
  if (existsSync(fallbackPath)) {
    return readFileSync(fallbackPath, "utf8");
  }

  console.warn(`Brain prompt template '${type}' missing. Using inline default text.`);
  return DEFAULT_PROMPTS[type];
}

async function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  const slug = (args[0] || "brain").toLowerCase();
  const label = toTitleCase(slug);

  const categoryPayload = {
    slug,
    name: slug === "brain" ? DEFAULT_CATEGORY.name : `${label} Test`,
    description:
      slug === "brain"
        ? DEFAULT_CATEGORY.description
        : `Discover how your ${label.toLowerCase()} profile responds across key situations. Includes quick insights with upsells into deeper reports.`,
    pricing_low: DEFAULT_CATEGORY.pricing_low,
    pricing_high: DEFAULT_CATEGORY.pricing_high,
  };

  const { data: cat, error: catErr } = await supa
    .from("categories")
    .upsert(categoryPayload, { onConflict: "slug" })
    .select()
    .single();

  if (catErr) throw catErr;
  console.log("Category seeded:", cat);

  const qset = loadQuestionSet(slug);
  const questionSetPayload = {
    category_id: cat.id,
    version: 1,
    json_schema: qset,
  };

  const { error: qsErr } = await supa.from("question_sets").upsert(questionSetPayload);
  if (qsErr) throw qsErr;
  console.log("Question set seeded");

  const promptTypes = ["teaser", "mini_report", "full_report", "image_prompt"];
  for (const type of promptTypes) {
    const template = loadPromptTemplate(slug, type);
    const { error: pErr } = await supa.from("prompts").upsert({
      category_id: cat.id,
      type,
      template,
    });
    if (pErr) throw pErr;
  }
  console.log("Prompts seeded");
}

main().catch((err) => {
  console.error("Seed failed", err);
  process.exit(1);
});
