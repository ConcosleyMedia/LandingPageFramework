import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { chromium } from "playwright";

const supa = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

async function processJob(job: any) {
  console.log(`Processing job ${job.id}`);

  await supa
    .from("report_jobs")
    .update({ status: "processing" })
    .eq("id", job.id);

  try {
    const { data: attempt } = await supa
      .from("quiz_attempts")
      .select("id,answers,archetype,category_id,user_id")
      .eq("id", job.quiz_attempt_id)
      .single();

    const { data: prompt } = await supa
      .from("prompts")
      .select("template")
      .eq("category_id", attempt.category_id)
      .eq("type", job.product)
      .single();

    const filledPrompt = prompt.template
      .replace("{{archetype_name}}", attempt.archetype)
      .replace("{{answers_json}}", JSON.stringify(attempt.answers));

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a neuroscience-savvy report generator." },
        { role: "user", content: filledPrompt },
      ],
    });

    const html = completion.choices[0].message?.content || "<p>Error</p>";

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdf = await page.pdf({ format: "A4" });
    await browser.close();

    const path = `reports/${attempt.id}.pdf`;
    await supa.storage.from("reports").upload(path, pdf, {
      contentType: "application/pdf",
      upsert: true,
    });
    const { data: pub } = supa.storage.from("reports").getPublicUrl(path);

    await supa.from("reports").insert({
      quiz_attempt_id: attempt.id,
      type: job.product,
      html,
      pdf_url: pub?.publicUrl,
    });

    await supa
      .from("report_jobs")
      .update({ status: "done" })
      .eq("id", job.id);

    console.log(`✅ Report ready for ${attempt.id}`);
  } catch (err: any) {
    console.error("❌ Job failed:", err);
    await supa
      .from("report_jobs")
      .update({ status: "error", error: String(err) })
      .eq("id", job.id);
  }
}

async function loop() {
  while (true) {
    const { data: jobs } = await supa
      .from("report_jobs")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1);

    if (jobs && jobs.length > 0) {
      await processJob(jobs[0]);
    } else {
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

loop();
