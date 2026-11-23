const express = require("express");
const router = express.Router();
const { readDB, writeDB } = require("./seed"); // or { readDB } in student.js
const { calculateStats } = require("./attendanceMath");

router.get("/:id", (req, res) => {
  const db = readDB();
  const student = db.students.find((s) => s.id === req.params.id);

  if (!student) {
    return res.status(404).json({ error: "Student not found" });
  }

  const studentRecords = db.records[student.id] || {};
  let totalAttended = 0;
  let totalHeld = 0;

  const subjects = db.subjects.map((subj) => {
    const rec = studentRecords[subj.id] || { attended: 0, total: 0 };
    totalAttended += rec.attended || 0;
    totalHeld += rec.total || 0;

    return {
      subjectId: subj.id,
      code: subj.code,
      name: subj.name,
      faculty: subj.faculty,
      ...calculateStats(rec.attended, rec.total)
    };
  });

  const overall = calculateStats(totalAttended, totalHeld);
  const alerts = subjects
    .filter((s) => s.riskTier !== "Safe")
    .map((s) => ({
      subjectId: s.subjectId,
      subjectName: s.name,
      riskTier: s.riskTier,
      percentage: s.percentage,
      classesNeeded: s.classesNeeded,
      message: `Attend ${s.classesNeeded} consecutive ${s.name} class(es) to reach 75%.`
    }));

  res.json({
    profile: {
      id: student.id,
      rollNo: student.rollNo,
      name: student.name,
      semester: student.semester
    },
    overall,
    subjects,
    alerts
  });
});

module.exports = router;