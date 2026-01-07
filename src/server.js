import dotenv from "dotenv";
dotenv.config();

import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import path from "path";
import { runAudit } from "./audit/runAudit.js";
import nodemailer from "nodemailer";

const app = express();
app.use(cors());
app.use(express.static("public"));
app.use(bodyParser.json({ limit: "1mb" }));
app.use("/output", express.static(path.join(process.cwd(), "output")));

const mailEnabled = !!process.env.MAIL_HOST;
let transporter = null;
if (mailEnabled) {
  transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT) || 587,
    secure: process.env.MAIL_SECURE === "true",
    auth: process.env.MAIL_USER
      ? {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASS,
        }
      : undefined,
  });
}

app.post("/api/run-report", async (req, res) => {
  try {
    const { url, email, phone } = req.body || {};
    if (!url) {
      return res.status(400).json({ error: "url saknas" });
    }
    console.log("API: start audit", url, email, phone);
    const result = await runAudit({ url });

    // Skicka e-post om efterfrågat och mail är konfigurerat
    let emailSent = false;
    if (email && transporter) {
      try {
        await transporter.sendMail({
          from: process.env.MAIL_FROM || process.env.MAIL_USER,
          to: email,
          subject: process.env.MAIL_SUBJECT || "Din SEO-rapport",
          text: `Rapport klar för ${url}\nHTML: ${result.htmlPath}\nPDF: ${result.pdfPath}`,
          html: `<p>Rapport klar för <b>${url}</b></p><p>HTML: ${result.htmlPath}<br/>PDF: ${result.pdfPath}</p>`,
          attachments: [
            { filename: result.htmlPath.split("/").pop(), path: result.htmlPath },
            { filename: result.pdfPath.split("/").pop(), path: result.pdfPath },
          ],
        });
        emailSent = true;
      } catch (err) {
        console.error("E-postfel:", err.message);
      }
    }

    return res.json({
      ok: true,
      htmlPath: result.htmlPath,
      pdfPath: result.pdfPath,
      emailSent,
    });
  } catch (err) {
    console.error("API error", err);
    return res.status(500).json({ error: err.message || "okänt fel" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server lyssnar på http://localhost:${port}`);
});
