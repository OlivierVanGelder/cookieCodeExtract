export async function postBatch({ webhookUrl, authHeader, authValue, payload }) {
  if (!webhookUrl) throw new Error("WEBHOOK_URL ontbreekt");

  const headers = {
    "Content-Type": "application/json"
  };

  if (authHeader && authValue) {
    headers[authHeader] = authValue;
  }

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Webhook fout ${res.status}: ${text}`);
  }
}
