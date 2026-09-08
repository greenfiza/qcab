// generatePDF.js



document.getElementById("generateQCAB").addEventListener("click", () => {
    if (typeof window.getSelectedQuestions !== "function") {
        alert("Selection logic not loaded!");
        return;
    }

    const selectedQuestions = window.getSelectedQuestions();
    if (selectedQuestions.length === 0) {
        alert("Select questions first!");
        return;
    }

    // Sort by marks if you still want that order, else comment next line
    selectedQuestions.sort((a, b) => a.marks - b.marks);

    // Ensure sequential numbering (1,2,3...)
// Use the question number embedded in question_id.
// This allows sub-parts such as Q02(a) and Q02(b)
// to retain the same question number.
selectedQuestions.forEach((q) => {
    const match = q.question_id?.match(/_Q(\d+)$/);

    if (match) {
        q.question_number = Number(match[1]);
    } else {
        // Fallback for custom questions or IDs without _Q<number>
        q.question_number = selectedQuestions.indexOf(q) + 1;
    }

    console.log(
        "Question ID:", q.question_id,
        "→ Question No:", q.question_number
    );
});



     window.footerPrefix = "";
     
     const intelligentName =
    getIntelligentFilename(selectedQuestions, "qcab");

if (intelligentName) {

    window.footerPrefix =
        `${selectedQuestions[0].year}_${selectedQuestions[0].gs_paper}`;

    window.pdfFileName = intelligentName;

} else {

    const footerName = prompt(
        "Enter footer filename.\n\nExamples:\n2026-07-21_\n2022_GS1_\n2025_PSIR_\nSeries_1234\nModule_1234_\n\nLeave blank for only Questions as prefix.",
        window.currentSourceFileName
    );

    if (footerName === null) return;

    window.footerPrefix =
        footerName.trim() ||
        window.currentSourceFileName;

    window.pdfFileName =
        `${footerName.trim() || window.currentSourceFileName || `${yyyy}-${mm}-${dd}-QCAB`}.pdf`;
}

generateQCABPDF(selectedQuestions, "qcab");

});

const today = new Date();

const yyyy = today.getFullYear();
const mm = String(today.getMonth() + 1).padStart(2, "0");
const dd = String(today.getDate()).padStart(2, "0");


function getIntelligentFilename(questions, type) {

    const years = [
        ...new Set(
            questions
                .map(q => q.year)
                .filter(Boolean)
        )
    ];

    const subjects = [
        ...new Set(
            questions
                .map(q => q.gs_paper)
                .filter(Boolean)
        )
    ];

    // Automatic naming when exactly one year
    // and one subject are present.
    if (years.length === 1 && subjects.length === 1) {

        const year = String(years[0]).trim();
        const subject = String(subjects[0]).trim();

        if (type === "qcab") {
            return `${year}_${subject}_QCAB.pdf`;
        }

        if (type === "questions") {
            return `${year}_${subject}_Questions.pdf`;
        }

        if (type === "answers") {
            return `${year}_${subject}_Answers_Booklet.pdf`;
        }

        if (type === "md") {
            return `${year}_${subject}.md`;
        }
    }

    return null;
}


function generateQCABPDF(questions, mode = "qcab", keepBlankFirstPage = false) {
const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageHeight = 297, pageWidth = 210;
    const leftMargin = 15, rightMargin = 188, topMargin = 15, bottomMargin = 282;

const isEssayPaper = questions.some(q => q.gs_paper === "Essay");

    doc.setFont("Times", "Roman");
    doc.setFontSize(12);

let questionPages = 1;
let currentY = topMargin;

const numberWidth = 10;
const textX = leftMargin + numberWidth;
const textWidth = rightMargin - textX;
const lineHeight = 6;


if (isEssayPaper) {

    // Essay paper: Q1-Q4 = Section A
    // Q5-Q8 = Section B

    const sectionA = questions
        .filter(q => q.question_number >= 1 && q.question_number <= 4)
        .sort((a, b) => a.question_number - b.question_number);

    const sectionB = questions
        .filter(q => q.question_number >= 5 && q.question_number <= 8)
        .sort((a, b) => a.question_number - b.question_number);

    // Heading / instruction
    doc.setFont("Times", "Roman");
    doc.setFontSize(12);

    const instruction =
        "Write two essays, choosing one topic from each of the following Sections A and B, in about 1000-1200 words each:";

    const instructionLines =
        doc.splitTextToSize(instruction, textWidth);

    doc.text(instructionLines, leftMargin, currentY);

    currentY += instructionLines.length * lineHeight + 6;

    // ---------- SECTION A ----------

    doc.text("Section A", leftMargin, currentY);
    currentY += lineHeight + 2;

    sectionA.forEach(q => {

        const qText = `${q.question_number}. ${q.question_text}`;

        const splitText =
            doc.splitTextToSize(qText, textWidth);

        doc.text(splitText, leftMargin, currentY);

        currentY += splitText.length * lineHeight + 4;
    });

    currentY += 4;

    // ---------- SECTION B ----------

    doc.text("Section B", leftMargin, currentY);
    currentY += lineHeight + 2;

    sectionB.forEach(q => {

        const qText = `${q.question_number}. ${q.question_text}`;

        const splitText =
            doc.splitTextToSize(qText, textWidth);

        doc.text(splitText, leftMargin, currentY);

        currentY += splitText.length * lineHeight + 4;
    });

} else {
    questions.forEach((q, index) => {
        // Format question text
        const qHeader = `${q.question_number}. `;
        const qText = `${q.question_text}   [${q.marks} M]`;
        console.log( "Questions:",qHeader,"----", qText);
        // Split text to fit within width
const splitText = doc.splitTextToSize(qText, textWidth);
        const totalHeight = splitText.length * lineHeight + lineHeight;

        // Add new page if content exceeds bottom margin
        if (currentY + totalHeight > pageHeight - 15) {
            doc.addPage();
            questionPages++;
            currentY = topMargin;
        }

        // Draw question number and text
doc.text(qHeader, leftMargin, currentY);
doc.text(splitText, textX, currentY);


// Footer
doc.setFontSize(8);

if (window.footerPrefix) {
    doc.text(
        window.footerPrefix,
        leftMargin - 14,
        bottomMargin + 3
    );
}


 doc.setFontSize(12);

        // Update Y position
        currentY += totalHeight; // spacing between questions
    });
}
 

// ---------------------------------------------------------
// INTENTIONALLY BLANK PAGE BEFORE ANSWER BOOKLET
// ---------------------------------------------------------

if (mode === "qcab") {

    // Essay always gets an intentional blank page.
    // Normal GS papers get one only when the question
    // section has an even number of pages.
    if (isEssayPaper || questionPages % 2 === 0) {

        doc.addPage();

        doc.setFont("Times", "Italic");
        doc.setFontSize(10);

        doc.text(
            "Intentionally left blank",
            pageWidth - 15,
            pageHeight - 10,
            { align: "right" }
        );

        // Restore default font
        doc.setFont("Times", "Roman");
        doc.setFontSize(12);
    }
}

// ---------- PART 2: Render QCAB Pages ----------

if (mode !== "questions") {

let answerPage = 1;

if (mode === "answers" && keepBlankFirstPage) {

    doc.addPage();

    // Completely blank page.
    // Do not add footer, numbering, or "Intentionally left blank".
}

if (isEssayPaper) {

    const sectionA = questions
        .filter(q => q.question_number >= 1 && q.question_number <= 4)
        .sort((a, b) => a.question_number - b.question_number);

    const sectionB = questions
        .filter(q => q.question_number >= 5 && q.question_number <= 8)
        .sort((a, b) => a.question_number - b.question_number);


    // =====================================================
    // SECTION A – 12 PAGES
    // =====================================================

    for (let p = 0; p < 12; p++) {

        doc.addPage();

        // Margins
        doc.setLineWidth(0.3);

        doc.line(
            leftMargin,
            topMargin,
            leftMargin,
            bottomMargin
        );

        doc.line(
            rightMargin,
            topMargin,
            rightMargin,
            bottomMargin
        );

        // Footer
        const footerText =
            window.footerPrefix
                ? "Section A"
                : "Section A";

        doc.setFontSize(8);

        doc.text(
            footerText,
            leftMargin - 14,
            bottomMargin + 3
        );

        doc.text(
            String(answerPage),
            pageWidth / 2,
            bottomMargin + 3,
            { align: "center" }
        );

        answerPage++;


        // First page of Section A
        if (p === 0) {

            doc.setFont("Times", "Roman");
            doc.setFontSize(12);

            doc.text(
                "Section A",
                leftMargin + 2,
                topMargin + 5
            );

            let currentY = topMargin + 15;

            sectionA.forEach(q => {

                const splitText =
                    doc.splitTextToSize(
                        `${q.question_number}. ${q.question_text}`,
                        rightMargin - leftMargin - 4
                    );

                doc.text(
                    splitText,
                    leftMargin + 2,
                    currentY
                );

                currentY +=
                    splitText.length * lineHeight + 5;
            });

        } else {

            // Continuation pages
            doc.setFontSize(10);

            doc.text(
                "Candidates must not write on this margin",
                rightMargin + 1,
                topMargin + 5
            );
        }
    }


    // =====================================================
    // SECTION B – 12 PAGES
    // =====================================================

    for (let p = 0; p < 12; p++) {

        doc.addPage();

        // Margins
        doc.setLineWidth(0.3);

        doc.line(
            leftMargin,
            topMargin,
            leftMargin,
            bottomMargin
        );

        doc.line(
            rightMargin,
            topMargin,
            rightMargin,
            bottomMargin
        );

        // Footer
        doc.setFontSize(8);

        doc.text(
            "Section B",
            leftMargin - 14,
            bottomMargin + 3
        );

        doc.text(
            String(answerPage),
            pageWidth / 2,
            bottomMargin + 3,
            { align: "center" }
        );

        answerPage++;


        // First page of Section B
        if (p === 0) {

            doc.setFont("Times", "Roman");
            doc.setFontSize(12);

            doc.text(
                "Section B",
                leftMargin + 2,
                topMargin + 5
            );

            let currentY = topMargin + 15;

            sectionB.forEach(q => {

                const splitText =
                    doc.splitTextToSize(
                        `${q.question_number}. ${q.question_text}`,
                        rightMargin - leftMargin - 4
                    );

                doc.text(
                    splitText,
                    leftMargin + 2,
                    currentY
                );

                currentY +=
                    splitText.length * lineHeight + 5;
            });

        } else {

            doc.setFontSize(10);

            doc.text(
                "Candidates must not write on this margin",
                rightMargin + 1,
                topMargin + 5
            );
        }
    }


} else {

    // =====================================================
    // NORMAL PAPERS
    // =====================================================

    questions.forEach(q => {

        const pagesNeeded =
            q.marks === 125
                ? 12
                : Math.ceil(q.marks / 6);

        for (let p = 0; p < pagesNeeded; p++) {

            doc.addPage();

            // Margins
            doc.setLineWidth(0.3);

            doc.line(
                leftMargin,
                topMargin,
                leftMargin,
                bottomMargin
            );

            doc.line(
                rightMargin,
                topMargin,
                rightMargin,
                bottomMargin
            );

            // Footer
            const footerText =
                window.footerPrefix
                    ? q.question_id.replace(
                        /^.*(?=_Q)/,
                        window.footerPrefix
                    )
                    : q.question_id.replace(
                        /^.*_/,
                        ""
                    );


                    
            doc.setFontSize(8);

            doc.text(
                footerText,
                leftMargin - 14,
                bottomMargin + 3
            );

            doc.text(
                String(answerPage),
                pageWidth / 2,
                bottomMargin + 3,
                { align: "center" }
            );

            answerPage++;

            if (p === 0) {

                doc.setFontSize(12);

                doc.text(
                    `Q. ${q.question_number}`,
                    leftMargin - 10,
                    topMargin + 5
                );

                const localWidth =
                    rightMargin - leftMargin - 4;

                const questionText =
                    q.question_text || " ";

                const splitText =
                    doc.splitTextToSize(
                        questionText,
                        localWidth
                    );

                let currentY =
                    topMargin + 5;

                doc.text(
                    splitText,
                    leftMargin + 2,
                    currentY
                );

                currentY = topMargin + 5;

                const rightText = q.year
                    ? `${q.marks} M / ${q.year}`
                    : `${q.marks} M`;

                doc.text(
                    rightText,
                    rightMargin + 1,
                    currentY
                );

            } else {

                const localWidth = 23;

                const splitText =
                    doc.splitTextToSize(
                        "Candidates must not write on this margin",
                        localWidth
                    );

                let currentY =
                    topMargin + 5;

                doc.text(
                    splitText,
                    rightMargin + 1,
                    currentY
                );
            }
        }
    });
}

}
    window.generatedPDF = doc;
    if (window.generatedPDF) {

window.generatedPDF.save(window.pdfFileName);

    }
    //document.getElementById("downloadPDF").style.display = "inline-block";
    //alert("QCAB PDF generated! Click 'Download QCAB PDF' to save.");
}

document.getElementById("downloadPDF").addEventListener("click", () => {
    if (window.generatedPDF) {
        window.generatedPDF.save(pdfFileName);
        // hide again after downloading
        document.getElementById("downloadPDF").style.display = "none";
    }
});

// ---------------------------------------------------------
// DOWNLOAD QUESTIONS ONLY
// ---------------------------------------------------------

document.getElementById("downloadQuestions").addEventListener("click", () => {

    if (typeof window.getSelectedQuestions !== "function") {
        alert("Selection logic not loaded!");
        return;
    }

    const selectedQuestions = window.getSelectedQuestions();

    if (selectedQuestions.length === 0) {
        alert("Select questions first!");
        return;
    }

    selectedQuestions.sort((a, b) => a.marks - b.marks);

    selectedQuestions.forEach((q) => {
        const match = q.question_id?.match(/_Q(\d+)$/);

        if (match) {
            q.question_number = Number(match[1]);
        } else {
            q.question_number =
                selectedQuestions.indexOf(q) + 1;
        }
    });

   
    const intelligentName =
    getIntelligentFilename(selectedQuestions, "questions");

if (intelligentName) {

    window.footerPrefix =
        `${selectedQuestions[0].year}_${selectedQuestions[0].gs_paper}`;

    window.pdfFileName = intelligentName;

} else {

    const footerName = prompt(
        "Enter filename prefix:",
        window.currentSourceFileName || ""
    );

    if (footerName === null) return;

    window.footerPrefix =
        footerName.trim() ||
        window.currentSourceFileName;

    window.pdfFileName =
        `${footerName.trim() || window.currentSourceFileName || "Questions"}_Questions.pdf`;
}

    generateQCABPDF(
        selectedQuestions,
        "questions"
    );
});


// ---------------------------------------------------------
// DOWNLOAD ANSWERS BOOKLET ONLY
// ---------------------------------------------------------

document.getElementById("downloadAnswersBooklet").addEventListener("click", () => {

    if (typeof window.getSelectedQuestions !== "function") {
        alert("Selection logic not loaded!");
        return;
    }

    const selectedQuestions = window.getSelectedQuestions();

    if (selectedQuestions.length === 0) {
        alert("Select questions first!");
        return;
    }

    // Same ordering as QCAB
    selectedQuestions.sort((a, b) => a.marks - b.marks);

    // Same question numbering as QCAB
    selectedQuestions.forEach((q) => {

        const match = q.question_id?.match(/_Q(\d+)$/);

        if (match) {
            q.question_number = Number(match[1]);
        } else {
            q.question_number =
                selectedQuestions.indexOf(q) + 1;
        }

    });

    const isEssayPaper = selectedQuestions.some(
        q => q.gs_paper === "Essay"
    );

    // Essay starts directly with its answer booklet.
    // Normal papers get the blank-page choice.
    let keepBlank = false;

    if (!isEssayPaper) {

        keepBlank = confirm(
            "It is recommended to keep the first page intentionally blank " +
            "to emulate exam-style pattern (Q1 starting on left side).\n\n" +
            "Keep first page blank?"
        );

    }

const intelligentName =
    getIntelligentFilename(selectedQuestions, "answers");

if (intelligentName) {

    window.footerPrefix =
        `${selectedQuestions[0].year}_${selectedQuestions[0].gs_paper}`;

    window.pdfFileName = intelligentName;

} else {

    const footerName = prompt(
        "Enter filename prefix:",
        window.currentSourceFileName || ""
    );

    if (footerName === null) return;

    window.footerPrefix =
        footerName.trim() ||
        window.currentSourceFileName;

    window.pdfFileName =
        `${footerName.trim() || window.currentSourceFileName || "Answers"}_Answers_Booklet.pdf`;
}

    // ---------------------------------------------------------
    // CREATE PDF
    // ---------------------------------------------------------

    const { jsPDF } = window.jspdf;

    const doc = new jsPDF({
        unit: "mm",
        format: "a4"
    });

    const pageHeight = 297;
    const pageWidth = 210;

    const leftMargin = 15;
    const rightMargin = 188;
    const topMargin = 15;
    const bottomMargin = 282;

    const lineHeight = 6;

    doc.setFont("Times", "Roman");
    doc.setFontSize(12);


    // ---------------------------------------------------------
    // OPTIONAL FIRST BLANK PAGE
    // ---------------------------------------------------------

if (keepBlank) {

    doc.setFont("Times", "Italic");
    doc.setFontSize(10);

    doc.text(
        "Intentionally left blank",
        pageWidth - 15,
        pageHeight - 10,
        { align: "right" }
    );

    // Restore default font
    doc.setFont("Times", "Roman");
    doc.setFontSize(12);
}

    // ---------------------------------------------------------
    // ANSWER BOOKLET
    // ---------------------------------------------------------

    let answerPage = 1;


    // =========================================================
    // ESSAY
    // =========================================================

    if (isEssayPaper) {

        const sectionA = selectedQuestions
            .filter(q =>
                q.question_number >= 1 &&
                q.question_number <= 4
            )
            .sort(
                (a, b) =>
                    a.question_number - b.question_number
            );

        const sectionB = selectedQuestions
            .filter(q =>
                q.question_number >= 5 &&
                q.question_number <= 8
            )
            .sort(
                (a, b) =>
                    a.question_number - b.question_number
            );


        // -----------------------------------------------------
        // SECTION A – 12 PAGES
        // -----------------------------------------------------

        for (let p = 0; p < 12; p++) {

            // First page uses existing page only if there
            // is no intentional blank page.
            if (p > 0 || keepBlank) {
                doc.addPage();
            }

            doc.setLineWidth(0.3);

            doc.line(
                leftMargin,
                topMargin,
                leftMargin,
                bottomMargin
            );

            doc.line(
                rightMargin,
                topMargin,
                rightMargin,
                bottomMargin
            );


            doc.setFontSize(8);

            doc.text(
                "Section A",
                leftMargin - 14,
                bottomMargin + 3
            );

            doc.text(
                String(answerPage),
                pageWidth / 2,
                bottomMargin + 3,
                { align: "center" }
            );

            answerPage++;


            // First page of Section A
            if (p === 0) {

                doc.setFont("Times", "Roman");
                doc.setFontSize(12);

                doc.text(
                    "Section A",
                    leftMargin + 2,
                    topMargin + 5
                );

                let currentY = topMargin + 15;

                sectionA.forEach(q => {

                    const splitText =
                        doc.splitTextToSize(
                            `${q.question_number}. ${q.question_text}`,
                            rightMargin - leftMargin - 4
                        );

                    doc.text(
                        splitText,
                        leftMargin + 2,
                        currentY
                    );

                    currentY +=
                        splitText.length * lineHeight + 5;

                });

            } else {

                doc.setFontSize(10);

                doc.text(
                    "Candidates must not write on this margin",
                    rightMargin + 1,
                    topMargin + 5
                );

            }

        }


        // -----------------------------------------------------
        // SECTION B – 12 PAGES
        // -----------------------------------------------------

        for (let p = 0; p < 12; p++) {

            doc.addPage();

            doc.setLineWidth(0.3);

            doc.line(
                leftMargin,
                topMargin,
                leftMargin,
                bottomMargin
            );

            doc.line(
                rightMargin,
                topMargin,
                rightMargin,
                bottomMargin
            );


            doc.setFontSize(8);

            doc.text(
                "Section B",
                leftMargin - 14,
                bottomMargin + 3
            );

            doc.text(
                String(answerPage),
                pageWidth / 2,
                bottomMargin + 3,
                { align: "center" }
            );

            answerPage++;


            if (p === 0) {

                doc.setFont("Times", "Roman");
                doc.setFontSize(12);

                doc.text(
                    "Section B",
                    leftMargin + 2,
                    topMargin + 5
                );

                let currentY = topMargin + 15;

                sectionB.forEach(q => {

                    const splitText =
                        doc.splitTextToSize(
                            `${q.question_number}. ${q.question_text}`,
                            rightMargin - leftMargin - 4
                        );

                    doc.text(
                        splitText,
                        leftMargin + 2,
                        currentY
                    );

                    currentY +=
                        splitText.length * lineHeight + 5;

                });

            } else {

                doc.setFontSize(10);

                doc.text(
                    "Candidates must not write on this margin",
                    rightMargin + 1,
                    topMargin + 5
                );

            }

        }


    // =========================================================
    // NORMAL PAPERS
    // =========================================================

    } else {

        selectedQuestions.forEach(q => {

            const pagesNeeded =
                q.marks === 125
                    ? 12
                    : Math.ceil(q.marks / 6);


            for (let p = 0; p < pagesNeeded; p++) {

                // First page:
                // - use page 1 if no blank page requested
                // - use page 2 if blank page requested
                if (p > 0 || keepBlank) {
                    doc.addPage();
                }

                doc.setLineWidth(0.3);

                doc.line(
                    leftMargin,
                    topMargin,
                    leftMargin,
                    bottomMargin
                );

                doc.line(
                    rightMargin,
                    topMargin,
                    rightMargin,
                    bottomMargin
                );


                const footerText =
                    window.footerPrefix
                        ? q.question_id.replace(
                            /^.*(?=_Q)/,
                            window.footerPrefix
                        )
                        : q.question_id.replace(
                            /^.*_/,
                            ""
                        );


                doc.setFontSize(8);

                doc.text(
                    footerText,
                    leftMargin - 14,
                    bottomMargin + 3
                );

                doc.text(
                    String(answerPage),
                    pageWidth / 2,
                    bottomMargin + 3,
                    { align: "center" }
                );

                answerPage++;


                // First page of this question
                if (p === 0) {

                    doc.setFontSize(12);

                    doc.text(
                        `Q. ${q.question_number}`,
                        leftMargin - 10,
                        topMargin + 5
                    );


                    const localWidth =
                        rightMargin - leftMargin - 4;

                    const questionText =
                        q.question_text || " ";


                    const splitText =
                        doc.splitTextToSize(
                            questionText,
                            localWidth
                        );


                    let currentY =
                        topMargin + 5;


                    doc.text(
                        splitText,
                        leftMargin + 2,
                        currentY
                    );


                    currentY =
                        topMargin + 5;


                    const rightText = q.year
                        ? `${q.marks} M / ${q.year}`
                        : `${q.marks} M`;


                    doc.text(
                        rightText,
                        rightMargin + 1,
                        currentY
                    );


                } else {

                    const localWidth = 23;

                    const splitText =
                        doc.splitTextToSize(
                            "Candidates must not write on this margin",
                            localWidth
                        );


                    let currentY =
                        topMargin + 5;


                    doc.text(
                        splitText,
                        rightMargin + 1,
                        currentY
                    );

                }

            }

        });

    }


    // ---------------------------------------------------------
    // SAVE
    // ---------------------------------------------------------

    window.generatedPDF = doc;

    window.generatedPDF.save(
        window.pdfFileName
    );

});