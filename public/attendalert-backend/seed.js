const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "db.json");

const subjects = [
  { id: "SUB101", code: "CS301", name: "Data Structures", faculty: "Dr. Kavita Rao" },
  { id: "SUB102", code: "CS302", name: "Operating Systems", faculty: "Prof. Rajesh Nair" },
  { id: "SUB103", code: "CS303", name: "Database Management Systems", faculty: "Dr. Sneha Kulkarni" },
  { id: "SUB104", code: "CS304", name: "Computer Networks", faculty: "Prof. Vikram Deshmukh" },
  { id: "SUB105", code: "CS305", name: "Software Engineering", faculty: "Prof. Ananya Menon" }
];

const studentNames = [
  "Rahul Verma", "Ananya Sharma", "Rohan Kulkarni", "Priya Patel", "Karthik Reddy",
  "Neha Gupta", "Siddharth Joshi", "Pooja Nair", "Aditya Iyer", "Divya Menon",
  "Arjun Singh", "Meera Krishnan", "Harsh Vardhan", "Kavya Rao", "Nikhil Verma",
  "Riya Deshmukh", "Varun Malhotra", "Sneha Chatterjee", "Aakash Pandey", "Tanvi Shah",
  "Deepak Yadav", "Ishita Sengupta", "Manish Tiwari", "Shruti Hegde", "Pranav Kulkarni",
  "Aditi Joshi", "Suresh Babu", "Nandini Reddy", "Kunal Kapoor", "Payal Mehta"
];

function buildSeedData() {
  const totalClassesPerSubject = 16; // 4 weeks * 4 classes/week

  const students = studentNames.map((name, idx) => {
    const rollNo = `23CS${String(idx + 1).padStart(3, "0")}`;
    return {
      id: `STU${idx + 1}`,
      rollNo,
      name,
      email: `${name.toLowerCase().replace(/\s+/g, ".")}@college.edu`,
      parentEmail: `parent.${name.toLowerCase().replace(/\s+/g, ".")}@mail.com`,
      semester: "5th Sem CSE"
    };
  });

  // records[studentId][subjectId] = { attended, total }
  const records = {};

  students.forEach((student, idx) => {
    records[student.id] = {};

    subjects.forEach((subj, sIdx) => {
      let attended;

      if (student.name === "Rahul Verma" && subj.id === "SUB101") {
        // Demo case: 10 / 16 = 62.5% -> Critical (<65%), needs 8 consecutive classes
        attended = 10;
      } else if (idx < 4 && sIdx === 0) {
        // Extra critical cases in Data Structures so ~5 students are Critical overall
        attended = 9 + (idx % 2); // 9 or 10 out of 16 (56.25% - 62.5%)
      } else if (idx >= 4 && idx < 11) {
        // Warning tier range (~65% - 74%) -> 11 out of 16 = 68.75%
        attended = 11;
      } else {
        // Safe tier (>= 75%) -> 12 to 15 out of 16 (75% - 93.75%)
        attended = 12 + ((idx + sIdx) % 4);
      }

      records[student.id][subj.id] = {
        attended,
        total: totalClassesPerSubject
      };
    });
  });

  const sessions = [
    {
      id: "SES-001",
      subjectId: "SUB101",
      date: "2026-11-20",
      markedBy: "Dr. Kavita Rao",
      summary: { present: 24, late: 2, absent: 4 }
    }
  ];

  const interventions = [
    {
      id: "INT-001",
      studentId: "STU1",
      studentName: "Rahul Verma",
      mentorName: "Dr. Kavita Rao",
      date: "2026-11-18",
      note: "Discussed Data Structures shortage (62.5%) and mapped out attending 8 straight lectures."
    }
  ];

  return {
    subjects,
    students,
    records,
    sessions,
    interventions
  };
}

function readDB() {
  if (!fs.existsSync(DB_PATH)) {
    const initial = buildSeedData();
    writeDB(initial);
    return initial;
  }
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  return JSON.parse(raw);
}

function writeDB(data) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
}

if (require.main === module) {
  const seeded = buildSeedData();
  writeDB(seeded);
  console.log(
    `Seeded data/db.json with ${seeded.students.length} students and ${seeded.subjects.length} subjects.`
  );
}

module.exports = { buildSeedData, readDB, writeDB };