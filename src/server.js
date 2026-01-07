import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { runAudit } from "./audit/runAudit.js";

const app = express();
app.use(cors());
app.use(express.static("public"));
app.use(bodyParser.json({ limit: "1mb" }));

app.post("/api/run-report", async (req, res) => {
  try {
    const { url, email, phone } = req.body || {};
    if (!url) {
      return res.status(400).json({ error: "url saknas" });
    }
    console.log("API: start audit", url, email, phone);
    const result = await runAudit({ url });
    return res.json({
      ok: true,
      htmlPath: result.htmlPath,
      pdfPath: result.pdfPath,
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
