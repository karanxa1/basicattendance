const express = require("express");
const { google } = require("googleapis");
const fs = require("fs");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.static("public"));
app.use(express.json());
app.use(cors());

// Load Google Sheets credentials
const credentials = JSON.parse(fs.readFileSync("bustling-surf-442611-c0-58ef020d9c79.json"));
const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

const spreadsheetId = "138SZSopLr7k7_EwG4nrXSFPYExNTjgPHQPpmdN5NlFY"; // Replace with your Google Sheets ID

// Save attendance to Google Sheets
app.post("/submit-attendance", async (req, res) => {
  try {
      const { attendance, date } = req.body;

      if (!spreadsheetId) {
          throw new Error("spreadsheetId is missing!");
      }

      console.log("📢 Received Attendance Data:", attendance);
      console.log("📢 Spreadsheet ID:", spreadsheetId);

      const values = attendance.map(({ studentId, status }) => [
          studentId, date, status,
      ]);

      console.log("📢 Data being sent to Google Sheets:", values);

      await sheets.spreadsheets.values.append({
          spreadsheetId: spreadsheetId,
          range: "Sheet1!A:C",
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          resource: { values },
      });

      res.json({ message: "✅ Attendance saved successfully!" });
  } catch (error) {
      console.error("❌ Error updating Google Sheets:", error);
      res.status(500).json({ error: "❌ Failed to save attendance" });
  }
});
//ne
// Fetch attendance data for the chart
app.get("/attendance-data", async (req, res) => {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: "Sheet1!A:C",
        });

        const rows = response.data.values || [];
        const summary = { Present: 0, Absent: 0 };

        rows.forEach((row) => {
            if (row[2] === "Present") summary.Present++;
            else if (row[2] === "Absent") summary.Absent++;
        });

        res.json(summary);
    } catch (error) {
        console.error("Error fetching attendance data:", error);
        res.status(500).json({ error: "Failed to fetch data" });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});
