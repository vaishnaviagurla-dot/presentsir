const express = require("express");
const router = express.Router();
const { readDB, writeDB } = require("./seed");
const { calculateStats } = require("./attendanceMath");


router.get("/subjects", (req, res) => {
  const db = readDB();
  res.json({
    subjects: db.subjects,
    students: db.students
  });
});

router.get("/roster/:subjectId", (req, res) => {
  const db = readDB();
  const subject = db.subjects.find((s) => s.id === req.params.subjectId);
  if (!subject) {
    return res.status(404).json({ error: "Subject not found" });
  }

  const roster = db.students.map((student) => {
    const rec = (db.records[student.id] && db.records[student.id][subject.id]) || {
      attended: 0,
      total: 0
    };
    const stats = calculateStats(rec.attended, rec.total);
    return {
      ...student,
      ...stats
    };
  });

  res.json({ subject, roster });
});

// Body: { subjectId, date, markedBy, records: [{ studentId, status: "Present" | "Late" | "Absent" }] }
router.post("/mark", (req, res) => {
  const { subjectId, date, markedBy = "Faculty Mentor", records = [] } = req.body;

  if (!subjectId || !Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: "subjectId and records array are required" });
  }

  const db = readDB();
  const subject = db.subjects.find((s) => s.id === subjectId);
  if (!subject) {
    return res.status(404).json({ error: "Subject not found" });
  }

  let presentCount = 0;
  let lateCount = 0;
  let absentCount = 0;

  const updatedStudents = [];

  records.forEach(({ studentId, status }) => {
    const student = db.students.find((s) => s.id === studentId);
    if (!student) return;

    if (!db.records[studentId]) db.records[studentId] = {};
    if (!db.records[studentId][subjectId]) {
      db.records[studentId][subjectId] = { attended: 0, total: 0 };
    }

    const entry = db.records[studentId][subjectId];
    entry.total += 1;

    if (status === "Present") {
      entry.attended += 1;
      presentCount += 1;
    } else if (status === "Late") {
      entry.attended += 1;
      lateCount += 1;
    } else {
      absentCount += 1;
    }

    updatedStudents.push({
      id: student.id,
      name: student.name,
      rollNo: student.rollNo,
      ...calculateStats(entry.attended, entry.total)
    });
  });

  const session = {
    id: `SES-${Date.now()}`,
    subjectId,
    date: date || new Date().toISOString().slice(0, 10),
    markedBy,
    summary: { present: presentCount, late: lateCount, absent: absentCount }
  };

  db.sessions.unshift(session);
  writeDB(db);

  res.status(201).json({
    message: "Attendance logged successfully",
    session,
    updatedStudents
  });
});

module.exports = router;