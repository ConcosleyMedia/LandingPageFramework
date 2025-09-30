import { createClient } from "@supabase/supabase-js";

const supa = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const event = await req.json();
  const eventType = event?.type ?? event?.event ?? event?.action;

  if (!eventType) {
    console.warn("Whop webhook missing event type", event);
    return new Response("missing event type", { status: 400 });
  }

  const allowedEvents = new Set(["order.completed", "payment.succeeded"]);
  if (!allowedEvents.has(eventType)) {
    console.log("Whop webhook ignored event", eventType);
    return new Response("ignored");
  }

  const meta = event.data?.metadata ?? event.metadata ?? {};
  const quiz_attempt_id = meta.quiz_attempt_id ?? event.data?.quiz_attempt_id ?? event.quiz_attempt_id;
  const product = meta.product ?? "mini_report";

  if (!quiz_attempt_id) {
    console.error("No quiz_attempt_id found in metadata", event);
    return new Response("missing quiz_attempt_id", { status: 400 });
  }

  const { error } = await supa.from("report_jobs").insert({
    quiz_attempt_id,
    product,
  });

  if (error) {
    console.error("Failed to enqueue report job", error, event);
    return new Response("failed to enqueue", { status: 500 });
  }

  console.log("Report job enqueued", { quiz_attempt_id, product });
  return new Response("enqueued");
}
