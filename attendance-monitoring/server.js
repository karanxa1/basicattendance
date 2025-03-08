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
const credentials = JSON.parse(fs.readFileSync("credentials.json"));
const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

// Create a client
const sheets = google.sheets({ version: "v4", auth });

const spreadsheetId = "138SZSopLr7k7_EwG4nrXSFPYExNTjgPHQPpmdN5NlFY";

// Save attendance to Google Sheets
app.post("/submit-attendance", async (req, res) => {
  try {
      const { attendance, date } = req.body;

      // Make sure we have proper data
      if (!attendance || !date) {
          return res.status(400).json({ error: "Missing required data" });
      }

      console.log("📢 Received Attendance Data:", attendance);
      console.log("📢 Date:", date);

      // Format data for sheets API
      const values = attendance.map(({ studentId, status }) => [
          studentId.toString(), date, status,
      ]);

      // Ensure the sheet exists by getting metadata first
      const metaData = await sheets.spreadsheets.get({
          spreadsheetId,
      });
      
      console.log("Sheet exists:", metaData.data.spreadsheetId);

      // Append data to sheet
      const appendResponse = await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: "Sheet1!A:C", 
          valueInputOption: "USER_ENTERED",  // Changed from RAW to USER_ENTERED
          insertDataOption: "INSERT_ROWS",
          resource: { values },
      });

      console.log("Append response:", appendResponse.data);

      res.json({ 
          message: "✅ Attendance saved successfully!",
          updatedRange: appendResponse.data.updates.updatedRange
      });
  } catch (error) {
      console.error("❌ Error updating Google Sheets:", error);
      
      // More detailed error information
      if (error.response) {
          console.error("Error response:", error.response.data);
      }
      
      res.status(500).json({ 
          error: "❌ Failed to save attendance", 
          details: error.message
      });
  }
});

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

// Fetch all attendance records
app.get("/all-attendance-records", async (req, res) => {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: "Sheet1!A:C",
        });

        const rows = response.data.values || [];
        
        const formattedRecords = rows.map(row => ({
            studentId: row[0],
            date: row[1],
            status: row[2]
        }));

        res.json(formattedRecords);
    } catch (error) {
        console.error("Error fetching attendance records:", error);
        res.status(500).json({ error: "Failed to fetch records" });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});