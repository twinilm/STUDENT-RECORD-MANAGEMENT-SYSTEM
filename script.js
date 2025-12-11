const STORAGE_KEY = "studentPortal_final_v1";

function loadFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        console.warn("Failed to load from storage:", e);
        return null;
    }
}

function saveToStorage() {
    try {
        const data = { users, students, marks, fees, attendance, onlineAttendance };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn("Failed to save to storage:", e);
    }
}

const TOTAL_FEE = 360000;

const SUBJECT_CREDITS = {
    ENGLISH: 3,
    APTITUDE: 2,
    OOPS: 3,
    MATHS: 3,
    "CODING SKILLS": 3
};
const SUBJECTS = Object.keys(SUBJECT_CREDITS);

const defaultData = {
    users: [
        { username: "ADMIN",    password: "admin123", role: "ADMIN" },
        { username: "23CSE101", password: "student1", role: "STUDENT", studentId: "1" },
        { username: "23ECE050", password: "student2", role: "STUDENT", studentId: "2" }
    ],
    students: [
        { id: "1", roll: "23CSE101", name: "Aashish Kumar", dept: "CSE", cgpa: 0 },
        { id: "2", roll: "23ECE050", name: "Priya Sharma",  dept: "ECE", cgpa: 0 }
    ],
    marks: [
        {
            studentId: "1",
            scores: { ENGLISH: 78, APTITUDE: 82, OOPS: 88, MATHS: 91, "CODING SKILLS": 85 }
        },
        {
            studentId: "2",
            scores: { ENGLISH: 72, APTITUDE: 79, OOPS: 80, MATHS: 75, "CODING SKILLS": 83 }
        }
    ],
    fees: [
        { studentId: "1", paid: 120000 },
        { studentId: "2", paid: 180000 }
    ],
    attendance: [],
    onlineAttendance: null
};

let baseData = loadFromStorage() || defaultData;

let users            = baseData.users || defaultData.users;
let students         = baseData.students || defaultData.students;
let marks            = baseData.marks || defaultData.marks;
let fees             = baseData.fees || defaultData.fees;
let attendance       = baseData.attendance || [];
let onlineAttendance = baseData.onlineAttendance || null;

if (onlineAttendance && onlineAttendance.expiresAt <= Date.now()) {
    onlineAttendance = null;
}

function gradePointFromMarks(m) {
    if (m >= 90) return 10;
    if (m >= 80) return 9;
    if (m >= 70) return 8;
    if (m >= 60) return 7;
    if (m >= 50) return 6;
    if (m >= 40) return 5;
    return 0;
}

function computeCGPAForStudent(studentId) {
    const m = marks.find(mm => mm.studentId === studentId);
    const s = students.find(ss => ss.id === studentId);
    if (!m || !s) return;
    let num = 0, den = 0;
    for (const subj of SUBJECTS) {
        const cr = SUBJECT_CREDITS[subj];
        const mk = Number(m.scores[subj] ?? 0);
        const gp = gradePointFromMarks(mk);
        num += gp * cr;
        den += cr;
    }
    s.cgpa = den ? num / den : 0;
}

students.forEach(s => computeCGPAForStudent(s.id));
saveToStorage();

let currentUser = null;
let currentStudent = null;
let pwMode = null;
let attendanceTimerId = null;

function showPage(id) {
    document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
    document.getElementById(id).classList.remove("hidden");
}

function findStudentById(id) {
    return students.find(s => s.id === id) || null;
}

function getMarksFor(id) { return marks.find(m => m.studentId === id) || null; }

function getFeesFor(id) {
    let f = fees.find(e => e.studentId === id);
    if (!f) {
        f = { studentId: id, paid: 0 };
        fees.push(f);
        saveToStorage();
    }
    return f;
}

function getTodayDateStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function getTodayRandomTimetable() {
    const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const now = new Date();
    const idx = now.getDay();
    const todayName = days[idx];
    const dateStr = now.toLocaleDateString("en-IN",{day:"2-digit",month:"2-digit",year:"numeric"});

    if (idx === 0 || idx === 6) {
        return { todayName, dateStr, holiday:true, periods:[] };
    }

    const pool = [...SUBJECTS];
    const chosen = [];
    for (let i=0;i<4 && pool.length;i++) {
        const r = Math.floor(Math.random()*pool.length);
        chosen.push(pool[r]);
        pool.splice(r,1);
    }
    const slots = [
        "9:00 – 10:00 AM",
        "10:00 – 11:00 AM",
        "11:00 AM – 12:00 PM",
        "2:00 – 3:00 PM"
    ];
    const periods = chosen.map((sub,i)=>({time:slots[i],subject:sub}));
    return { todayName, dateStr, holiday:false, periods };
}

function setAttendance(studentId, subject, dateStr, status) {
    const idx = attendance.findIndex(
        a => a.studentId === studentId && a.subject === subject && a.date === dateStr
    );
    if (idx === -1) attendance.push({ studentId, subject, date:dateStr, status });
    else attendance[idx].status = status;
}

function getSubjectAttendanceSummary(studentId, subject) {
    const recs = attendance.filter(a => a.studentId === studentId && a.subject === subject);
    const total = recs.length;
    const present = recs.filter(r=>r.status==="P").length;
    const percent = total ? (present*100)/total : 0;
    return { total, present, percent };
}

function getOverallAttendancePercent(studentId) {
    let sum=0, count=0;
    for (const subj of SUBJECTS) {
        const { total, present } = getSubjectAttendanceSummary(studentId, subj);
        if (total>0) {
            sum += (present*100)/total;
            count++;
        }
    }
    return count ? sum/count : null;
}

function getTodayStatus(studentId, subject) {
    const today = getTodayDateStr();
    const rec = attendance.find(
        a => a.studentId === studentId && a.subject === subject && a.date === today
    );
    return rec ? rec.status : null;
}

/* -------- STUDENT DASHBOARD -------- */
function renderStudentDashboard() {
    if (!currentStudent) return;
    const s = currentStudent;

    document.getElementById("st-id").innerText   = s.id;
    document.getElementById("st-roll").innerText = s.roll;
    document.getElementById("st-name").innerText = s.name;
    document.getElementById("st-dept").innerText = s.dept;
    document.getElementById("st-cgpa").innerText = s.cgpa.toFixed(2);
    document.getElementById("student-welcome").innerText =
        `Logged in as ${s.name} (${s.roll})`;

    const attMap = {
        ENGLISH: "att-eng",
        APTITUDE: "att-apt",
        OOPS: "att-oops",
        MATHS: "att-maths",
        "CODING SKILLS": "att-code-subj"
    };
    SUBJECTS.forEach(subj => {
        const id = attMap[subj];
        const el = document.getElementById(id);
        const { total, present, percent } = getSubjectAttendanceSummary(s.id, subj);
        if (!el) return;
        if (total === 0) el.innerText = "–";
        else el.innerText = `${present}/${total} (${percent.toFixed(0)}%)`;
    });
    document.getElementById("st-att-msg").innerText = "";

    const m = getMarksFor(s.id);
    if (m) {
        const sc = m.scores;
        document.getElementById("m-eng").innerText   = sc.ENGLISH ?? "-";
        document.getElementById("m-apt").innerText   = sc.APTITUDE ?? "-";
        document.getElementById("m-oops").innerText  = sc.OOPS ?? "-";
        document.getElementById("m-maths").innerText = sc.MATHS ?? "-";
        document.getElementById("m-code").innerText  = sc["CODING SKILLS"] ?? "-";
    } else {
        ["m-eng","m-apt","m-oops","m-maths","m-code"].forEach(id=>{
            document.getElementById(id).innerText="-";
        });
    }

    const f = getFeesFor(s.id);
    const due = TOTAL_FEE - f.paid;
    document.getElementById("fee-total").innerText = `₹${TOTAL_FEE.toLocaleString("en-IN")}`;
    document.getElementById("fee-paid").innerText  = `₹${f.paid.toLocaleString("en-IN")}`;
    document.getElementById("fee-due").innerText   = `₹${due.toLocaleString("en-IN")}`;

    const {todayName,dateStr,holiday,periods} = getTodayRandomTimetable();
    const ttMeta = document.getElementById("tt-meta");
    const ttList = document.getElementById("tt-list");
    const ttStatus = document.getElementById("tt-status");
    ttList.innerHTML = "";
    ttStatus.classList.remove("tt-status-present","tt-status-absent","tt-status-holiday");
    ttStatus.innerText = "Status: -";

    if (holiday) {
        ttMeta.innerText = `${todayName} • ${dateStr} • Holiday (No classes)`;
        ttStatus.innerText = "Status: Holiday";
        ttStatus.classList.add("tt-status-holiday");
    } else {
        ttMeta.innerText = `${todayName} • ${dateStr} • 4 classes scheduled`;
        let anyP=false, anyA=false;
        periods.forEach(p=>{
            const li = document.createElement("li");
            const st = getTodayStatus(s.id,p.subject) || "-";
            if (st==="P") anyP=true;
            if (st==="A") anyA=true;
            li.innerText = `${p.time} : ${p.subject} [${st}]`;
            ttList.appendChild(li);
        });
        if (anyP) {
            ttStatus.innerText = "Status: Present";
            ttStatus.classList.add("tt-status-present");
        } else if (anyA) {
            ttStatus.innerText = "Status: Absent";
            ttStatus.classList.add("tt-status-absent");
        }
    }
}

/* -------- ADMIN TABLE -------- */
function renderAdminTable() {
    const tbody = document.getElementById("students-table-body");
    tbody.innerHTML = "";
    students.forEach(s=>{
        const tr = document.createElement("tr");
        const attPercent = getOverallAttendancePercent(s.id);
        let attText = "–";
        let attClass = "";
        if (attPercent !== null) {
            attText = attPercent.toFixed(0) + "%";
            if (attPercent < 75) attClass = "att-low";
        }
        tr.innerHTML = `
            <td>${s.id}</td>
            <td>${s.roll}</td>
            <td>${s.name}</td>
            <td>${s.dept}</td>
            <td>${s.cgpa.toFixed(2)}</td>
            <td class="${attClass}">${attText}</td>
        `;
        tbody.appendChild(tr);
    });
}

/* -------- ADMIN SELECTS -------- */
function fillStudentSelects() {
    const teachSel = document.getElementById("teach-student");
    const finSel   = document.getElementById("fin-student");
    teachSel.innerHTML="";
    finSel.innerHTML="";
    students.forEach(s=>{
        const label = `${s.roll} - ${s.name}`;
        const o1 = new Option(label,s.id);
        const o2 = new Option(label,s.id);
        teachSel.add(o1);
        finSel.add(o2);
    });
}

/* -------- TEACHING PANEL -------- */
function loadMarksIntoForm(id) {
    const m = getMarksFor(id);
    if (m) {
        const sc = m.scores;
        document.getElementById("t-eng").value   = sc.ENGLISH ?? "";
        document.getElementById("t-apt").value   = sc.APTITUDE ?? "";
        document.getElementById("t-oops").value  = sc.OOPS ?? "";
        document.getElementById("t-maths").value = sc.MATHS ?? "";
        document.getElementById("t-code").value  = sc["CODING SKILLS"] ?? "";
    } else {
        ["t-eng","t-apt","t-oops","t-maths","t-code"].forEach(id2=>{
            document.getElementById(id2).value="";
        });
    }
    document.getElementById("teach-msg").innerText="";
}

function handleSaveMarks() {
    const id = document.getElementById("teach-student").value;
    const msg = document.getElementById("teach-msg");
    const eng   = Number(document.getElementById("t-eng").value || 0);
    const apt   = Number(document.getElementById("t-apt").value || 0);
    const oops  = Number(document.getElementById("t-oops").value || 0);
    const maths = Number(document.getElementById("t-maths").value || 0);
    const code  = Number(document.getElementById("t-code").value || 0);

    let m = getMarksFor(id);
    if (!m) { m = {studentId:id,scores:{}}; marks.push(m); }
    m.scores.ENGLISH = eng;
    m.scores.APTITUDE = apt;
    m.scores.OOPS = oops;
    m.scores.MATHS = maths;
    m.scores["CODING SKILLS"] = code;

    computeCGPAForStudent(id);
    saveToStorage();
    msg.innerText = "Marks & CGPA updated.";
    renderAdminTable();
    if (currentStudent && currentStudent.id===id) renderStudentDashboard();
}

/* -------- FINANCE -------- */
function loadFinanceFor(id) {
    const f = getFeesFor(id);
    const due = TOTAL_FEE - f.paid;
    document.getElementById("fin-total").innerText = `₹${TOTAL_FEE.toLocaleString("en-IN")}`;
    document.getElementById("fin-paid").innerText  = `₹${f.paid.toLocaleString("en-IN")}`;
    document.getElementById("fin-due").innerText   = `₹${due.toLocaleString("en-IN")}`;
    document.getElementById("fin-msg").innerText   = "";
    document.getElementById("fin-amount").value    = "";
}

function handleFinancePay() {
    const id = document.getElementById("fin-student").value;
    const amtStr = document.getElementById("fin-amount").value;
    const amt = Number(amtStr);
    const msg = document.getElementById("fin-msg");
    if (!amtStr || isNaN(amt) || amt<=0) {
        msg.innerText="Enter valid amount.";
        return;
    }
    const f = getFeesFor(id);
    const due = TOTAL_FEE - f.paid;
    if (amt>due) {
        msg.innerText="Amount is more than due.";
        return;
    }
    f.paid += amt;
    saveToStorage();
    loadFinanceFor(id);
    msg.innerText = `Payment of ₹${amt.toLocaleString("en-IN")} recorded.`;
    if (currentStudent && currentStudent.id===id) renderStudentDashboard();
}

/* -------- STUDENT MGMT -------- */
function handleAddStudent() {
    const id   = document.getElementById("add-id").value.trim();
    const roll = document.getElementById("add-roll").value.trim();
    const name = document.getElementById("add-name").value.trim();
    const dept = document.getElementById("add-dept").value.trim();
    const engV = document.getElementById("add-eng").value.trim();
    const aptV = document.getElementById("add-apt").value.trim();
    const oopsV= document.getElementById("add-oops").value.trim();
    const mathsV=document.getElementById("add-maths").value.trim();
    const codeV =document.getElementById("add-code").value.trim();
    const msg = document.getElementById("admin-msg");

    if (!id || !roll || !name || !dept) {
        msg.innerText="Fill ID, Roll, Name, Dept.";
        return;
    }
    if (students.some(s=>s.id===id)) {
        msg.innerText="ID already exists.";
        return;
    }
    students.push({id,roll,name,dept,cgpa:0});
    users.push({username:roll,password:"student123",role:"STUDENT",studentId:id});
    marks.push({
        studentId:id,
        scores:{
            ENGLISH:Number(engV||0),
            APTITUDE:Number(aptV||0),
            OOPS:Number(oopsV||0),
            MATHS:Number(mathsV||0),
            "CODING SKILLS":Number(codeV||0)
        }
    });
    computeCGPAForStudent(id);
    fees.push({studentId:id,paid:0});
    saveToStorage();
    renderAdminTable();
    fillStudentSelects();
    msg.innerText = `Student added. Login: ${roll} / student123`;
    ["add-id","add-roll","add-name","add-dept","add-eng","add-apt","add-oops","add-maths","add-code"]
        .forEach(i=>document.getElementById(i).value="");
}

function handleDeleteStudent() {
    const id = document.getElementById("del-id").value.trim();
    const msg = document.getElementById("admin-msg");
    if (!id) { msg.innerText="Enter ID."; return; }

    const idx = students.findIndex(s=>s.id===id);
    if (idx===-1) { msg.innerText="Student ID not found."; return; }

    students.splice(idx,1);
    users = users.filter(u=>u.studentId !== id);
    marks = marks.filter(m=>m.studentId!==id);
    fees  = fees.filter(f=>f.studentId!==id);
    attendance = attendance.filter(a=>a.studentId!==id);

    saveToStorage();
    renderAdminTable();
    fillStudentSelects();
    msg.innerText="Student deleted.";
    document.getElementById("del-id").value="";
}

/* -------- PASSWORD MODAL -------- */
function openPasswordModal(mode) {
    pwMode = mode;
    const modal = document.getElementById("password-modal");
    document.getElementById("pw-modal-title").innerText =
        mode==="ADMIN" ? "Change Admin Password" : "Change Student Password";
    document.getElementById("pw-modal-subtitle").innerText =
        mode==="ADMIN" ? "Update your admin login password." :
                         "Update your student login password.";
    document.getElementById("pw-old").value="";
    document.getElementById("pw-new").value="";
    document.getElementById("pw-msg").innerText="";
    modal.classList.remove("hidden");
}

function closePasswordModal() {
    document.getElementById("password-modal").classList.add("hidden");
    pwMode=null;
}

function handlePasswordSave() {
    const msg = document.getElementById("pw-msg");
    if (!currentUser) { msg.innerText="No user logged in."; return; }
    const oldP = document.getElementById("pw-old").value;
    const newP = document.getElementById("pw-new").value;
    if (!oldP || !newP) { msg.innerText="Enter both passwords."; return; }
    if (oldP !== currentUser.password) { msg.innerText="Current password incorrect."; return; }
    if (newP.length<4) { msg.innerText="New password must be ≥ 4 chars."; return; }
    const u = users.find(u=>u.username===currentUser.username);
    if (!u) { msg.innerText="User not found."; return; }
    u.password = newP;
    currentUser.password = newP;
    saveToStorage();
    msg.innerText="Password updated. Use new password from next login.";
}

/* -------- ADMIN MODE SWITCH -------- */
function showTeachingPanel() {
    document.getElementById("teaching-panel").classList.remove("hidden");
    document.getElementById("finance-panel").classList.add("hidden");
    document.getElementById("student-panel").classList.add("hidden");
    document.getElementById("mode-teaching").classList.add("btn-active");
    document.getElementById("mode-finance").classList.remove("btn-active");
    document.getElementById("mode-students").classList.remove("btn-active");
}

function showFinancePanel() {
    document.getElementById("finance-panel").classList.remove("hidden");
    document.getElementById("teaching-panel").classList.add("hidden");
    document.getElementById("student-panel").classList.add("hidden");
    document.getElementById("mode-finance").classList.add("btn-active");
    document.getElementById("mode-teaching").classList.remove("btn-active");
    document.getElementById("mode-students").classList.remove("btn-active");
}

function showStudentPanel() {
    document.getElementById("student-panel").classList.remove("hidden");
    document.getElementById("teaching-panel").classList.add("hidden");
    document.getElementById("finance-panel").classList.add("hidden");
    document.getElementById("mode-students").classList.add("btn-active");
    document.getElementById("mode-teaching").classList.remove("btn-active");
    document.getElementById("mode-finance").classList.remove("btn-active");
}

/* -------- ATTENDANCE MODAL -------- */
function fillAttendanceSubjectSelect() {
    const sel = document.getElementById("att-subject-select");
    sel.innerHTML="";
    sel.add(new Option("Select subject","",true,true));
    SUBJECTS.forEach(s=>sel.add(new Option(s,s)));
}

function renderAttendanceStudentRows() {
    const subj = document.getElementById("att-subject-select").value;
    const tbody = document.getElementById("att-student-rows");
    const msg = document.getElementById("att-modal-msg");
    tbody.innerHTML="";
    if (!subj) {
        msg.innerText="Select a subject to mark attendance.";
        return;
    }
    msg.innerText="";
    const today = getTodayDateStr();
    students.forEach(s=>{
        const rec = attendance.find(a=>a.studentId===s.id && a.subject===subj && a.date===today);
        const val = rec ? rec.status : "";
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${s.roll}</td>
            <td>${s.name}</td>
            <td>
                <select class="att-status field-input" data-student-id="${s.id}" style="max-width:80px; margin-top:0; padding:4px 6px;">
                    <option value=""  ${val===""?"selected":""}>-</option>
                    <option value="P" ${val==="P"?"selected":""}>P</option>
                    <option value="A" ${val==="A"?"selected":""}>A</option>
                </select>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function generateRandomCode() {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const first = letters[Math.floor(Math.random()*letters.length)];
    let nums="";
    for (let i=0;i<5;i++) nums += Math.floor(Math.random()*10);
    return first+nums;
}

function updateOnlineAttendanceUI(startTimer=false) {
    const codeEl  = document.getElementById("att-code-display");
    const timerEl = document.getElementById("att-code-timer");
    if (attendanceTimerId) { clearInterval(attendanceTimerId); attendanceTimerId=null; }

    if (!onlineAttendance) {
        codeEl.innerText="-";
        timerEl.innerText="--:--";
        return;
    }
    if (onlineAttendance.expiresAt <= Date.now()) {
        onlineAttendance=null;
        saveToStorage();
        codeEl.innerText="-";
        timerEl.innerText="Expired";
        return;
    }
    codeEl.innerText = onlineAttendance.code;

    const updateTimer = () => {
        if (!onlineAttendance) { timerEl.innerText="--:--"; return; }
        const left = onlineAttendance.expiresAt - Date.now();
        if (left<=0) {
            onlineAttendance=null;
            saveToStorage();
            timerEl.innerText="Expired";
            if (attendanceTimerId) { clearInterval(attendanceTimerId); attendanceTimerId=null; }
            return;
        }
        const s = Math.floor(left/1000);
        const mm = String(Math.floor(s/60)).padStart(2,"0");
        const ss = String(s%60).padStart(2,"0");
        timerEl.innerText = `${mm}:${ss}`;
    };
    updateTimer();
    if (startTimer) attendanceTimerId = setInterval(updateTimer,1000);
}

function openAttendanceModal() {
    const modal = document.getElementById("attendance-modal");
    document.getElementById("att-modal-msg").innerText="";
    fillAttendanceSubjectSelect();
    renderAttendanceStudentRows();
    updateOnlineAttendanceUI(true);
    modal.classList.remove("hidden");
}

function closeAttendanceModal() {
    document.getElementById("attendance-modal").classList.add("hidden");
    if (attendanceTimerId) { clearInterval(attendanceTimerId); attendanceTimerId=null; }
}

function handleGenerateCode() {
    const subj = document.getElementById("att-subject-select").value;
    const msg  = document.getElementById("att-modal-msg");
    if (!subj) { msg.innerText="Select subject first."; return; }
    const code = generateRandomCode();
    const expiresAt = Date.now() + 60*1000;
    onlineAttendance = { code, subject:subj, expiresAt };
    saveToStorage();
    msg.innerText = `Code generated for ${subj}. Valid for 1 minute.`;
    updateOnlineAttendanceUI(true);
}

function handleAttendanceSaveFromModal() {
    const subj = document.getElementById("att-subject-select").value;
    const msg  = document.getElementById("att-modal-msg");
    if (!subj) { msg.innerText="Select subject first."; return; }
    const today = getTodayDateStr();
    document.querySelectorAll(".att-status").forEach(sel=>{
        const stId = sel.getAttribute("data-student-id");
        const val  = sel.value;
        if (val==="P" || val==="A") setAttendance(stId,subj,today,val);
    });
    saveToStorage();
    msg.innerText="Attendance saved.";
    renderAdminTable();
    if (currentStudent) renderStudentDashboard();
}

/* -------- STUDENT ONLINE CODE -------- */
function handleStudentCodeSubmit() {
    const msgEl = document.getElementById("st-att-msg");
    const inputEl = document.getElementById("st-att-code");
    if (!currentStudent) { msgEl.innerText="Not logged in."; return; }
    const code = (inputEl.value||"").trim();
    if (!code) { msgEl.innerText="Enter code."; return; }
    if (!onlineAttendance) { msgEl.innerText="No active code or expired."; return; }
    if (onlineAttendance.expiresAt <= Date.now()) {
        msgEl.innerText="Code expired.";
        onlineAttendance=null;
        saveToStorage();
        return;
    }
    if (code !== onlineAttendance.code) {
        msgEl.innerText="You have entered wrong attendance code.";
        return;
    }
    const today = getTodayDateStr();
    setAttendance(currentStudent.id, onlineAttendance.subject, today, "P");
    saveToStorage();
    msgEl.innerText = `You have entered right attendance code for ${onlineAttendance.subject}.`;
    inputEl.value="";
    renderStudentDashboard();
}

/* -------- LOGIN / LOGOUT -------- */
function handleLogin(e) {
    e.preventDefault();
    const uname = document.getElementById("username").value.trim();
    const pass  = document.getElementById("password").value.trim();
    const err   = document.getElementById("login-error");
    const user = users.find(u=>u.username===uname && u.password===pass);
    if (!user) { err.innerText="Invalid username or password."; return; }
    err.innerText="";
    currentUser=user;
    if (user.role==="STUDENT") {
        currentStudent = findStudentById(user.studentId);
        renderStudentDashboard();
        showPage("student-dashboard");
    } else {
        currentStudent=null;
        renderAdminTable();
        fillStudentSelects();
        showTeachingPanel();
        const ts = document.getElementById("teach-student");
        if (ts.value) loadMarksIntoForm(ts.value);
        const fs = document.getElementById("fin-student");
        if (fs.value) loadFinanceFor(fs.value);
        showPage("admin-dashboard");
    }
}

function handleLogout() {
    currentUser=null;
    currentStudent=null;
    document.getElementById("login-form").reset();
    document.getElementById("login-error").innerText="";
    showPage("login-page");
}

/* -------- INIT -------- */
document.addEventListener("DOMContentLoaded", () => {
    showPage("login-page");

    document.getElementById("login-form").addEventListener("submit", handleLogin);
    document.getElementById("student-logout").addEventListener("click", handleLogout);
    document.getElementById("admin-logout").addEventListener("click", handleLogout);

    document.getElementById("btn-save-marks").addEventListener("click", handleSaveMarks);
    document.getElementById("teach-student").addEventListener("change", e=>loadMarksIntoForm(e.target.value));
    document.getElementById("fin-student").addEventListener("change", e=>loadFinanceFor(e.target.value));
    document.getElementById("btn-fin-pay").addEventListener("click", handleFinancePay);
    document.getElementById("btn-add").addEventListener("click", handleAddStudent);
    document.getElementById("btn-delete").addEventListener("click", handleDeleteStudent);

    document.getElementById("mode-teaching").addEventListener("click", showTeachingPanel);
    document.getElementById("mode-finance").addEventListener("click", showFinancePanel);
    document.getElementById("mode-students").addEventListener("click", showStudentPanel);

    document.getElementById("student-pass-btn").addEventListener("click", ()=>openPasswordModal("STUDENT"));
    document.getElementById("admin-pass-btn").addEventListener("click", ()=>openPasswordModal("ADMIN"));
    document.getElementById("pw-save").addEventListener("click", handlePasswordSave);
    document.getElementById("pw-cancel").addEventListener("click", closePasswordModal);
    document.querySelector("#password-modal .modal-backdrop")
        .addEventListener("click", closePasswordModal);

    document.getElementById("admin-att-btn").addEventListener("click", openAttendanceModal);
    document.getElementById("att-cancel-btn").addEventListener("click", closeAttendanceModal);
    document.querySelector("#attendance-modal .modal-backdrop")
        .addEventListener("click", closeAttendanceModal);
    document.getElementById("att-subject-select").addEventListener("change", ()=>{
        renderAttendanceStudentRows();
        updateOnlineAttendanceUI(true);
    });
    document.getElementById("btn-generate-code").addEventListener("click", handleGenerateCode);
    document.getElementById("att-save-btn").addEventListener("click", handleAttendanceSaveFromModal);

    document.getElementById("st-att-submit").addEventListener("click", handleStudentCodeSubmit);
});