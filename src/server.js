// src/server.js
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

import { runAudit } from "./audit/runAudit.js";  // ✅ se till att denna fil exporterar runAudit

dotenv.config();

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(cors());

// --- Paths (för att kunna servera /output och public) ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const publicDir = path.join(projectRoot, "public");
const outputDir = path.join(projectRoot, "output");
fs.mkdirSync(outputDir, { recursive: true });

// Statics
app.use(express.static(publicDir));
app.use("/output", express.static(outputDir, { fallthrough: false }));

// Bas-root -> skicka index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// --- Nodemailer transporter (Gmail App Password) ---
function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // Om SMTP_* saknas → returnera null, så API fortsätter funka utan mail
  if (!host || !port || !user || !pass) {
    console.warn(
      "SMTP saknas i .env (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS). Mail skickas inte."
    );
    return null;
  }

  // 465 = secure true, 587 = secure false (STARTTLS)
  const secure =
    String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

const transporter = createTransporter();

// --- API: skapa rapport ---
app.post("/api/run-report", async (req, res) => {
  try {
    const { url, email, phone } = req.body || {};

    if (!url) {
      return res.status(400).json({ error: "url saknas" });
    }

    console.log("API: start audit", url, email, phone);

    // ⚠️ runAudit ska skapa filer i /output och returnera paths
    const result = await runAudit({ url });

    // Bygg publika länkar (fungerar via cloudflared + express static)
    const baseUrl =
      process.env.PUBLIC_BASE_URL || `https://${req.headers.host}`;
    const htmlUrl = `${baseUrl}/${result.htmlPath}`.replace(/([^:]\/)\/+/g, "$1");
    const pdfUrl = `${baseUrl}/${result.pdfPath}`.replace(/([^:]\/)\/+/g, "$1");

    // Skicka e-post om email finns och transporter är igång
    let emailSent = false;
    let emailError = null;

    if (email && transporter) {
      try {
        const from = process.env.MAIL_FROM || process.env.SMTP_USER;
        const subject = process.env.MAIL_SUBJECT || "Din SEO-rapport";

        await transporter.sendMail({
          from,
          to: email,
          subject,
          text:
            `Rapport klar för ${url}\n\n` +
            `HTML: ${htmlUrl}\n` +
            `PDF: ${pdfUrl}\n\n` +
            `Hälsningar,\nJobbsystem`,
          html:
            `<p>Rapport klar för <b>${url}</b></p>` +
            `<p>HTML: <a href="${htmlUrl}">${htmlUrl}</a><br/>` +
            `PDF: <a href="${pdfUrl}">${pdfUrl}</a></p>` +
            `<p>Hälsningar,<br/>Jobbsystem</p>`,
          // Om du vill skicka som bilaga också:
          attachments: [
            {
              filename: path.basename(result.htmlPath),
              path: path.join(projectRoot, result.htmlPath),
            },
            {
              filename: path.basename(result.pdfPath),
              path: path.join(projectRoot, result.pdfPath),
            },
          ],
        });

        emailSent = true;
      } catch (err) {
        emailError = err?.message || String(err);
        console.error("E-postfel:", emailError);
      }
    }

    return res.json({
      ok: true,
      htmlPath: result.htmlPath,
      pdfPath: result.pdfPath,
      htmlUrl,
      pdfUrl,
      emailSent,
      emailError,
    });
  } catch (err) {
    console.error("API error", err);
    return res.status(500).json({ error: err?.message || "okänt fel" });
  }
});

// --- Start ---
const port = Number(process.env.PORT || "3000");
app.listen(port, () => {
  console.log(`Server lyssnar på http://localhost:${port}`);
  console.log(`Output serveras på /output (ex: http://localhost:${port}/output/...)`);
});
