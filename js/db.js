// Database layer: Firebase Firestore (config bhari ho to) warna localStorage (demo)

const isConfigured = () =>
  window.firebaseConfig &&
  window.firebaseConfig.apiKey &&
  !window.firebaseConfig.apiKey.startsWith("YOUR_");

class FirebaseDB {
  constructor() {
    firebase.initializeApp(window.firebaseConfig);
    this.db = firebase.firestore();
    this.label = "Firebase Live";
  }
  onStudents(cb) {
    return this.db.collection("students").orderBy("createdAt")
      .onSnapshot(
        snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
        err => window.onDbError && window.onDbError(err)
      );
  }
  onAttendance(cb) {
    return this.db.collection("attendance")
      .onSnapshot(
        snap => cb(snap.docs.map(d => d.data())),
        err => window.onDbError && window.onDbError(err)
      );
  }
  addStudent(name, roll) {
    return this.db.collection("students").add({ name, roll, createdAt: Date.now() });
  }
  async deleteStudent(id) {
    await this.db.collection("students").doc(id).delete();
    const snap = await this.db.collection("attendance").where("studentId", "==", id).get();
    const batch = this.db.batch();
    snap.forEach(d => batch.delete(d.ref));
    return batch.commit();
  }
  setStatus(date, studentId, status) {
    return this.db.collection("attendance").doc(`${date}_${studentId}`)
      .set({ date, studentId, status });
  }
}

class LocalDB {
  constructor() {
    this.label = "Demo Mode (Local)";
    this.students = JSON.parse(localStorage.getItem("att_students") || "[]");
    this.records = JSON.parse(localStorage.getItem("att_records") || "[]");
    this.sCbs = [];
    this.rCbs = [];
  }
  save() {
    localStorage.setItem("att_students", JSON.stringify(this.students));
    localStorage.setItem("att_records", JSON.stringify(this.records));
    this.sCbs.forEach(cb => cb([...this.students]));
    this.rCbs.forEach(cb => cb([...this.records]));
  }
  onStudents(cb) { this.sCbs.push(cb); cb([...this.students]); }
  onAttendance(cb) { this.rCbs.push(cb); cb([...this.records]); }
  async addStudent(name, roll) {
    this.students.push({ id: "s" + Date.now(), name, roll, createdAt: Date.now() });
    this.save();
  }
  async deleteStudent(id) {
    this.students = this.students.filter(s => s.id !== id);
    this.records = this.records.filter(r => r.studentId !== id);
    this.save();
  }
  async setStatus(date, studentId, status) {
    this.records = this.records.filter(r => !(r.date === date && r.studentId === studentId));
    this.records.push({ date, studentId, status });
    this.save();
  }
}

try {
  window.db = isConfigured() ? new FirebaseDB() : new LocalDB();
} catch (err) {
  console.error("Firebase start nahi hua:", err);
  window.db = new LocalDB();
}
