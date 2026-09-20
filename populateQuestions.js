// populateQuestions.js  (full rewrite)
// Assumptions: master syllabus JSON at ../js/mastersyllabustopic.json
//              questions repo JSON at ../js/pyqrepository.json
// Exposes: getSelectedQuestions() -> Array of selected question objects (use in PDF generator)

let masterSyllabus = [];
let questionsRepo = [];
let currentMode = "year-gs"; // default

let currentSourceFileName = "";

const selectionMap = new Map(); // key: question_id, value: true/false
let customQuestions = [];
let customCounter = 1;
let importedMarkdown = false;

// DOM refs
const filtersDiv = document.getElementById("filters");
const tbody = document.querySelector("#questionsTable tbody");
const selectAllCheckbox = document.getElementById("selectAll");
const summaryDiv = document.getElementById("selectedSummary");
const selectedCountSpan = document.getElementById("selectedCount");
const totalMarksSpan = document.getElementById("totalMarks");
const count10Span = document.getElementById("count10");
const count15Span = document.getElementById("count15");

// load JSONs and init
(async function init() {
  try {
    const msResp = await fetch('./js/mastersyllabustopic.json');
    masterSyllabus = await msResp.json();


    const qResp = await fetch('./js/pyqrepository.json');
questionsRepo = await qResp.json();

// Give every repository question a unique internal ID.
// question_id itself is retained for display purposes and may legitimately repeat.
questionsRepo.questions_repository.forEach((q, index) => {
    q._selectionId = `repo_${index}`;
});

    // sanity: ensure arrays exist
    if (!masterSyllabus || !masterSyllabus.official_syllabus_topics) {
      console.error("masterSyllabus missing or malformed");
      masterSyllabus = { official_syllabus_topics: [] };
    }
    if (!questionsRepo || !questionsRepo.questions_repository) {
      console.error("questionsRepo missing or malformed");
      questionsRepo = { questions_repository: [] };
    }

    wireModeToggle();
    setupFilters(); // initial UI for default mode
    updateSummary(); // initial summary (zero)
  } catch (err) {
    console.error("Error loading JSON files:", err);
    alert("Failed to load JSON files. Check console for details.");
  }
})();

// ---------------------- Helpers ----------------------
function resetSummaryUI() {
  summaryDiv.style.display = "none";
  selectedCountSpan.textContent = "0";
  totalMarksSpan.textContent = "0";
  count10Span.textContent = "0";
  count15Span.textContent = "0";
}

function wireModeToggle() {
  const radios = document.querySelectorAll("input[name='mode']");
  radios.forEach(r => r.addEventListener("change", e => {
    currentMode = e.target.value;
    // clear table UI but keep selectionMap (persist)
    tbody.innerHTML = "";
    selectAllCheckbox.checked = false;
    setupFilters();
  }));
}

// build a map for quick question lookup by id
function questionLookupMap() {
    const m = new Map();

    questionsRepo.questions_repository.forEach(q =>
        m.set(q._selectionId, q)
    );

customQuestions.forEach(q => {

    if (selectionMap.get(q._selectionId)) {
        selected.push(q);
    }

});
    return m;
}

// Return array of currently selected question objects (ordered by selection insertion)
function getSelectedQuestions() {

    const lookup = questionLookupMap();
    const arr = [];

for (const [qid, sel] of selectionMap.entries()) {

    if (sel && lookup.has(qid))
        arr.push(lookup.get(qid));
}

    return arr;
}

// ---------------------- Filters UI ----------------------
function setupFilters() {
  const randomPanel = document.getElementById("randomQuestionPanel");
  if (randomPanel) randomPanel.style.display = "none";
  filtersDiv.innerHTML = "";
  resetSummaryUI();
  tbody.innerHTML = "";
  selectAllCheckbox.checked = false;

  if (currentMode === "year-gs") {
filtersDiv.innerHTML = `
<select id="yearFilter">
<option value="">-- Select Year --</option>
</select>

<select id="gsPaperFilter">
<option value="">-- Select GS Paper --</option>
</select>

<button id="addCustomBtn" type="button">
Add your Own
</button>

<button id="randomBtn" type="button">
Random
</button>
`;

    const yearFilter = document.getElementById("yearFilter");
    const gsPaperFilter = document.getElementById("gsPaperFilter");

    // populate values (sorted)
    const years = Array.from(new Set(questionsRepo.questions_repository.map(q => q.year))).sort((a,b)=>a-b);
    const gsPapers = Array.from(new Set(questionsRepo.questions_repository.map(q => q.gs_paper)));

    years.forEach(y => yearFilter.add(new Option(y, y)));
    gsPapers.forEach(g => gsPaperFilter.add(new Option(g, g)));

    yearFilter.addEventListener("change", populateTable);
    gsPaperFilter.addEventListener("change", populateTable);

  } else { // gs-syllabus
filtersDiv.innerHTML = `
<select id="gsPaperFilter2">
<option value="">-- Select GS Paper --</option>
</select>

<select id="syllabusFilter">
<option value="">-- Select Syllabus Topic --</option>
</select>

<button id="addCustomBtn" type="button">
Add your Own
</button>

<button id="randomBtn" type="button">
Random
</button>
`;

    const gsPaperFilter2 = document.getElementById("gsPaperFilter2");
    const syllabusFilter = document.getElementById("syllabusFilter");

    const gsPapers = Array.from(new Set(questionsRepo.questions_repository.map(q => q.gs_paper)));
    gsPapers.forEach(g => gsPaperFilter2.add(new Option(g, g)));

    // when GS paper changes -> update syllabus options (ordered by masterSyllabus)
    gsPaperFilter2.addEventListener("change", () => {
      populateSyllabusOptions(gsPaperFilter2.value);
      populateTable(); // in case user expects immediate table update when GS paper alone chosen
    });

    // when a syllabus topic chosen -> populate table
    syllabusFilter.addEventListener("change", populateTable);
  }

document
.getElementById("addCustomBtn")
.onclick=()=>{

    const panel=document.getElementById("customQuestionPanel");

    panel.style.display=
        panel.style.display==="none"
        ?"block"
        :"none";


};

document
.getElementById("addCustomQuestions")
.onclick=()=>{

    const ten=
        Number(document.getElementById("custom10").value);

    const fifteen=
        Number(document.getElementById("custom15").value);

    const twenty=
        Number(document.getElementById("custom20").value);

    addCustomQuestions(10,ten);
    addCustomQuestions(15,fifteen);
    addCustomQuestions(20,twenty);

    document.getElementById("custom10").value=0;
    document.getElementById("custom15").value=0;
    document.getElementById("custom20").value=0;

};

  setupRandomButton();
}


// ---------------------- Random question logic ----------------------
function setupRandomButton() {
  const randomBtn = document.getElementById("randomBtn");
  if (!randomBtn) return;

  randomBtn.onclick = () => {
    const panel = document.getElementById("randomQuestionPanel");
    if (!panel) return;

    populateRandomGsPaperOptions();
    panel.style.display = panel.style.display === "none" ? "block" : "none";
  };

  const subjectSelect = document.getElementById("randomSubject");
  if (subjectSelect) {
    subjectSelect.onchange = () => {
      const gsSelect = document.getElementById("randomGsPaper");
      if (!gsSelect) return;
      gsSelect.style.display = subjectSelect.value === "gs-paper" ? "inline-block" : "none";
    };
  }

  const generateBtn = document.getElementById("generateRandomQuestions");
  if (generateBtn) generateBtn.onclick = generateRandomQuestions;
}

function populateRandomGsPaperOptions() {
  const gsSelect = document.getElementById("randomGsPaper");
  if (!gsSelect) return;

  const currentValue = gsSelect.value;
  gsSelect.innerHTML = "<option value=\"\">-- Select GS Paper --</option>";

  const gsPapers = Array.from(
    new Set(
      questionsRepo.questions_repository
        .map(q => q.gs_paper)
        .filter(g => g && String(g).trim().toLowerCase())
    )
  );

  gsPapers.forEach(g => gsSelect.add(new Option(g, g)));

  if (gsPapers.includes(currentValue)) gsSelect.value = currentValue;
}

function generateRandomQuestions() {
  const countInput = document.getElementById("randomQuestionCount");
  const subjectSelect = document.getElementById("randomSubject");
  const gsSelect = document.getElementById("randomGsPaper");

  const count = Math.floor(Number(countInput?.value));
  const subject = subjectSelect?.value || "";
  const gsPaper = gsSelect?.value || "";

  if (!Number.isFinite(count) || count < 1) {
    alert("Enter a valid number of questions.");
    return;
  }

  if (!subject) {
    alert("Select a subject.");
    return;
  }

  if (subject === "gs-paper" && !gsPaper) {
    alert("Select a GS Paper.");
    return;
  }

  let eligible = questionsRepo.questions_repository.filter(q => {
    const paper = String(q.gs_paper || "").trim();
    const paperLower = paper.toLowerCase();

    if (subject === "essay") {
        return paperLower === "essay";
    }

    if (subject === "gs") {
        return paperLower.startsWith("gs");
    }

    if (subject === "sociology") {
        return paperLower.startsWith("sociology");
    }

    return paper === gsPaper;
});

  if (eligible.length === 0) {
    alert("No questions found for the selected subject.");
    return;
  }

  // Prefer questions that are not already selected.
  const unselected = eligible.filter(q => !selectionMap.get(q._selectionId));
  if (unselected.length >= count) {
    eligible = unselected;
  } else if (eligible.length < count) {
    alert(`Only ${eligible.length} eligible questions are available.`);
    return;
  }

  // Fisher-Yates shuffle.
  for (let i = eligible.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
  }

  const selected = eligible.slice(0, count);

  // Sort ascending by marks: 10, 15, 20, 125, etc.
  selected.sort((a, b) => Number(a.marks || 0) - Number(b.marks || 0));

  selected.forEach(q => selectionMap.set(q._selectionId, true));

  // Populate the generated questions in the existing table.
  tbody.innerHTML = "";
  buildTableRows(selected);
  updateSummary();

  const panel = document.getElementById("randomQuestionPanel");
  if (panel) panel.style.display = "none";
}

// populate syllabus select keeping master syllabus order and only topics that are used by questions for that GS
function populateSyllabusOptions(gsVal) {
  const syllabusFilter = document.getElementById("syllabusFilter");
  if (!syllabusFilter) return;
  syllabusFilter.innerHTML = "<option value=''>-- Select Syllabus Topic --</option>";
  if (!gsVal) return;

  const masterArr = masterSyllabus.official_syllabus_topics || [];
  // preserve master order and include only topics that appear in questionsRepo for this GS paper
  const usedTopicSet = new Set(
    questionsRepo.questions_repository
      .filter(q => q.gs_paper === gsVal)
      .flatMap(q => q.official_syllabus_topics || [])
  );

  masterArr.forEach(topic => {
    if (topic.gs_paper === gsVal && usedTopicSet.has(topic.id)) {
      // use full description as option text (per your requirement)
      syllabusFilter.add(new Option(topic.description, topic.id));
    }
  });
}

// ---------------------- Table population & selection logic ----------------------
function populateTable() {

    tbody.innerHTML = "";

    // Compute questions matching current filter
    let filtered = [];

    if (currentMode === "year-gs") {

        const yearVal = document.getElementById("yearFilter")?.value || "";
        const gsVal   = document.getElementById("gsPaperFilter")?.value || "";

        if (!yearVal && !gsVal) {
            selectionMap.clear();
            updateSelectAllState();
            updateSummary();
            return;
        }

        filtered = questionsRepo.questions_repository.filter(q =>
            (yearVal ? q.year == yearVal : true) &&
            (gsVal ? q.gs_paper == gsVal : true)
        );

    } else {

        const gsVal = document.getElementById("gsPaperFilter2")?.value || "";
        const syllabusVal = document.getElementById("syllabusFilter")?.value || "";

        if (!gsVal && !syllabusVal) {
            selectionMap.clear();
            updateSelectAllState();
            updateSummary();
            return;
        }

        filtered = questionsRepo.questions_repository.filter(q =>
            (gsVal ? q.gs_paper == gsVal : true) &&
            (syllabusVal ? (q.official_syllabus_topics || []).includes(syllabusVal) : true)
        );
    }

    // Remove selections that are no longer visible
const visibleIds = new Set(filtered.map(q => q._selectionId));

    for (const qid of [...selectionMap.keys()]) {
        if (!visibleIds.has(qid)) {
            selectionMap.delete(qid);
        }
    }

    buildTableRows(filtered);
}

// build rows using createElement (never mix innerHTML after adding nodes)
function buildTableRows(questionList) {
  // keep order as in questionList
  questionList.forEach(q => {
    const tr = document.createElement("tr");

    // Checkbox cell
    const tdCheckbox = document.createElement("td");
    const cb = document.createElement("input");
    cb.type = "checkbox";

    cb.dataset.qid = q._selectionId;

    // set initial checked state from selectionMap (persisted across filters)
    if (selectionMap.get(q._selectionId)) {
      cb.checked = true;
      tr.classList.add("selected");
    }

    // when user toggles checkbox: update selectionMap & UI
    cb.addEventListener("change", (e) => {
      const checked = e.target.checked;

selectionMap.set(q._selectionId, checked);

      if (checked) tr.classList.add("selected"); else tr.classList.remove("selected");
      updateSummary();
      updateSelectAllState(); // reflect any change in select-all checkbox
    });

    tdCheckbox.appendChild(cb);
    tr.appendChild(tdCheckbox);

    // Year cell
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
tdText.style.whiteSpace = "pre-wrap";   // <-- Add this
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

  // After building rows, make sure selectAll checkbox reflects visible state
  updateSelectAllState();
  updateSummary();
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

// Select-all toggles only visible checkboxes and updates selectionMap accordingly
selectAllCheckbox.addEventListener("change", function () {
  const visibleRows = Array.from(tbody.querySelectorAll("tr"));
  const checked = this.checked;
  visibleRows.forEach(tr => {
    const cb = tr.querySelector("input[type='checkbox']");
    if (!cb) return;
    cb.checked = checked;
   
    const qid = cb.dataset.qid;
selectionMap.set(qid, checked);

    if (checked) tr.classList.add("selected"); else tr.classList.remove("selected");
  });
  updateSummary();
  // ensure indeterminate cleared
  selectAllCheckbox.indeterminate = false;
});

// update summary across ALL selected items (not just visible) — user likely wants global counts
function updateSummary() {
  // Build quick lookup from questionsRepo
const lookup = questionLookupMap();

  let totalSelected = 0;
  let totalMarks = 0;
  let count10 = 0;
  let count15 = 0;

  for (const [qid, sel] of selectionMap.entries()) {
    if (!sel) continue;
    const q = lookup.get(qid);
    if (!q) continue; // skip if question not found
    totalSelected += 1;
    const marks = Number(q.marks) || 0;
    totalMarks += marks;
    if (marks === 10) count10++;
    if (marks === 15) count15++;
  }

  // update UI
  summaryDiv.style.display = totalSelected > 0 ? "block" : "none";
  selectedCountSpan.textContent = String(totalSelected);
  totalMarksSpan.textContent = String(totalMarks);
  count10Span.textContent = String(count10);
  count15Span.textContent = String(count15);
}

// expose helper for PDF generator to get the selected questions in the repo's original order
function getSelectedQuestionsOrdered() {

    const selected=[];

questionsRepo.questions_repository.forEach(q => {

    if(selectionMap.get(q._selectionId))
        selected.push(q);

});

customQuestions.forEach(q => {

    if(selectionMap.get(q._selectionId))
        selected.push(q);

});

    return selected;

}


function showCustomQuestionDialog() {

    const ten =
        parseInt(prompt("Number of 10 Mark questions", "0")) || 0;

    const fifteen =
        parseInt(prompt("Number of 15 Mark questions", "0")) || 0;

    const twenty =
        parseInt(prompt("Number of 20 Mark questions", "0")) || 0;

    addCustomQuestions(10, ten);
    addCustomQuestions(15, fifteen);
    addCustomQuestions(20, twenty);

}


function addCustomQuestions(marks, count) {

    const wordLimit =
        marks == 10 ? 150 :
        marks == 15 ? 250 :
        300;

      const prefix = currentSourceFileName

    for(let i=0;i<count;i++){

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

    updateSummary();

}

function appendCustomRow(q){

    const tr=document.createElement("tr");

    tr.classList.add("selected");

    // Checkbox

    const td0=document.createElement("td");

    const cb=document.createElement("input");

    cb.type="checkbox";

    cb.checked=true;

  cb.dataset.qid = q._selectionId;

cb.onchange = () => {
    selectionMap.set(q._selectionId, cb.checked);

    tr.classList.toggle(
        "selected",
        cb.checked
    );

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

    ta.oninput=()=>{

        q.question_text=ta.value;

    };

    td3.appendChild(ta);

    tr.appendChild(td3);

    // Marks

    const td4=document.createElement("td");

    td4.textContent=q.marks;

    tr.appendChild(td4);

    // Word Limit

    const td5=document.createElement("td");

    td5.textContent=q.word_limit;

    tr.appendChild(td5);

    tbody.appendChild(tr);

}


document.getElementById("importMarkdown")
.addEventListener("click", () => {

    document
        .getElementById("importMarkdownFile")
        .click();

});

document
.getElementById("importMarkdownFile")
.addEventListener("change", importMarkdownFile);

// expose to global so generatePDF.js can call it
window.getSelectedQuestions = getSelectedQuestionsOrdered;

// ---------------------- End of script ----------------------

document.getElementById("resetQuestions").addEventListener("click", () => {


    if (!confirm("Remove all selected and custom questions?"))
        return;

    selectionMap.clear();

    customQuestions = [];
    customCounter = 1;


    document.getElementById("customQuestionPanel").style.display = "none";

      importedMarkdown = false;
    currentSourceFileName = "";

    setupFilters();

    updateSummary();

});

document.getElementById("exportMarkdown").addEventListener("click", () => {

    const questions = window.getSelectedQuestions();

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

    if (questions.length === 0) {
        alert("No questions selected.");
        return;
    }

    questions.sort((a, b) => a.marks - b.marks);

    let md = "";

questions.forEach((q, index) => {

    // Use the question number from question_id.
    // This keeps sub-parts such as Q02(a) and Q02(b)
    // under the same question number.
    const match = q.question_id?.match(/_Q(\d+)$/);

    const questionNumber = match
        ? Number(match[1])
        : index + 1;

    md += `- Q${questionNumber}. ${q.question_text.trim()} [${q.marks}]\n`;
});

    const blob = new Blob([md], {
        type: "text/markdown"
    });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);

const today = new Date();

const yyyy = today.getFullYear();
const mm = String(today.getMonth() + 1).padStart(2, "0");
const dd = String(today.getDate()).padStart(2, "0");



a.download = mdFileName;

    a.click();

    URL.revokeObjectURL(a.href);

});

function importMarkdownFile(e) {

    const file = e.target.files[0];

    if (!file) return;


    currentSourceFileName =
    file.name.replace(/\.[^.]+$/, "");

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


function importMarkdownQuestions(md) {

    document
        .getElementById("customQuestionPanel")
        .style.display = "block";


    // =========================================================
    // 1. Split Markdown into complete question blocks
    // =========================================================

const lines = md.split(/\r?\n/);

// ---------------------------------------------------------
// Optional metadata line
// ---------------------------------------------------------
// If the Markdown starts directly with "- Q1.", there is
// no metadata.
//
// Otherwise, the first non-empty line is treated as:
//     Year/Subject + GS Paper
//
// Examples:
//     2026 Essay
//     Vision 0502
//     Forum GS3
//     Forum-0400 GS3
//
// The final whitespace-separated token becomes GS Paper.
// Everything before it becomes Year/Subject.

let importYear = "";
let importGsPaper = "";

let firstContentIndex = lines.findIndex(
    line => line.trim() !== ""
);

if (
    firstContentIndex !== -1 &&
    !lines[firstContentIndex].trim().match(/^-\s*Q\d+\./i)
) {

    const metadataLine =
        lines[firstContentIndex].trim();

    const parts =
        metadataLine.split(/\s+/);

    if (parts.length >= 2) {

        importGsPaper =
            parts[parts.length - 1];

        importYear =
            parts.slice(0, -1).join(" ");

        // Remove metadata line from the question parser
        lines.splice(firstContentIndex, 1);

    }
}

const questionBlocks = [];

let currentBlock = null;

    lines.forEach(line => {

        const trimmed = line.trim();

        /*
         * A new question starts only with:
         *
         * - Q1.
         * - Q2.
         * - Q10.
         *
         * Everything else is treated as part of the
         * current question.
         */
        const match = trimmed.match(
            /^- Q(\d+)\.\s*(.*)$/
        );

        if (match) {

            // Save previous question
            if (currentBlock) {
                questionBlocks.push(currentBlock);
            }

            currentBlock = {
                questionNumber: Number(match[1]),
                lines: []
            };

            // Text after "- Q<number>."
            if (match[2].trim() !== "") {
                currentBlock.lines.push(
                    match[2].trim()
                );
            }

        } else if (currentBlock && trimmed !== "") {

            // Continuation line
            currentBlock.lines.push(trimmed);
        }
    });


    // Save final question
    if (currentBlock) {
        questionBlocks.push(currentBlock);
    }


    if (questionBlocks.length === 0) {

        alert("No valid questions found.");

        return;
    }


    // =========================================================
    // 2. Combine multiline questions and find marks
    // =========================================================

    const parsedQuestions = [];

    let withMarks = 0;
    let withoutMarks = 0;


    questionBlocks.forEach(block => {

        let question =
            block.lines.join("\n").trim();

        let marks = null;


        /*
         * Look for [10], [15] or [20] at the END
         * of the COMPLETE question.
         *
         * This is important because a question can
         * occupy many physical Markdown lines.
         */
        const match = question.match(
            /\[(10|15|20|125)\]\s*$/
        );


        if (match) {

            marks = Number(match[1]);

            question = question
                .replace(
                    /\[(10|15|20|125)\]\s*$/,
                    ""
                )
                .trim();

            withMarks++;

        } else {

            withoutMarks++;
        }


        parsedQuestions.push({

            questionNumber:
                block.questionNumber,

            question: question,

            marks: marks
        });
    });


    // =========================================================
    // 3. Reject mixed mark formats
    // =========================================================

    if (withMarks > 0 && withoutMarks > 0) {

        alert(
            "Some questions have marks while others do not. " +
            "Please make the format consistent."
        );

        return;
    }


    // =========================================================
    // 4. Handle Markdown with no marks
    // =========================================================

    if (withoutMarks === parsedQuestions.length) {

        if (!confirm(
            "No marks were found in the Markdown.\n\n" +
            "Import anyway?"
        )) {
            return;
        }


        /*
         * Existing behaviour:
         *
         * If exactly 20 questions:
         * first 10 = 10 marks
         * next 10 = 15 marks
         *
         * Otherwise everything = 10 marks.
         */
        if (parsedQuestions.length === 20) {

            parsedQuestions.forEach((q, i) => {

                q.marks =
                    i < 10 ? 10 : 15;

            });

        } else {

            parsedQuestions.forEach(q => {

                q.marks = 10;

            });
        }
    }


    // =========================================================
    // 5. Create the question objects
    // =========================================================

    parsedQuestions.forEach(item => {


        const wordLimit =
            item.marks === 10 ? 150 :
            item.marks === 15 ? 250 :
            item.marks === 20 ? 250 :
            item.marks === 125 ? 1200:
            300 ;


        /*
         * question_id
         *
         * This is the DISPLAY question number.
         *
         * Therefore Q1(a) and Q1(b) deliberately have
         * the same question_id:
         *
         * filename_Q1
         * filename_Q1
         *
         * This is what allows the PDF margin/footer to
         * correctly show Q. 1 for both.
         */
        const questionId =
            `${currentSourceFileName}_Q${item.questionNumber}`;


        /*
         * _selectionId
         *
         * This is the UNIQUE INTERNAL ID.
         *
         * It prevents Q1(a) and Q1(b) from colliding
         * in selectionMap.
         */
        const selectionId =
            `${currentSourceFileName}_import_${customCounter}`;


const q = {
    question_id: questionId,
    _selectionId: selectionId,
    question_text: item.question,

    year: importYear,

    gs_paper:
        item.marks === 125
            ? "Essay"
            : importGsPaper,

    marks: item.marks,
    word_limit: wordLimit,
    official_syllabus_topics: []
};


        customCounter++;


        customQuestions.push(q);


        /*
         * IMPORTANT:
         *
         * Selection uses _selectionId, NOT question_id.
         *
         * This allows:
         *
         * Q1(a) -> selected independently
         * Q1(b) -> selected independently
         */
        selectionMap.set(
            q._selectionId,
            true
        );


        appendCustomRow(q);

    });


    updateSummary();
}
