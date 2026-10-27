// ---------- State ----------
const state = {
  students: [],
  records: [],
  date: new Date().toLocaleDateString("en-CA") // YYYY-MM-DD
};
let animateList = true;
const shown = { Total: 0, Present: 0, Absent: 0, Leave: 0 };

// ---------- Elements ----------
const $ = (id) => document.getElementById(id);
const listEl = $("studentList");
const datePicker = $("datePicker");

// ---------- Helpers ----------
window.onDbError = (err) => {
  const b = $("errBanner");
  const perm = err && err.code === "permission-denied";
  b.textContent = perm
    ? "Firestore ki permission band hai. Firebase console > Firestore > Rules mein test mode ya allow read, write: if true karo."
    : "Firebase error: " + (err && err.message ? err.message : err);
  b.classList.remove("d-none");
  console.error(err);
};
const safe = async (fn) => { try { await fn(); } catch (err) { window.onDbError(err); } };

const escapeHTML = (str) =>
  String(str).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const showToast = (msg) => {
  $("toastMsg").textContent = msg;
  bootstrap.Toast.getOrCreateInstance($("appToast"), { delay: 2200 }).show();
};

const statusOf = (studentId) => {
  const rec = state.records.find(r => r.date === state.date && r.studentId === studentId);
  return rec ? rec.status : null;
};

const percentOf = (studentId) => {
  const recs = state.records.filter(r => r.studentId === studentId);
  if (!recs.length) return null;
  return Math.round((recs.filter(r => r.status === "P").length / recs.length) * 100);
};

// ---------- Render ----------
function animateNumber(el, key, to) {
  const obj = { v: shown[key] };
  gsap.to(obj, {
    v: to, duration: 0.6, ease: "power2.out",
    onUpdate: () => (el.textContent = Math.round(obj.v)),
    onComplete: () => (shown[key] = to)
  });
}

function renderStats() {
  const c = { P: 0, A: 0, L: 0 };
  state.students.forEach(s => { const st = statusOf(s.id); if (st) c[st]++; });
  const total = state.students.length;
  animateNumber($("sTotal"), "Total", total);
  animateNumber($("sPresent"), "Present", c.P);
  animateNumber($("sAbsent"), "Absent", c.A);
  animateNumber($("sLeave"), "Leave", c.L);

  const pct = total ? Math.round((c.P / total) * 100) : 0;
  $("pctText").textContent = pct + "%";
  gsap.to("#barFill", { width: pct + "%", duration: 0.7, ease: "power2.out" });
}

function renderList() {
  if (!state.students.length) {
    listEl.innerHTML = `<div class="empty"><i class="bi bi-emoji-smile"></i><p class="mt-2 mb-0">Abhi koi student nahi. Upar "Student" button se add karo.</p></div>`;
    return;
  }

  listEl.innerHTML = state.students.map(s => {
    const st = statusOf(s.id);
    const pct = percentOf(s.id);
    const badge = pct === null
      ? `<span class="pct pct-none">NO RECORD</span>`
      : `<span class="pct ${pct >= 75 ? "pct-good" : "pct-bad"}">${pct}%</span>`;
    return `
      <div class="student-row" data-id="${s.id}">
        <div class="avatar">${escapeHTML(s.name.charAt(0).toUpperCase())}</div>
        <div class="info">
          <p class="nm">${escapeHTML(s.name)}</p>
          <small>Roll: ${escapeHTML(s.roll)}</small> ${badge}
        </div>
        <div class="status-btns">
          <button class="sbtn btn-p ${st === "P" ? "active" : ""}" data-status="P"><i class="bi bi-check-lg"></i> Present</button>
          <button class="sbtn btn-a ${st === "A" ? "active" : ""}" data-status="A"><i class="bi bi-x-lg"></i> Absent</button>
          <button class="sbtn btn-l ${st === "L" ? "active" : ""}" data-status="L"><i class="bi bi-clock"></i> Leave</button>
        </div>
        <button class="del-btn" title="Delete"><i class="bi bi-trash3-fill"></i></button>
      </div>`;
  }).join("");

  if (animateList) {
    gsap.from(".student-row", { x: -40, opacity: 0, duration: 0.45, stagger: 0.07, ease: "back.out(1.4)" });
    animateList = false;
  }
}

const render = () => { renderStats(); renderList(); };

// ---------- Events ----------
listEl.addEventListener("click", async (e) => {
  const row = e.target.closest(".student-row");
  if (!row) return;
  const id = row.dataset.id;

  const btn = e.target.closest("[data-status]");
  if (btn) {
    const status = btn.dataset.status;
    await safe(() => db.setStatus(state.date, id, status));
    const fresh = document.querySelector(`.student-row[data-id="${id}"] [data-status="${status}"]`);
    if (fresh) gsap.fromTo(fresh, { rotation: -6 }, { rotation: 0, duration: 0.5, ease: "elastic.out(1, 0.4)" });
    return;
  }

  if (e.target.closest(".del-btn")) {
    if (!confirm("Is student ko delete karna hai?")) return;
    gsap.to(row, { x: 80, opacity: 0, duration: 0.3, onComplete: async () => {
      await safe(() => db.deleteStudent(id));
      showToast("Student delete ho gaya");
    }});
  }
});

datePicker.addEventListener("change", () => {
  if (!datePicker.value) return;
  state.date = datePicker.value;
  animateList = true;
  render();
});

$("markAllBtn").addEventListener("click", async () => {
  if (!state.students.length) return showToast("Pehle student add karo");
  await safe(() => Promise.all(state.students.map(s => db.setStatus(state.date, s.id, "P"))));
  showToast("Sab Present mark ho gaye");
});

$("studentForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("stName").value.trim();
  const roll = $("stRoll").value.trim();
  if (!name || !roll) return;
  await safe(() => db.addStudent(name, roll));
  e.target.reset();
  bootstrap.Modal.getInstance($("studentModal")).hide();
  showToast(`${name} add ho gaya`);
});

// ---------- Start ----------
function init() {
  datePicker.value = state.date;

  const badge = $("modeBadge");
  badge.textContent = db.label;
  badge.classList.add(db.label.startsWith("Firebase") ? "mode-live" : "mode-demo");

  db.onStudents(list => { state.students = list; render(); });
  db.onAttendance(list => { state.records = list; render(); });

  gsap.timeline({ defaults: { ease: "back.out(1.5)" } })
    .from(".topbar", { y: -70, duration: 0.5 })
    .from(".head-card", { y: 40, opacity: 0, duration: 0.5 }, "-=0.2")
    .from(".stat", { y: 40, opacity: 0, rotation: -3, duration: 0.5, stagger: 0.1 }, "-=0.2");
}

init();
