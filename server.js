import express from "express";
import cors from "cors";
import helmet from "helmet";
import { RateLimiterMemory } from "rate-limiter-flexible";
import pkg from "pg";
const { Pool } = pkg;

// ---- Config ----
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || "production";
const ALLOWED_ORIGINS = [
  "https://meetcasa.com",
  "https://www.meetcasa.com"
  // add "http://localhost:xxxx" here if you want to test locally
];

// ---- App & Middleware ----
const app = express();
app.use(helmet());
app.use(express.json());
app.use(cors({
  origin(origin, cb) {
    // allow same-origin / server-to-server / curl (no origin)
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  }
}));

// ---- Rate limit (basic anti-spam) ----
const limiter = new RateLimiterMemory({ points: 12, duration: 10 });
const limit = (req, res, next) =>
  limiter.consume(req.ip).then(() => next()).catch(() => res.status(429).json({ error: "Too many requests" }));

// ---- DB ----
if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Render PG uses SSL
});

// ---- Routes ----
app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
});

// POST /api/waitlist  { contact: "email or phone", type: "email"|"phone", sourcePage?: string }
app.post("/api/waitlist", limit, async (req, res) => {
  try {
    const { contact, type, sourcePage } = req.body || {};
    if (!contact || !type || !["email", "phone"].includes(type)) {
      return res.status(400).json({ error: "email or phone required" });
    }

    const ua = req.headers["user-agent"] || null;
    const ip =
      (req.headers["x-forwarded-for"]?.toString().split(",")[0] ?? req.socket.remoteAddress ?? null);

    await pool.query(
      `INSERT INTO waitlist (email, phone, source_page, user_agent, ip)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        type === "email" ? contact.trim().toLowerCase() : null,
        type === "phone" ? contact.trim().replace(/\D/g, "") : null,
        sourcePage || null,
        ua,
        ip
      ]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("waitlist insert error", err);
    res.status(500).json({ error: "server_error" });
  }
});

// ---- Start ----
app.listen(PORT, () => {
  console.log(`[casa-waitlist-api] listening on ${PORT} (${NODE_ENV})`);
});
