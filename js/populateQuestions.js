// populateQuestions.js  (full rewrite)
// Assumptions: master syllabus JSON at ./js/mastersyllabustopic.json
//              questions repo JSON at ./js/pyqrepository.json
// Exposes: getSelectedQuestions() -> Array of selected question objects (used by generatePDF.js)
//
// Selection model
// ---------------
// The user builds a list out of "sets" (batches). Each set is one combination
// (e.g. years 2014 + paper GS1, or Random GS3 x10). Sets accumulate, so
// 2014 GS1 and 2017 GS4 can live in the same list. Everything added is
// checked by default.

let masterSyllabus = [];
let questionsRepo = [];
let currentMode = "year-gs";

let currentSourceFileName = "";
window.currentSourceFileName = "";

const selectionMap = new Map();   // _selectionId -> true/false
const repoById = new Map();       // _selectionId -> question object

let customQuestions = [];
let customCounter = 1;
let importedMarkdown = false;

let batches = [];                 // { id, label, ids: [_selectionId] }
let batchCounter = 1;

const pickedYears = new Set();
const pickedPapers = new Set();

// DOM refs
const tbody = document.querySelector("#questionsTable tbody");
const selectAllCheckbox = document.getElementById("selectAll");
const summaryDiv = document.getElementById("selectedSummary");
const selectedCountSpan = document.getElementById("selectedCount");
const totalMarksSpan = document.getElementById("totalMarks");
const count10Span = document.getElementById("count10");
const count15Span = document.getElementById("count15");
const emptyState = document.getElementById("emptyState");
const statusMsg = document.getElementById("statusMsg");

const yearChipsDiv = document.getElementById("yearChips");
const paperChipsDiv = document.getElementById("paperChips");
const matchInfo = document.getElementById("matchInfo");
const addSetBtn = document.getElementById("addSetBtn");

const gsPaperFilter2 = document.getElementById("gsPaperFilter2");
const syllabusFilter = document.getElementById("syllabusFilter");
const addSyllabusSetBtn = document.getElementById("addSyllabusSetBtn");
const syllabusMatchInfo = document.getElementById("syllabusMatchInfo");

const batchListDiv = document.getElementById("batchList");

const ACTION_BUTTON_IDS = [
  "generateQCAB",
  "downloadQuestions",
  "downloadAnswersBooklet",
  "exportMarkdown"
];

const repo = () => questionsRepo.questions_repository;

// ---------------------- Init ----------------------
(async function init() {
  try {
    const msResp = await fetch("./js/mastersyllabustopic.json");
    masterSyllabus = await msResp.json();

    const qResp = await fetch("./js/pyqrepository.json");
    questionsRepo = await qResp.json();

    if (!masterSyllabus || !masterSyllabus.official_syllabus_topics) {
      console.error("masterSyllabus missing or malformed");
      masterSyllabus = { official_syllabus_topics: [] };
    }
    if (!questionsRepo || !questionsRepo.questions_repository) {
      console.error("questionsRepo missing or malformed");
      questionsRepo = { questions_repository: [] };
    }

    // Give every repository question a unique internal ID.
    // question_id itself is kept for display and may legitimately repeat.
    repo().forEach((q, index) => {
      q._selectionId = `repo_${index}`;
      repoById.set(q._selectionId, q);
    });

    buildYearAndPaperChips();
    buildSyllabusPaperSelect();
    wireBuilder();
    renderBatches();
    renderTable();
  } catch (err) {
    console.error("Error loading JSON files:", err);
    alert("Failed to load JSON files. Check console for details.");
  }
})();

// ---------------------- Small helpers ----------------------
function setStatus(msg) {
  statusMsg.textContent = msg || "";
}

function paperSortKey(p) {
  const l = String(p).toLowerCase();
  if (l === "essay") return "0" + l;
  if (/^gs[1-4]$/.test(l)) return "1" + l;
  return "2" + l;
}

function questionLookupMap() {
  const m = new Map(repoById);
  customQuestions.forEach(q => m.set(q._selectionId, q));
  return m;
}

// Repo questions currently shown (in the order the sets were added)
function shownQuestions() {
  const seen = new Set();
  const out = [];

  batches.forEach(b => b.ids.forEach(id => {
    if (seen.has(id)) return;
    seen.add(id);
    const q = repoById.get(id);
    if (q) out.push(q);
  }));

  return out;
}

// Selected questions in table order (repo rows first, then custom rows)
function getSelectedQuestionsOrdered() {
  const selected = [];

  shownQuestions().forEach(q => {
    if (selectionMap.get(q._selectionId)) selected.push(q);
  });

  customQuestions.forEach(q => {
    if (selectionMap.get(q._selectionId)) selected.push(q);
  });

  return selected;
}

// expose to global so generatePDF.js can call it
window.getSelectedQuestions = getSelectedQuestionsOrdered;

// ---------------------- Builder: chips ----------------------
function makeChip(container, value, set, onChange) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "chip";
  b.textContent = value;
  b.dataset.value = value;
  b.setAttribute("aria-pressed", "false");

  b.addEventListener("click", () => {
    if (set.has(value)) set.delete(value); else set.add(value);
    syncChips();
    onChange();
  });

  container.appendChild(b);
}

function syncChips() {
  yearChipsDiv.querySelectorAll(".chip").forEach(b => {
    const on = pickedYears.has(b.dataset.value);
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", String(on));
  });

  paperChipsDiv.querySelectorAll(".chip").forEach(b => {
    const on = pickedPapers.has(b.dataset.value);
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", String(on));
  });
}

function buildYearAndPaperChips() {
  const years = Array.from(
    new Set(repo().map(q => String(q.year)))
  ).sort((a, b) => Number(a) - Number(b));

  const papers = Array.from(
    new Set(repo().map(q => q.gs_paper).filter(Boolean))
  ).sort((a, b) => paperSortKey(a).localeCompare(paperSortKey(b)));

  yearChipsDiv.innerHTML = "";
  paperChipsDiv.innerHTML = "";

  years.forEach(y => makeChip(yearChipsDiv, y, pickedYears, updateMatchInfo));
  papers.forEach(p => makeChip(paperChipsDiv, p, pickedPapers, updateMatchInfo));

  document.getElementById("yearsAll").onclick = () => {
    years.forEach(y => pickedYears.add(y));
    syncChips();
    updateMatchInfo();
  };

  document.getElementById("yearsClear").onclick = () => {
    pickedYears.clear();
    syncChips();
    updateMatchInfo();
  };

  document.getElementById("papersAll").onclick = () => {
    papers.forEach(p => pickedPapers.add(p));
    syncChips();
    updateMatchInfo();
  };

  document.getElementById("papersClear").onclick = () => {
    pickedPapers.clear();
    syncChips();
    updateMatchInfo();
  };
}

function yearGsMatches() {
  if (!pickedYears.size && !pickedPapers.size) return [];

  return repo().filter(q =>
    (!pickedYears.size || pickedYears.has(String(q.year))) &&
    (!pickedPapers.size || pickedPapers.has(q.gs_paper))
  );
}

function updateMatchInfo() {
  const matches = yearGsMatches();

  if (!pickedYears.size && !pickedPapers.size) {
    matchInfo.textContent = "Pick at least one year or paper.";
    addSetBtn.disabled = true;
    return;
  }

  const already = matches.filter(q => batchIdsSet().has(q._selectionId)).length;

  matchInfo.textContent =
    matches.length === 0
      ? "No questions match this combination."
      : `${matches.length} question${matches.length === 1 ? "" : "s"} match` +
        (already ? ` (${already} already in the list)` : "");

  addSetBtn.disabled = matches.length === 0;
}

function batchIdsSet() {
  return new Set(batches.flatMap(b => b.ids));
}

function summarizeSet(set, sortFn, noun, allLabel) {
  const arr = [...set].sort(sortFn);
  if (arr.length === 0) return allLabel;
  if (arr.length <= 4) return arr.join(", ");
  return `${arr.length} ${noun}`;
}

// ---------------------- Builder: syllabus mode ----------------------
function buildSyllabusPaperSelect() {
  const papers = Array.from(
    new Set(repo().map(q => q.gs_paper).filter(Boolean))
  ).sort((a, b) => paperSortKey(a).localeCompare(paperSortKey(b)));

  papers.forEach(p => gsPaperFilter2.add(new Option(p, p)));
}

// populate syllabus select keeping master syllabus order, only topics used by questions for that GS paper
function populateSyllabusOptions(gsVal) {
  syllabusFilter.innerHTML = "<option value=''>-- Select Syllabus Topic --</option>";
  if (!gsVal) return;

  const masterArr = masterSyllabus.official_syllabus_topics || [];

  const usedTopicSet = new Set(
    repo()
      .filter(q => q.gs_paper === gsVal)
      .flatMap(q => q.official_syllabus_topics || [])
  );

  masterArr.forEach(topic => {
    if (topic.gs_paper === gsVal && usedTopicSet.has(topic.id)) {
      syllabusFilter.add(new Option(topic.description, topic.id));
    }
  });
}

function syllabusMatches() {
  const gs = gsPaperFilter2.value;
  const topic = syllabusFilter.value;

  if (!gs) return [];

  return repo().filter(q =>
    q.gs_paper == gs &&
    (!topic || (q.official_syllabus_topics || []).includes(topic))
  );
}

function updateSyllabusMatchInfo() {
  const matches = syllabusMatches();

  if (!gsPaperFilter2.value) {
    syllabusMatchInfo.textContent = "Pick a GS paper (and optionally a topic).";
    addSyllabusSetBtn.disabled = true;
    return;
  }

  syllabusMatchInfo.textContent =
    matches.length === 0
      ? "No questions match this combination."
      : `${matches.length} question${matches.length === 1 ? "" : "s"} match`;

  addSyllabusSetBtn.disabled = matches.length === 0;
}

// ---------------------- Builder wiring ----------------------
function wireBuilder() {

  // Tabs
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      currentMode = tab.dataset.mode;

      document.querySelectorAll(".tab").forEach(t =>
        t.classList.toggle("active", t === tab)
      );

      document.getElementById("modeYearGs").hidden = currentMode !== "year-gs";
      document.getElementById("modeSyllabus").hidden = currentMode !== "gs-syllabus";
    });
  });

  // Year + Paper -> add set
  addSetBtn.onclick = () => {
    const matches = yearGsMatches();

    const years = summarizeSet(
      pickedYears, (a, b) => Number(a) - Number(b), "years", "All years"
    );
    const papers = summarizeSet(
      pickedPapers,
      (a, b) => paperSortKey(a).localeCompare(paperSortKey(b)),
      "papers",
      "All papers"
    );

    addBatch(`${years} · ${papers}`, matches);

    // Clear the chips so the next combination starts fresh
    pickedYears.clear();
    pickedPapers.clear();
    syncChips();
    updateMatchInfo();
  };

  // Syllabus mode
  gsPaperFilter2.addEventListener("change", () => {
    populateSyllabusOptions(gsPaperFilter2.value);
    updateSyllabusMatchInfo();
  });

  syllabusFilter.addEventListener("change", updateSyllabusMatchInfo);

  addSyllabusSetBtn.onclick = () => {
    const matches = syllabusMatches();
    const gs = gsPaperFilter2.value;

    let label = `${gs} · All topics`;

    if (syllabusFilter.value) {
      const text = syllabusFilter.options[syllabusFilter.selectedIndex].text;
      label = `${gs} · ${text.length > 45 ? text.slice(0, 45) + "…" : text}`;
    }

    addBatch(label, matches);
  };

  // Extras
  document.getElementById("addCustomBtn").onclick = () => {
    const panel = document.getElementById("customQuestionPanel");
    panel.hidden = !panel.hidden;
  };

  document.getElementById("addCustomQuestions").onclick = () => {
    const ten = Number(document.getElementById("custom10").value);
    const fifteen = Number(document.getElementById("custom15").value);
    const twenty = Number(document.getElementById("custom20").value);

    addCustomQuestions(10, ten);
    addCustomQuestions(15, fifteen);
    addCustomQuestions(20, twenty);

    document.getElementById("custom10").value = 0;
    document.getElementById("custom15").value = 0;
    document.getElementById("custom20").value = 0;
  };

  document.getElementById("randomBtn").onclick = () => {
    const panel = document.getElementById("randomQuestionPanel");
    populateRandomSubjectOptions();
    panel.hidden = !panel.hidden;
  };

  document.getElementById("generateRandomQuestions").onclick =
    generateRandomQuestions;

  updateMatchInfo();
  updateSyllabusMatchInfo();
}

// ---------------------- Sets (batches) ----------------------
function addBatch(label, list) {
  if (!list.length) return;

  const existing = batchIdsSet();
  const fresh = list.filter(q => !existing.has(q._selectionId));

  // Everything added is checked by default
  list.forEach(q => selectionMap.set(q._selectionId, true));

  if (fresh.length === 0) {
    setStatus("Those questions were already in the list. They are selected again.");
    renderTable();
    return;
  }

  batches.push({
    id: batchCounter++,
    label,
    ids: list.map(q => q._selectionId)
  });

  const skipped = list.length - fresh.length;

  setStatus(
    `Added ${fresh.length} question${fresh.length === 1 ? "" : "s"}` +
    (skipped ? ` (${skipped} were already in the list).` : ".")
  );

  renderBatches();
  renderTable();
  updateMatchInfo();
}

function removeBatch(id) {
  const removed = batches.find(b => b.id === id);
  if (!removed) return;

  batches = batches.filter(b => b.id !== id);

  const stillUsed = batchIdsSet();

  removed.ids.forEach(qid => {
    if (!stillUsed.has(qid)) selectionMap.delete(qid);
  });

  setStatus("");
  renderBatches();
  renderTable();
  updateMatchInfo();
}

function renderBatches() {
  batchListDiv.innerHTML = "";
  batchListDiv.hidden = batches.length === 0;

  batches.forEach(b => {
    const pill = document.createElement("span");
    pill.className = "batch";

    const text = document.createElement("span");
    text.textContent = b.label + " ";

    const count = document.createElement("span");
    count.className = "count";
    count.textContent = `(${b.ids.length})`;

    const x = document.createElement("button");
    x.type = "button";
    x.title = "Remove this set";
    x.setAttribute("aria-label", `Remove ${b.label}`);
    x.textContent = "×";
    x.onclick = () => removeBatch(b.id);

    pill.append(text, count, x);
    batchListDiv.appendChild(pill);
  });

  populateRandomSubjectOptions();
}

// ---------------------- Random question logic ----------------------
// Random works on the questions already in the list (the added sets).
// It checks N random questions from that pool and unchecks the rest of the pool.

function populateRandomSubjectOptions() {

  const subjectSelect = document.getElementById("randomSubject");
  if (!subjectSelect) return;

  const currentValue = subjectSelect.value;
  const pool = shownQuestions();

  const counts = new Map();

  pool.forEach(q => {
    const paper = String(q.gs_paper || "").trim();
    if (paper) counts.set(paper, (counts.get(paper) || 0) + 1);
  });

  subjectSelect.innerHTML = "";

  subjectSelect.add(new Option(`All questions in list (${pool.length})`, ""));

  [...counts.keys()]
    .sort((a, b) => paperSortKey(a).localeCompare(paperSortKey(b)))
    .forEach(paper => {
      subjectSelect.add(new Option(`${paper} (${counts.get(paper)})`, paper));
    });

  if (Array.from(subjectSelect.options).some(o => o.value === currentValue)) {
    subjectSelect.value = currentValue;
  }
}

function generateRandomQuestions() {

  const countInput = document.getElementById("randomQuestionCount");
  const subjectSelect = document.getElementById("randomSubject");

  const count = Math.floor(Number(countInput?.value));
  const subject = String(subjectSelect?.value || "").trim();

  if (!Number.isFinite(count) || count < 1) {
    alert("Enter a valid number of questions.");
    return;
  }

  const all = shownQuestions();

  if (all.length === 0) {
    alert("Add some sets to the list first. Random picks from the questions in your list.");
    return;
  }

  const pool = subject
    ? all.filter(q => String(q.gs_paper || "").trim() === subject)
    : all;

  if (count > pool.length) {
    alert(`Only ${pool.length} question${pool.length === 1 ? " is" : "s are"} available to pick from.`);
    return;
  }

  // Shuffle a copy of the pool
  const shuffled = pool.slice();

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const chosen = new Set(
    shuffled.slice(0, count).map(q => q._selectionId)
  );

  // Chosen -> checked, rest of the pool -> unchecked
  pool.forEach(q => {
    selectionMap.set(q._selectionId, chosen.has(q._selectionId));
  });

  setStatus(`Randomly selected ${count} of ${pool.length} questions.`);

  renderTable();
}

// ---------------------- Table rendering ----------------------
function renderTable() {
  tbody.innerHTML = "";

  buildTableRows(shownQuestions());
  customQuestions.forEach(appendCustomRow);

  updateSelectAllState();
  updateSummary();
}

// build rows using createElement
function buildTableRows(questionList) {
  questionList.forEach(q => {
    const tr = document.createElement("tr");

    // Checkbox cell
    const tdCheckbox = document.createElement("td");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.dataset.qid = q._selectionId;

    if (selectionMap.get(q._selectionId)) {
      cb.checked = true;
      tr.classList.add("selected");
    }

    cb.addEventListener("change", (e) => {
      const checked = e.target.checked;

      selectionMap.set(q._selectionId, checked);
      tr.classList.toggle("selected", checked);

      updateSummary();
      updateSelectAllState();
    });

    tdCheckbox.appendChild(cb);
    tr.appendChild(tdCheckbox);

    // Year
    const tdYear = document.createElement("td");
    tdYear.textContent = q.year;
    tr.appendChild(tdYear);

    // GS Paper
    const tdGS = document.createElement("td");
    tdGS.textContent = q.gs_paper;
    tr.appendChild(tdGS);

    // Question text
    const tdText = document.createElement("td");
    tdText.textContent = q.question_text;
    tdText.style.whiteSpace = "pre-wrap";
    tr.appendChild(tdText);

    // Marks
    const tdMarks = document.createElement("td");
    tdMarks.textContent = q.marks;
    tr.appendChild(tdMarks);

    // Word limit
    const tdWord = document.createElement("td");
    tdWord.textContent = q.word_limit;
    tr.appendChild(tdWord);

    tbody.appendChild(tr);
  });
}

// update selectAll checkbox state based on visible checkboxes
function updateSelectAllState() {
  const visibleCbs = Array.from(tbody.querySelectorAll("input[type='checkbox']"));

  if (visibleCbs.length === 0) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
    return;
  }

  const checkedCount = visibleCbs.filter(cb => cb.checked).length;

  if (checkedCount === 0) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
  } else if (checkedCount === visibleCbs.length) {
    selectAllCheckbox.checked = true;
    selectAllCheckbox.indeterminate = false;
  } else {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = true;
  }
}

// Select-all toggles every row in the table
selectAllCheckbox.addEventListener("change", function () {
  const checked = this.checked;

  Array.from(tbody.querySelectorAll("tr")).forEach(tr => {
    const cb = tr.querySelector("input[type='checkbox']");
    if (!cb) return;

    cb.checked = checked;
    selectionMap.set(cb.dataset.qid, checked);
    tr.classList.toggle("selected", checked);
  });

  updateSummary();
  selectAllCheckbox.indeterminate = false;
});

// summary across ALL selected items
function updateSummary() {
  const lookup = questionLookupMap();

  let totalSelected = 0;
  let totalMarks = 0;
  let count10 = 0;
  let count15 = 0;

  for (const [qid, sel] of selectionMap.entries()) {
    if (!sel) continue;
    const q = lookup.get(qid);
    if (!q) continue;

    totalSelected += 1;

    const marks = Number(q.marks) || 0;
    totalMarks += marks;

    if (marks === 10) count10++;
    if (marks === 15) count15++;
  }

  selectedCountSpan.textContent = String(totalSelected);
  totalMarksSpan.textContent = String(totalMarks);
  count10Span.textContent = String(count10);
  count15Span.textContent = String(count15);

  // Download buttons are only useful when something is selected
  ACTION_BUTTON_IDS.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = totalSelected === 0;
  });

  emptyState.hidden = tbody.children.length > 0;
}

// ---------------------- Custom questions ----------------------
function addCustomQuestions(marks, count) {

  const wordLimit =
    marks == 10 ? 150 :
    marks == 15 ? 250 :
    300;

  const prefix = currentSourceFileName;

  for (let i = 0; i < count; i++) {

    const q = {
      question_id: `${prefix}_Q${customCounter}`,
      question_text: "",
      year: "",
      marks: marks,
      word_limit: wordLimit,
      gs_paper: "",
      official_syllabus_topics: []
    };

    q._selectionId = `custom_${customCounter}`;

    customCounter++;
    customQuestions.push(q);
    selectionMap.set(q._selectionId, true);
    appendCustomRow(q);
  }

  updateSelectAllState();
  updateSummary();
}

function appendCustomRow(q) {

  const tr = document.createElement("tr");

  const isSelected = !!selectionMap.get(q._selectionId);
  tr.classList.toggle("selected", isSelected);

  // Checkbox
  const td0 = document.createElement("td");
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = isSelected;
  cb.dataset.qid = q._selectionId;

  cb.onchange = () => {
    selectionMap.set(q._selectionId, cb.checked);
    tr.classList.toggle("selected", cb.checked);
    updateSummary();
    updateSelectAllState();
  };

  td0.appendChild(cb);
  tr.appendChild(td0);

  // Year
  const td1 = document.createElement("td");
  td1.textContent = q.year || "-";
  tr.appendChild(td1);

  // GS Paper
  const td2 = document.createElement("td");
  td2.textContent = q.gs_paper || "-";
  tr.appendChild(td2);

  // Question
  const td3 = document.createElement("td");
  const ta = document.createElement("textarea");
  ta.rows = 3;
  ta.style.width = "98%";
  ta.value = q.question_text;
  ta.oninput = () => { q.question_text = ta.value; };
  td3.appendChild(ta);
  tr.appendChild(td3);

  // Marks
  const td4 = document.createElement("td");
  td4.textContent = q.marks;
  tr.appendChild(td4);

  // Word Limit
  const td5 = document.createElement("td");
  td5.textContent = q.word_limit;
  tr.appendChild(td5);

  tbody.appendChild(tr);
}

// ---------------------- Reset ----------------------
document.getElementById("resetQuestions").addEventListener("click", () => {

  if (!confirm("Remove all selected and custom questions?")) return;

  selectionMap.clear();
  batches = [];
  customQuestions = [];
  customCounter = 1;
  importedMarkdown = false;

  currentSourceFileName = "";
  window.currentSourceFileName = "";

  pickedYears.clear();
  pickedPapers.clear();
  syncChips();

  gsPaperFilter2.value = "";
  populateSyllabusOptions("");

  document.getElementById("customQuestionPanel").hidden = true;
  document.getElementById("randomQuestionPanel").hidden = true;

  setStatus("");
  renderBatches();
  renderTable();
  updateMatchInfo();
  updateSyllabusMatchInfo();
});

// ---------------------- Export Markdown ----------------------
// Format (same one the importer reads):
//
//   2014 Essay
//
//   - Q1. Question text [125]
//
// With several papers, each paper gets its own "YYYY Paper" line,
// separated from the previous paper by a blank line.
document.getElementById("exportMarkdown").addEventListener("click", () => {

  const questions = window.getSelectedQuestions();

  if (questions.length === 0) {
    alert("No questions selected.");
    return;
  }

  const years = [...new Set(questions.map(q => q.year).filter(Boolean))];
  const subjects = [...new Set(questions.map(q => q.gs_paper).filter(Boolean))];

  let mdFileName;

  if (years.length === 1 && subjects.length === 1) {
    mdFileName = `${years[0]}_${subjects[0]}.md`;
  } else {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");

    mdFileName = prompt(
      "Enter Markdown filename:",
      `${yyyy}-${mm}-${dd}-Q`
    );

    if (!mdFileName) {
      mdFileName = `${yyyy}-${mm}-${dd}-Q`;
    }

    mdFileName = `${mdFileName.replace(/\.md$/i, "")}.md`;
  }

  // Group by paper (year + subject), keeping first-appearance order
  const groups = new Map();

  questions.forEach(q => {
    const key = `${q.year || ""}|${q.gs_paper || ""}`;

    if (!groups.has(key)) {
      groups.set(key, { year: q.year || "", paper: q.gs_paper || "", list: [] });
    }

    groups.get(key).list.push(q);
  });

  let md = "";
  let firstGroup = true;

  groups.forEach(g => {

    g.list.sort((a, b) => a.marks - b.marks);

    if (!firstGroup) md += "\n";
    firstGroup = false;

    // Subject line at the top, e.g. "2014 Essay"
    if (g.year && g.paper) {
      md += `${g.year} ${g.paper}\n\n`;
    }

    g.list.forEach((q, index) => {
      // Use the question number from question_id so sub-parts
      // such as Q02(a) and Q02(b) stay under the same number.
      const match = q.question_id?.match(/_Q(\d+)$/);

      const questionNumber = match ? Number(match[1]) : index + 1;

      md += `- Q${questionNumber}. ${q.question_text.trim()} [${q.marks}]\n`;
    });
  });

  const blob = new Blob([md], { type: "text/markdown" });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = mdFileName;
  a.click();

  URL.revokeObjectURL(a.href);
});

// ---------------------- Import Markdown ----------------------
document.getElementById("importMarkdown")
  .addEventListener("click", () => {
    document.getElementById("importMarkdownFile").click();
  });

document.getElementById("importMarkdownFile")
  .addEventListener("change", importMarkdownFile);

function importMarkdownFile(e) {

  const file = e.target.files[0];

  if (!file) return;

  currentSourceFileName = file.name.replace(/\.[^.]+$/, "");
  window.currentSourceFileName = currentSourceFileName;

  importedMarkdown = true;

  const reader = new FileReader();

  reader.onload = () => {
    importMarkdownQuestions(reader.result);

    // Allow importing the same file again later
    e.target.value = "";
  };

  reader.readAsText(file);
}

// ---------------------- Smart marks ----------------------
// Paper type from its name:
//   Essay            -> every question is 125 marks
//   GS (GS1..GS4)    -> Q1-10 = 10 marks, Q11-20 = 15 marks
//   anything else    -> optional paper (PSIR, Sociology, Law, Anthropology ...)
//                       Q1 and Q5: parts (a)-(e) are 10 marks each
//                       Q2,3,4 and Q6,7,8: (a) = 20, (b) = 20, (c) = 10
function paperKind(paper) {
  const p = String(paper || "").trim().toLowerCase();

  if (!p) return "unknown";
  if (p === "essay") return "essay";
  if (p.startsWith("gs")) return "gs";

  return "optional";
}

// partIndex: 0 for (a), 1 for (b), 2 for (c) ...
function inferMarks(kind, questionNumber, partIndex) {

  if (kind === "essay") return 125;

  if (kind === "gs") {
    if (questionNumber >= 1 && questionNumber <= 10) return 10;
    if (questionNumber >= 11 && questionNumber <= 20) return 15;
    return null;
  }

  if (kind === "optional") {
    if (questionNumber === 1 || questionNumber === 5) return 10;

    if ([2, 3, 4, 6, 7, 8].includes(questionNumber)) {
      return partIndex <= 1 ? 20 : 10;
    }

    return null;
  }

  return null;
}

function importMarkdownQuestions(md) {

  document.getElementById("customQuestionPanel").hidden = false;

  // =========================================================
  // 1. Split Markdown into complete question blocks
  // =========================================================

  const lines = md.split(/\r?\n/);

  const MARKS_RE = /\[(\d+(?:\.\d+)?)\]\s*$/;

  // Subject line(s): "Year/Subject + GS Paper", e.g. "2026 Essay",
  // "Vision 0502", "Forum GS3". The final token becomes GS Paper,
  // everything before it Year/Subject.
  //
  // The first non-empty line is a subject line if it is not a question.
  // Later ones (a file with several papers, as written by "Export .md")
  // are recognised when they sit directly before a "- Q<n>." line and
  //   - the previous question is already complete (ends with its [marks]), or
  //   - they follow a blank line and are short.
  // Blank lines are always ignored.

  const isQuestionLine = t => /^-\s*Q\d+\./i.test(t);

  const nextNonEmpty = i => {
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trim() !== "") return lines[j].trim();
    }
    return null;
  };

  const firstContentIndex = lines.findIndex(line => line.trim() !== "");

  let importYear = "";
  let importGsPaper = "";

  const questionBlocks = [];
  let currentBlock = null;

  const blockComplete = () =>
    currentBlock && MARKS_RE.test(currentBlock.lines.join("\n"));

  const isSubjectLine = i => {
    const t = lines[i].trim();

    if (!t || isQuestionLine(t)) return false;

    if (i === firstContentIndex) return true;

    const next = nextNonEmpty(i);
    if (next === null || !isQuestionLine(next)) return false;

    const parts = t.split(/\s+/);

    if (blockComplete()) return parts.length <= 8;

    return lines[i - 1].trim() === "" && parts.length >= 2 && parts.length <= 6;
  };

  lines.forEach((line, i) => {

    const trimmed = line.trim();

    if (isSubjectLine(i)) {

      // "2019 Political Science" -> year 2019, paper "Political Science".
      // Otherwise the final token is the paper ("Vision 0502 GS3").
      const yearFirst = trimmed.match(/^(\d{4})\s+(.+)$/);

      if (yearFirst) {
        importYear = yearFirst[1];
        importGsPaper = yearFirst[2].trim();
      } else {
        const parts = trimmed.split(/\s+/);

        importGsPaper = parts[parts.length - 1];
        importYear = parts.slice(0, -1).join(" ");
      }

      return;
    }

    // A new question starts only with "- Q<number>."
    // Everything else belongs to the current question.
    const match = trimmed.match(/^- Q(\d+)\.\s*(.*)$/);

    if (match) {

      if (currentBlock) {
        questionBlocks.push(currentBlock);
      }

      currentBlock = {
        questionNumber: Number(match[1]),
        year: importYear,
        paper: importGsPaper,
        lines: []
      };

      if (match[2].trim() !== "") {
        currentBlock.lines.push(match[2].trim());
      }

    } else if (currentBlock && trimmed !== "") {
      currentBlock.lines.push(trimmed);
    }
  });

  if (currentBlock) {
    questionBlocks.push(currentBlock);
  }

  if (questionBlocks.length === 0) {
    alert("No valid questions found.");
    return;
  }

  // =========================================================
  // 2. Combine multiline questions and read explicit marks
  // =========================================================

  const parsedQuestions = [];

  questionBlocks.forEach(block => {

    let question = block.lines.join("\n").trim();
    let marks = null;

    const match = question.match(MARKS_RE);

    if (match) {
      marks = Number(match[1]);
      question = question.replace(MARKS_RE, "").trim();
    }

    parsedQuestions.push({
      questionNumber: block.questionNumber,
      question: question,
      marks: marks,
      year: block.year,
      paper: block.paper
    });
  });

  // =========================================================
  // 3. Smart marks for questions that have none
  // =========================================================

  // Part index inside a question: Q1 repeated five times in a row
  // means parts (a)-(e). An explicit "(a)" / "b)" label wins.
  const partCounter = new Map();

  parsedQuestions.forEach(item => {

    const key = `${item.year}|${item.paper}|${item.questionNumber}`;
    const seen = partCounter.get(key) || 0;

    partCounter.set(key, seen + 1);

    const label = item.question.match(/^\(?([a-e])[\).]\s/i);

    item.part = label
      ? label[1].toLowerCase().charCodeAt(0) - 97
      : seen;
  });

  const explicitCount = parsedQuestions.filter(q => q.marks !== null).length;

  let inferredCount = 0;
  const unresolved = [];

  parsedQuestions.forEach(item => {

    if (item.marks !== null) return;

    const inferred = inferMarks(
      paperKind(item.paper),
      item.questionNumber,
      item.part
    );

    if (inferred !== null) {
      item.marks = inferred;
      inferredCount++;
    } else {
      unresolved.push(item);
    }
  });

  // Anything we still cannot work out (no subject line, or a question
  // number outside the known patterns)
  if (unresolved.length > 0) {

    const nothingKnown =
      explicitCount === 0 && inferredCount === 0;

    if (nothingKnown && !confirm(
      "No marks were found in the Markdown and the paper type is unknown.\n\n" +
      "Import anyway?"
    )) {
      return;
    }

    // Existing behaviour when nothing is known:
    // exactly 20 questions -> first 10 = 10 marks, next 10 = 15 marks.
    // Otherwise 10 marks.
    if (nothingKnown && parsedQuestions.length === 20) {
      parsedQuestions.forEach((q, i) => {
        q.marks = i < 10 ? 10 : 15;
      });
    } else {
      unresolved.forEach(q => {
        q.marks = 10;
      });
    }
  }

  // =========================================================
  // 4. Create the question objects
  // =========================================================

  parsedQuestions.forEach(item => {

    const wordLimit =
      item.marks === 10 ? 150 :
      item.marks === 15 ? 250 :
      item.marks === 20 ? 250 :
      item.marks === 125 ? 1200 :
      300;

    // question_id is the DISPLAY question number, so Q1(a) and Q1(b)
    // deliberately share the same question_id.
    const questionId = `${currentSourceFileName}_Q${item.questionNumber}`;

    // _selectionId is the UNIQUE INTERNAL ID, so Q1(a) and Q1(b)
    // do not collide in selectionMap.
    const selectionId = `${currentSourceFileName}_import_${customCounter}`;

    const q = {
      question_id: questionId,
      _selectionId: selectionId,
      question_text: item.question,

      year: item.year,

      gs_paper:
        item.marks === 125
          ? "Essay"
          : item.paper,

      marks: item.marks,
      word_limit: wordLimit,
      official_syllabus_topics: []
    };

    customCounter++;

    customQuestions.push(q);

    // Selection uses _selectionId, NOT question_id
    selectionMap.set(q._selectionId, true);

    appendCustomRow(q);
  });

  setStatus(
    `Imported ${parsedQuestions.length} question${parsedQuestions.length === 1 ? "" : "s"}` +
    (inferredCount ? `. Marks worked out from the paper type for ${inferredCount}.` : ".")
  );

  updateSelectAllState();
  updateSummary();
}
