const express = require("express");
const cors = require("cors");
const path = require("path");
const { readDB } = require("./seed");
const { calculateStats } = require("./attendanceMath");

const attendanceRoutes = require("./attendance");
const mentorRoutes = require("./mentor");
const studentRoutes = require("./student");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve existing HTML/CSS/JS frontend from public/
app.use(express.static(path.join(__dirname, "..")));

// Ensure database exists on startup
readDB();

// API routes
app.use("/api/attendance", attendanceRoutes);
app.use("/api/mentor", mentorRoutes);
app.use("/api/student", studentRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "AttendAlert Backend" });
});

app.listen(PORT, () => {
  console.log(`AttendAlert server running at http://localhost:${PORT}`);
});

