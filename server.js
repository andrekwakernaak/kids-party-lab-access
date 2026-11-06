const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { WebSocketServer } = require("ws");

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
};

const VALID_ACTIONS = new Set(["grant", "deny", "idle"]);

let state = {
  action: "idle",
  updatedAt: Date.now(),
};

function getLanAddresses() {
  const nets = os.networkInterfaces();
  const addresses = [];
  for (const entries of Object.values(nets)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (entry.family === "IPv4" && !entry.internal) {
        addresses.push(entry.address);
      }
    }
  }
  return addresses;
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(err.code === "ENOENT" ? 404 : 500, {
        "Content-Type": "text/plain; charset=utf-8",
      });
      res.end(err.code === "ENOENT" ? "Not found" : "Server error");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(data);
  });
}

function resolvePublicPath(urlPath) {
  let clean = decodeURIComponent(urlPath.split("?")[0]);
  if (clean === "/") clean = "/index.html";
  if (clean === "/display") clean = "/display.html";
  if (clean === "/control") clean = "/control.html";

  const resolved = path.normalize(path.join(PUBLIC_DIR, clean));
  if (!resolved.startsWith(PUBLIC_DIR)) return null;
  return resolved;
}

function broadcast(message) {
  const payload = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(payload);
    }
  }
}

function setAction(action) {
  if (!VALID_ACTIONS.has(action)) return false;
  state = { action, updatedAt: Date.now() };
  broadcast({ type: "state", ...state });
  return true;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/api/state") {
    sendJson(res, 200, state);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/info") {
    sendJson(res, 200, {
      port: PORT,
      addresses: getLanAddresses(),
      controlPaths: getLanAddresses().map((ip) => `http://${ip}:${PORT}/control`),
      displayPaths: getLanAddresses().map((ip) => `http://${ip}:${PORT}/display`),
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/action") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024) req.destroy();
    });
    req.on("end", () => {
      try {
        const parsed = JSON.parse(body || "{}");
        if (!setAction(parsed.action)) {
          sendJson(res, 400, { error: "Invalid action" });
          return;
        }
        sendJson(res, 200, state);
      } catch {
        sendJson(res, 400, { error: "Invalid JSON" });
      }
    });
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Method not allowed");
    return;
  }

  const filePath = resolvePublicPath(url.pathname);
  if (!filePath) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }
  serveFile(res, filePath);
});

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (socket) => {
  socket.send(JSON.stringify({ type: "state", ...state }));

  socket.on("message", (raw) => {
    let parsed;
    try {
      parsed = JSON.parse(String(raw));
    } catch {
      return;
    }

    if (parsed.type === "action" && setAction(parsed.action)) {
      return;
    }

    if (parsed.type === "ping") {
      socket.send(JSON.stringify({ type: "pong", at: Date.now() }));
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  const addresses = getLanAddresses();
  console.log(`Lab Access Control running on port ${PORT}`);
  console.log(`  Local display:  http://localhost:${PORT}/display`);
  console.log(`  Local control:  http://localhost:${PORT}/control`);
  for (const ip of addresses) {
    console.log(`  Phone control:  http://${ip}:${PORT}/control`);
    console.log(`  LAN display:    http://${ip}:${PORT}/display`);
  }
});
