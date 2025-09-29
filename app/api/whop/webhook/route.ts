import { createClient } from "@supabase/supabase-js";

const supa = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const event = await req.json();

  if (event.type !== "order.completed") {
    return new Response("ignored");
  }

  const meta = event.data?.metadata || {};
  const quiz_attempt_id = meta.quiz_attempt_id;
  const product = meta.product || "mini_report";

  if (!quiz_attempt_id) {
    console.error("No quiz_attempt_id found in metadata", event);
    return new Response("missing quiz_attempt_id", { status: 400 });
  }

  await supa.from("report_jobs").insert({
    quiz_attempt_id,
    product,
  });

  return new Response("enqueued");
}
