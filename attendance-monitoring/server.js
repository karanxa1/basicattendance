const express = require("express");
const { google } = require("googleapis");
const fs = require("fs");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.static("public"));
app.use(express.json());
app.use(cors());

// Verify credentials file exists
const credentialsPath = path.resolve("credentials.json");
if (!fs.existsSync(credentialsPath)) {
  console.error("❌ CRITICAL ERROR: credentials.json file not found at:", credentialsPath);
  console.error("Please create a credentials.json file with your Google service account credentials");
  process.exit(1);
}

// Load Google Sheets credentials with detailed error logging
let auth;
try {
  const credentialsContent = fs.readFileSync(credentialsPath, "utf8");
  console.log("📝 Read credentials file successfully");
  
  try {
    const credentials = JSON.parse(credentialsContent);
    console.log("📝 Parsed credentials JSON successfully");
    console.log("📝 Credential type:", credentials.type);
    console.log("📝 Project ID:", credentials.project_id);
    
    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    console.log("✅ Created Google Auth client successfully");
  } catch (parseError) {
    console.error("❌ Failed to parse credentials.json:", parseError.message);
    console.error("Please ensure your credentials.json contains valid JSON");
    process.exit(1);
  }
} catch (error) {
  console.error("❌ Error reading credentials file:", error.message);
  process.exit(1);
}

// Create a client
const sheets = google.sheets({ version: "v4", auth });
console.log("✅ Created Google Sheets client");

// Make sure to set your actual spreadsheet ID
// If you're having trouble, create a new Google Sheet and copy its ID from the URL
// The URL looks like: https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID/edit
const spreadsheetId = process.env.SPREADSHEET_ID || "138SZSopLr7k7_EwG4nrXSFPYExNTjgPHQPpmdN5NlFY";
console.log(`📝 Using spreadsheet ID: ${spreadsheetId}`);

// Test the spreadsheet connection on startup
async function testConnection() {
  try {
    console.log("🔍 Testing connection to Google Sheets...");
    const testResponse = await sheets.spreadsheets.get({
      spreadsheetId,
    });
    console.log(`✅ Successfully connected to spreadsheet: "${testResponse.data.properties.title}"`);
    
    // Verify we have write access by getting the sheets
    const sheetsResponse = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties'
    });
    
    // Log available sheets
    console.log("📝 Available sheets in this spreadsheet:");
    sheetsResponse.data.sheets.forEach(sheet => {
      console.log(`   - ${sheet.properties.title}`);
    });
    
    // Check if Sheet1 exists
    const sheet1Exists = sheetsResponse.data.sheets.some(
      sheet => sheet.properties.title === 'Sheet1'
    );
    
    if (!sheet1Exists) {
      console.warn("⚠️ 'Sheet1' not found in spreadsheet. You may need to create it or use a different sheet name in your code.");
    }
    
    return true;
  } catch (error) {
    console.error("❌ Failed to connect to Google Sheets:", error.message);
    if (error.code === 404) {
      console.error("❌ Spreadsheet not found. Check your spreadsheet ID.");
    } else if (error.code === 403) {
      console.error("❌ Permission denied. Make sure your service account has access to the spreadsheet.");
      console.error("   1. Open your Google Sheet");
      console.error("   2. Click 'Share' in the top-right corner");
      console.error(`   3. Add ${auth?.credentials?.client_email || "your service account email"} with Editor access`);
    }
    return false;
  }
}

// Create initial sheet structure if needed
async function ensureSheetStructure() {
  try {
    // Check if Sheet1 exists and has headers
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Sheet1!A1:C1",
    });
    
    const values = response.data.values;
    
    // If sheet is empty or doesn't have headers, add them
    if (!values || values.length === 0) {
      console.log("📝 Adding headers to Sheet1");
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "Sheet1!A1:C1",
        valueInputOption: "RAW",
        resource: {
          values: [["Student ID", "Date", "Status"]]
        }
      });
      console.log("✅ Headers added successfully");
    } else {
      console.log("✅ Sheet1 already has data:", values[0]);
    }
  } catch (error) {
    console.error("❌ Error setting up sheet structure:", error.message);
  }
}

// Save attendance to Google Sheets
app.post("/submit-attendance", async (req, res) => {
  try {
    console.log("📢 Received attendance submission request");
    const { attendance, date } = req.body;

    // Make sure we have proper data
    if (!attendance || !date || !Array.isArray(attendance)) {
      console.error("❌ Invalid request data:", { attendance, date });
      return res.status(400).json({ error: "Missing or invalid attendance data" });
    }

    console.log(`📢 Processing attendance for date: ${date}`);
    console.log(`📢 Student records: ${attendance.length}`);

    // Format data for sheets API
    const values = attendance.map(({ studentId, status }) => {
      const record = [studentId.toString(), date, status || "Absent"];
      console.log(`📝 Student ${studentId}: ${status}`);
      return record;
    });

    if (values.length === 0) {
      console.error("❌ No valid attendance records to save");
      return res.status(400).json({ error: "No valid attendance records to save" });
    }

    // Append data to sheet with detailed logging
    console.log("📝 Sending data to Google Sheets...");
    try {
      const appendResponse = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "Sheet1!A:C", 
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        resource: { values },
      });

      console.log("✅ Attendance saved successfully!");
      console.log(`📝 Updated range: ${appendResponse.data.updates.updatedRange}`);
      console.log(`📝 Updated rows: ${appendResponse.data.updates.updatedRows}`);

      res.json({ 
        message: "✅ Attendance saved successfully!",
        updatedRange: appendResponse.data.updates.updatedRange,
        updatedRows: appendResponse.data.updates.updatedRows
      });
    } catch (appendError) {
      console.error("❌ Google Sheets API error:", appendError.message);
      
      if (appendError.code === 403) {
        console.error("❌ Permission denied. The service account doesn't have write access.");
      } else if (appendError.code === 404) {
        console.error("❌ Resource not found. Check if 'Sheet1' exists in your spreadsheet.");
      }
      
      if (appendError.response && appendError.response.data) {
        console.error("❌ API Error details:", appendError.response.data.error);
      }
      
      throw appendError;
    }
  } catch (error) {
    console.error("❌ Error processing attendance submission:", error);
    
    // Send detailed error info to client
    res.status(500).json({ 
      error: "Failed to save attendance", 
      message: error.message,
      code: error.code
    });
  }
});

// Fetch attendance data for the chart
app.get("/attendance-data", async (req, res) => {
  try {
    console.log("📢 Fetching attendance data for chart");
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Sheet1!A:C",
    });

    const rows = response.data.values || [];
    console.log(`📝 Retrieved ${rows.length} rows of data`);
    
    const summary = { Present: 0, Absent: 0 };

    // Skip the header row if it exists
    const startIndex = rows.length > 0 && (
      rows[0][0] === "Student ID" || 
      rows[0][2] === "Status"
    ) ? 1 : 0;
    
    for (let i = startIndex; i < rows.length; i++) {
      const row = rows[i];
      if (row && row.length >= 3) {
        if (row[2] === "Present") summary.Present++;
        else if (row[2] === "Absent") summary.Absent++;
      }
    }

    console.log(`📝 Summary: Present=${summary.Present}, Absent=${summary.Absent}`);
    res.json(summary);
  } catch (error) {
    console.error("❌ Error fetching attendance data for chart:", error);
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

// Fetch all attendance records
app.get("/all-attendance-records", async (req, res) => {
  try {
    console.log("📢 Fetching all attendance records");
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Sheet1!A:C",
    });

    const rows = response.data.values || [];
    console.log(`📝 Retrieved ${rows.length} rows of data`);
    
    // Skip the header row if it exists
    const startIndex = rows.length > 0 && (
      rows[0][0] === "Student ID" || 
      rows[0][0] === "Student Number" || 
      rows[0][2] === "Status"
    ) ? 1 : 0;
    
    const formattedRecords = [];
    
    for (let i = startIndex; i < rows.length; i++) {
      const row = rows[i];
      if (row && row.length >= 3) {
        formattedRecords.push({
          studentId: row[0],
          date: row[1],
          status: row[2]
        });
      }
    }

    console.log(`📝 Formatted ${formattedRecords.length} records for client`);
    res.json(formattedRecords);
  } catch (error) {
    console.error("❌ Error fetching all attendance records:", error);
    res.status(500).json({ error: "Failed to fetch records" });
  }
});

// Start the server and test connection
app.listen(PORT, async () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  
  // Test connection to Google Sheets
  const connected = await testConnection();
  
  if (connected) {
    // Ensure the sheet has the right structure
    await ensureSheetStructure();
    console.log("✅ Server is ready to accept requests");
  } else {
    console.warn("⚠️ Server started but Google Sheets connection failed");
    console.warn("⚠️ Attendance submissions will likely fail until this is fixed");
  }
});