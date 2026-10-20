// generatePDF.js
// QCAB / Questions / Answer Booklet generator (UPSC style)
//
// Questions are grouped per paper (year + gs_paper). Each paper is
// rendered on its own terms:
//   - Essay paper  -> Section A (Q1-Q4) / Section B (Q5-Q8) layout
//   - Any other    -> normal layout
// So Essay can now be mixed with GS1, Socio-I, etc.

// ---------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------

const today = new Date();
const yyyy = today.getFullYear();
const mm = String(today.getMonth() + 1).padStart(2, "0");
const dd = String(today.getDate()).padStart(2, "0");

const PAGE = {
    width: 210,
    height: 297,
    left: 15,
    right: 188,
    top: 15,
    bottom: 282,
    lineHeight: 6
};

const NUMBER_WIDTH = 10;
const TEXT_X = PAGE.left + NUMBER_WIDTH;
const TEXT_WIDTH = PAGE.right - TEXT_X;

const MARGIN_NOTE = "Candidates must not write on this margin";

const ESSAY_INSTRUCTION =
    "Write two essays, choosing one topic from each of the following Sections A and B, in about 1000-1200 words each:";


// ---------------------------------------------------------
// SELECTION / NAMING HELPERS
// ---------------------------------------------------------

function getSelection() {
    if (typeof window.getSelectedQuestions !== "function") {
        alert("Selection logic not loaded!");
        return null;
    }

    const selected = window.getSelectedQuestions();

    if (selected.length === 0) {
        alert("Select questions first!");
        return null;
    }

    return selected;
}

function getIntelligentFilename(questions, type) {

    const years = [
        ...new Set(questions.map(q => q.year).filter(Boolean))
    ];

    const subjects = [
        ...new Set(questions.map(q => q.gs_paper).filter(Boolean))
    ];

    // Automatic naming when exactly one year
    // and one subject are present.
    if (years.length === 1 && subjects.length === 1) {

        const year = String(years[0]).trim();
        const subject = String(subjects[0]).trim();

        if (type === "qcab") return `${year}_${subject}_QCAB.pdf`;
        if (type === "questions") return `${year}_${subject}_Questions.pdf`;
        if (type === "answers") return `${year}_${subject}_Answers_Booklet.pdf`;
        if (type === "md") return `${year}_${subject}.md`;
    }

    return null;
}

// Sets window.footerPrefix and window.pdfFileName.
// Returns false if the user cancelled the prompt.
function resolveNaming(questions, type) {

    const intelligentName = getIntelligentFilename(questions, type);

    if (intelligentName) {
        window.footerPrefix =
            `${questions[0].year}_${questions[0].gs_paper}`;
        window.pdfFileName = intelligentName;
        return true;
    }

    const isMixed =
        new Set(questions.map(q => `${q.year || ""}|${q.gs_paper || ""}`)).size > 1;

    let message;

    if (type === "qcab") {
        message =
            "Enter footer filename.\n\nExamples:\n2026-07-21_\n2022_GS1_\n2025_PSIR_\nSeries_1234\nModule_1234_\n\nLeave blank for only Questions as prefix.";
    } else {
        message = "Enter filename prefix:";
    }

    if (isMixed) {
        message =
            "Multiple papers selected.\nEnter a filename for the combined PDF:\n\n" +
            "(Each paper's footer will automatically show YYYY_Paper.)";
    }

    const footerName = prompt(message, window.currentSourceFileName || "");

    if (footerName === null) return false;

    const cleaned = footerName.trim();

    window.footerPrefix = cleaned || window.currentSourceFileName || "";

    if (type === "qcab") {
        window.pdfFileName =
            `${cleaned || window.currentSourceFileName || `${yyyy}-${mm}-${dd}-QCAB`}.pdf`;
    } else if (type === "questions") {
        window.pdfFileName =
            `${cleaned || window.currentSourceFileName || "Questions"}_Questions.pdf`;
    } else {
        window.pdfFileName =
            `${cleaned || window.currentSourceFileName || "Answers"}_Answers_Booklet.pdf`;
    }

    // If every question belongs to the same year, prefix the file
    // name with "YYYY-" (unless it already starts with that year).
    const allYears = new Set(questions.map(q => String(q.year || "").trim()));

    if (allYears.size === 1) {
        const commonYear = [...allYears][0];

        if (commonYear && !window.pdfFileName.startsWith(commonYear)) {
            window.pdfFileName = `${commonYear}-${window.pdfFileName}`;
        }
    }

    return true;
}


// ---------------------------------------------------------
// GROUPING (one group per year + paper)
// ---------------------------------------------------------

function getQuestionNumber(q, fallback) {
    // Use the question number embedded in question_id.
    // Sub-parts such as Q02(a) and Q02(b) keep the same number.
    const match = q.question_id?.match(/_Q(\d+)/);
    return match ? Number(match[1]) : fallback;
}

function groupByPaper(questions) {

    const map = new Map();

    // Groups keep the order in which papers first appear in the selection.
    questions.forEach(q => {
        const key = `${q.year || ""}|${q.gs_paper || ""}`;

        if (!map.has(key)) {
            map.set(key, {
                year: q.year || "",
                paper: q.gs_paper || "",
                questions: []
            });
        }

        map.get(key).questions.push(q);
    });

    const groups = [...map.values()];

    groups.forEach(group => {

        group.isEssay = group.paper === "Essay";

        // Display label  -> 2014-Essay
        group.label = [group.year, group.paper].filter(Boolean).join("-");

        // Footer prefix  -> 2014_Essay
        group.prefix = [group.year, group.paper].filter(Boolean).join("_");

        // Same ordering as before (by marks) inside each paper
        group.questions.sort((a, b) => a.marks - b.marks);

        group.questions.forEach((q, i) => {
            q.question_number = getQuestionNumber(q, i + 1);
        });

        // Essay is always in question-number order
        if (group.isEssay) {
            group.questions.sort(
                (a, b) => a.question_number - b.question_number
            );
        }
    });

    return groups;
}

function footerPrefixFor(group, isMulti) {
    // Several papers: each paper uses its own YYYY_Paper
    if (isMulti && group.prefix) return group.prefix;

    // Single paper: keep the old behaviour (user-entered prefix wins)
    return window.footerPrefix || group.prefix || "";
}

function answerFooterText(q, prefix) {
    return prefix
        ? q.question_id.replace(/^.*(?=_Q)/, prefix)
        : q.question_id.replace(/^.*_/, "");
}


// ---------------------------------------------------------
// MAIN GENERATOR
// ---------------------------------------------------------

function generateQCABPDF(questions, mode = "qcab", keepBlankFirstPage = false) {

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });

    const lineHeight = PAGE.lineHeight;

    const groups = groupByPaper(questions);
    const isMulti = groups.length > 1;

    doc.setFont("Times", "normal");
    doc.setFontSize(12);

    // -----------------------------------------------------
    // Page management (jsPDF starts with one page already)
    // -----------------------------------------------------

    let firstPageUsed = false;

    const startPage = () => {
        if (firstPageUsed) doc.addPage();
        firstPageUsed = true;
    };

    const pagesSoFar = () => (firstPageUsed ? doc.getNumberOfPages() : 0);

    const drawBlankPage = () => {
        startPage();

        doc.setFont("Times", "italic");
        doc.setFontSize(10);

        doc.text(
            "Intentionally left blank",
            PAGE.width - 15,
            PAGE.height - 10,
            { align: "right" }
        );

        doc.setFont("Times", "normal");
        doc.setFontSize(12);
    };

    // -----------------------------------------------------
    // QUESTION PAGES
    // -----------------------------------------------------

    const qState = { y: PAGE.top, open: false, footer: "" };

    // Footer tags per question page (a page can hold several papers
    // in the Questions-only PDF). Drawn once at the end.
    const pageTags = new Map();

    const addTag = (text) => {
        if (!text) return;
        const page = doc.getNumberOfPages();
        if (!pageTags.has(page)) pageTags.set(page, []);
        if (!pageTags.get(page).includes(text)) pageTags.get(page).push(text);
    };

    const openQuestionPage = () => {
        startPage();
        qState.open = true;
        qState.y = PAGE.top;

        addTag(qState.footer);

        doc.setFont("Times", "normal");
        doc.setFontSize(12);
    };

    const ensureSpace = (height) => {
        if (qState.y + height > PAGE.height - 15) {
            openQuestionPage();
        }
    };

    // Paper name placed ABOVE Q1 (in the top margin),
    // so Q1 itself stays exactly where it was.
    const drawPaperLabelAbove = (label) => {
        if (!label) return;

        doc.setFont("Times", "bold");
        doc.setFontSize(10);
        doc.text(label, PAGE.left, PAGE.top - 6);

        doc.setFont("Times", "normal");
        doc.setFontSize(12);
    };

    const firstQuestionHeight = (group) => {
        const q = group.questions[0];
        if (!q) return lineHeight;

        const lines = doc.splitTextToSize(
            `${q.question_text}   [${q.marks} M]`,
            TEXT_WIDTH
        );

        return lines.length * lineHeight + lineHeight;
    };

    const renderEssayQuestions = (group) => {

        const sectionA = group.questions.filter(
            q => q.question_number >= 1 && q.question_number <= 4
        );

        const sectionB = group.questions.filter(
            q => q.question_number >= 5 && q.question_number <= 8
        );

        doc.setFont("Times", "normal");
        doc.setFontSize(12);

        const instructionLines =
            doc.splitTextToSize(ESSAY_INSTRUCTION, TEXT_WIDTH);

        ensureSpace(instructionLines.length * lineHeight + 6 + lineHeight);

        doc.text(instructionLines, PAGE.left, qState.y);
        qState.y += instructionLines.length * lineHeight + 6;

        [["Section A", sectionA], ["Section B", sectionB]].forEach(
            ([title, list]) => {

                ensureSpace(lineHeight * 4);

                doc.text(title, PAGE.left, qState.y);
                qState.y += lineHeight + 2;

                list.forEach(q => {
                    const lines = doc.splitTextToSize(
                        `${q.question_number}. ${q.question_text}`,
                        TEXT_WIDTH
                    );

                    ensureSpace(lines.length * lineHeight + 4);

                    doc.text(lines, PAGE.left, qState.y);
                    qState.y += lines.length * lineHeight + 4;
                });

                qState.y += 4;
            }
        );
    };

    const renderNormalQuestions = (group) => {

        group.questions.forEach(q => {

            const qHeader = `${q.question_number}. `;
            const qText = `${q.question_text}   [${q.marks} M]`;

            const splitText = doc.splitTextToSize(qText, TEXT_WIDTH);
            const totalHeight = splitText.length * lineHeight + lineHeight;

            ensureSpace(totalHeight);

            doc.text(qHeader, PAGE.left, qState.y);
            doc.text(splitText, TEXT_X, qState.y);

            qState.y += totalHeight;
        });
    };

    const renderQuestionBlock = (group, footerText) => {

        // Essay keeps no footer on QCAB question pages (as before),
        // but is tagged in the Questions-only PDF.
        qState.footer =
            (group.isEssay && mode !== "questions") ? "" : footerText;

        doc.setFont("Times", "normal");
        doc.setFontSize(12);

        const needed = group.isEssay ? 40 : firstQuestionHeight(group);

        if (!qState.open) {

            // Very first page of the question section
            openQuestionPage();
            drawPaperLabelAbove(group.label);

        } else {

            // Papers flowing one after another (Questions-only PDF):
            // dashed break + paper name, no page break.
            const separatorHeight = 3 + 7 + lineHeight;

            if (qState.y + separatorHeight + needed > PAGE.height - 15) {

                openQuestionPage();
                drawPaperLabelAbove(group.label);

            } else {

                qState.y += 3;

                doc.setLineWidth(0.3);
                doc.setLineDashPattern([2, 2], 0);
                doc.line(PAGE.left, qState.y, PAGE.right, qState.y);
                doc.setLineDashPattern([], 0);

                qState.y += 7;

                if (group.label) {
                    doc.setFont("Times", "bold");
                    doc.setFontSize(11);
                    doc.text(group.label, PAGE.left, qState.y);
                    doc.setFont("Times", "normal");
                    doc.setFontSize(12);
                }

                qState.y += lineHeight;

                // New paper starts on the current page: tag it too
                addTag(qState.footer);
            }
        }

        if (group.isEssay) {
            renderEssayQuestions(group);
        } else {
            renderNormalQuestions(group);
        }
    };

    // -----------------------------------------------------
    // ANSWER PAGES
    // -----------------------------------------------------

    const renderAnswerBooklet = (group, prefix) => {

        // Page numbering restarts for every paper's booklet
        let answerPage = 1;

        const drawFrame = (footerText) => {

            startPage();

            doc.setLineWidth(0.3);

            doc.line(PAGE.left, PAGE.top, PAGE.left, PAGE.bottom);
            doc.line(PAGE.right, PAGE.top, PAGE.right, PAGE.bottom);

            doc.setFont("Times", "normal");
            doc.setFontSize(8);

            doc.text(footerText, PAGE.left - 14, PAGE.bottom + 3);

            doc.text(
                String(answerPage),
                PAGE.width / 2,
                PAGE.bottom + 3,
                { align: "center" }
            );

            answerPage++;
        };

        const drawMarginNote = () => {
            doc.setFontSize(8);

            const splitText = doc.splitTextToSize(MARGIN_NOTE, 23);

            doc.text(splitText, PAGE.right + 1, PAGE.top + 5);
        };

        // ---------------- ESSAY ----------------

        if (group.isEssay) {

            const sectionA = group.questions.filter(
                q => q.question_number >= 1 && q.question_number <= 4
            );

            const sectionB = group.questions.filter(
                q => q.question_number >= 5 && q.question_number <= 8
            );

            [["Section A", sectionA], ["Section B", sectionB]].forEach(
                ([title, list]) => {

                    const footerText = prefix ? `${prefix}_${title}` : title;

                    for (let p = 0; p < 12; p++) {

                        drawFrame(footerText);

                        if (p === 0) {

                            doc.setFontSize(12);

                            doc.text(
                                title,
                                PAGE.left + 2,
                                PAGE.top + 5
                            );

                            let currentY = PAGE.top + 15;

                            list.forEach(q => {
                                const splitText = doc.splitTextToSize(
                                    `${q.question_number}. ${q.question_text}`,
                                    PAGE.right - PAGE.left - 4
                                );

                                doc.text(
                                    splitText,
                                    PAGE.left + 2,
                                    currentY
                                );

                                currentY += splitText.length * lineHeight + 5;
                            });

                        } else {
                            drawMarginNote();
                        }
                    }
                }
            );

            return;
        }

        // ---------------- NORMAL PAPERS ----------------

        group.questions.forEach(q => {

            const marks = Number(q.marks);

            const pagesNeeded =
                (marks === 125 ? 12 : Math.ceil(marks / 6)) || 1;

            const footerText = answerFooterText(q, prefix);

            for (let p = 0; p < pagesNeeded; p++) {

                drawFrame(footerText);

                if (p === 0) {

                    doc.setFontSize(12);

                    doc.text(
                        `Q. ${q.question_number}`,
                        PAGE.left - 10,
                        PAGE.top + 5
                    );

                    const splitText = doc.splitTextToSize(
                        q.question_text || " ",
                        PAGE.right - PAGE.left - 4
                    );

                    doc.text(splitText, PAGE.left + 2, PAGE.top + 5);

                    const rightText = q.year
                        ? `${q.marks} M / ${q.year}`
                        : `${q.marks} M`;

                    doc.text(rightText, PAGE.right + 1, PAGE.top + 5);

                } else {
                    drawMarginNote();
                }
            }
        });
    };

    // -----------------------------------------------------
    // BUILD THE DOCUMENT, PAPER BY PAPER
    // -----------------------------------------------------

    groups.forEach(group => {

        const prefix = footerPrefixFor(group, isMulti);

        // ---- Questions ----

        if (mode !== "answers") {

            // QCAB: every paper starts its own question section on a new page.
            // Questions-only: papers flow together on the same pages.
            if (mode === "qcab") qState.open = false;

            renderQuestionBlock(group, prefix);

            if (mode === "qcab") {

                // Essay always gets an intentional blank page.
                // Other papers get one so that the answer booklet
                // always starts on an even (left-hand) page.
                if (group.isEssay || doc.getNumberOfPages() % 2 === 0) {
                    drawBlankPage();
                }
            }
        }

        // ---- Answers ----

        if (mode !== "questions") {

            // Answers-only: optionally keep Q1 of each paper on the left side
            if (
                mode === "answers" &&
                keepBlankFirstPage &&
                !group.isEssay &&
                pagesSoFar() % 2 === 0
            ) {
                drawBlankPage();
            }

            renderAnswerBooklet(group, prefix);
        }
    });

    // Draw bottom-left footers on question pages (YYYY_Paper, or
    // several separated by " | " when papers share a page)
    pageTags.forEach((tags, page) => {
        doc.setPage(page);
        doc.setFont("Times", "normal");
        doc.setFontSize(8);
        doc.text(tags.join("  |  "), PAGE.left - 14, PAGE.bottom + 3);
    });

    doc.setPage(doc.getNumberOfPages());

    window.generatedPDF = doc;

    if (window.generatedPDF) {
        window.generatedPDF.save(window.pdfFileName);
    }
}


// ---------------------------------------------------------
// BUTTON HANDLERS
// ---------------------------------------------------------

document.getElementById("generateQCAB").addEventListener("click", () => {

    const selected = getSelection();
    if (!selected) return;

    if (!resolveNaming(selected, "qcab")) return;

    generateQCABPDF(selected, "qcab");
});

document.getElementById("downloadPDF").addEventListener("click", () => {
    if (window.generatedPDF) {
        window.generatedPDF.save(window.pdfFileName);
        // hide again after downloading
        document.getElementById("downloadPDF").style.display = "none";
    }
});

// DOWNLOAD QUESTIONS ONLY
document.getElementById("downloadQuestions").addEventListener("click", () => {

    const selected = getSelection();
    if (!selected) return;

    if (!resolveNaming(selected, "questions")) return;

    generateQCABPDF(selected, "questions");
});

// DOWNLOAD ANSWERS BOOKLET ONLY
document.getElementById("downloadAnswersBooklet").addEventListener("click", () => {

    const selected = getSelection();
    if (!selected) return;

    // Essay starts directly with its answer booklet.
    // Other papers get the blank-page choice.
    let keepBlank = false;

    if (selected.some(q => q.gs_paper !== "Essay")) {
        keepBlank = confirm(
            "It is recommended to keep the first page intentionally blank " +
            "to emulate exam-style pattern (Q1 starting on left side).\n\n" +
            "Keep first page blank?"
        );
    }

    if (!resolveNaming(selected, "answers")) return;

    generateQCABPDF(selected, "answers", keepBlank);
});
