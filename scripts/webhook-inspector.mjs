import { createServer } from "node:http";

const port = Number(process.env.WEBHOOK_INSPECTOR_PORT || "8787");
const maxEvents = 200;
const events = [];

function renderHtml() {
  const items = events
    .map(
      (event) => `
        <article>
          <h2>${escapeHtml(event.method)} ${escapeHtml(event.path)}</h2>
          <p><strong>Received:</strong> ${escapeHtml(event.receivedAt)}</p>
          <pre>${escapeHtml(JSON.stringify(event, null, 2))}</pre>
        </article>
      `,
    )
    .join("\n");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Webhook Inspector</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 32px; background: #f8fafc; color: #0f172a; }
      h1 { margin-top: 0; }
      article { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; margin-top: 16px; }
      pre { overflow: auto; background: #0f172a; color: #e2e8f0; padding: 16px; border-radius: 12px; }
      code { font-family: Consolas, monospace; }
    </style>
  </head>
  <body>
    <h1>Webhook Inspector</h1>
    <p>POST webhook traffic to <code>http://localhost:${port}/capture</code>. View JSON at <code>/events</code>.</p>
    ${items || "<article><p>No webhook events captured yet.</p></article>"}
  </body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function writeJson(res, statusCode, body) {
  res.writeHead(statusCode, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = createServer((req, res) => {
  if (!req.url) {
    writeJson(res, 400, { error: "Missing request URL" });
    return;
  }

  const url = new URL(req.url, `http://localhost:${port}`);

  if (req.method === "GET" && url.pathname === "/events") {
    writeJson(res, 200, { count: events.length, events });
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    writeJson(res, 200, { ok: true, count: events.length });
    return;
  }

  if (req.method === "GET") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(renderHtml());
    return;
  }

  const chunks = [];

  req.on("data", (chunk) => {
    chunks.push(chunk);
  });

  req.on("end", () => {
    const rawBody = Buffer.concat(chunks).toString("utf8");
    let parsedBody = rawBody;

    try {
      parsedBody = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      // keep raw body for non-JSON payloads
    }

    events.unshift({
      method: req.method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams.entries()),
      headers: req.headers,
      body: parsedBody,
      receivedAt: new Date().toISOString(),
    });

    if (events.length > maxEvents) {
      events.length = maxEvents;
    }

    console.log(`[webhook-inspector] ${req.method} ${url.pathname}`);
    writeJson(res, 202, { accepted: true, count: events.length });
  });
});

server.listen(port, () => {
  console.log(`Webhook inspector listening on http://localhost:${port}`);
  console.log(`POST webhook payloads to http://localhost:${port}/capture`);
});
