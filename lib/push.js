import webpush from "web-push";
import { query } from "@/lib/db";

let configured = false;

function configurePush() {
  if (configured) return;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    throw new Error("VAPID keys are required.");
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  configured = true;
}

export async function sendPush(cid, title, body) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
  configurePush();
  const { rows } = await query("select subscription from push_subscriptions where cid=$1", [cid]);
  await Promise.allSettled(
    rows.map((row) =>
      webpush.sendNotification(
        row.subscription,
        JSON.stringify({
          title,
          body
        })
      )
    )
  );
}
