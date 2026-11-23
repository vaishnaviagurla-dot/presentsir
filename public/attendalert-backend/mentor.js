const express = require("express");
const router = express.Router();
const { readDB, writeDB } = require("./seed"); // or { readDB } in student.js
const { calculateStats } = require("./attendanceMath");

function buildStudentSummaries(db, subjectId = null) {
  return db.students.map((student) => {
    const studentRecords = db.records[student.id] || {};

    const perSubject = db.subjects.map((subj) => {
      const rec = studentRecords[subj.id] || { attended: 0, total: 0 };
      return {
        subjectId: subj.id,
        code: subj.code,
        subjectName: subj.name,
        faculty: subj.faculty,
        ...calculateStats(rec.attended, rec.total)
      };
    });

    let overallAttended = 0;
    let overallTotal = 0;
    Object.values(studentRecords).forEach((r) => {
      overallAttended += r.attended || 0;
      overallTotal += r.total || 0;
    });

    const overall = calculateStats(overallAttended, overallTotal);

    const activeStats = subjectId
      ? perSubject.find((s) => s.subjectId === subjectId) || overall
      : overall;

    const studentInterventions = db.interventions.filter(
      (item) => item.studentId === student.id
    );

    return {
      ...student,
      overall,
      activeStats,
      perSubject,
      interventions: studentInterventions
    };
  });
}

router.get("/dashboard", (req, res) => {
  const { tier, subjectId, search } = req.query;
  const db = readDB();
  let summaries = buildStudentSummaries(db, subjectId || null);

  const counts = {
    critical: summaries.filter((s) => s.activeStats.riskTier === "Critical").length,
    warning: summaries.filter((s) => s.activeStats.riskTier === "Warning").length,
    safe: summaries.filter((s) => s.activeStats.riskTier === "Safe").length,
    totalStudents: summaries.length
  };

  if (tier && tier !== "All") {
    summaries = summaries.filter(
      (s) => s.activeStats.riskTier.toLowerCase() === tier.toLowerCase()
    );
  }

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    summaries = summaries.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.rollNo.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
    );
  }

  summaries.sort((a, b) => a.activeStats.percentage - b.activeStats.percentage);

  res.json({
    bannerText: `${counts.critical} Students in Critical Shortage (<65%)`,
    counts,
    students: summaries,
    recentSessions: db.sessions.slice(0, 10),
    interventions: db.interventions
  });
});

router.get("/student/:id", (req, res) => {
  const db = readDB();
  const summaries = buildStudentSummaries(db);
  const student = summaries.find((s) => s.id === req.params.id);

  if (!student) {
    return res.status(404).json({ error: "Student not found" });
  }

  res.json({ student });
});

// Body: { studentId, mentorName, note, date }
router.post("/interventions", (req, res) => {
  const { studentId, mentorName = "Faculty Mentor", note, date } = req.body;

  if (!studentId || !note || !note.trim()) {
    return res.status(400).json({ error: "studentId and note are required" });
  }

  const db = readDB();
  const student = db.students.find((s) => s.id === studentId);
  if (!student) {
    return res.status(404).json({ error: "Student not found" });
  }

  const entry = {
    id: `INT-${Date.now()}`,
    studentId: student.id,
    studentName: student.name,
    mentorName: mentorName.trim(),
    date: date || new Date().toISOString().slice(0, 10),
    note: note.trim()
  };

  db.interventions.unshift(entry);
  writeDB(db);

  res.status(201).json({
    message: "Mentoring intervention logged",
    intervention: entry
  });
});

module.exports = router;