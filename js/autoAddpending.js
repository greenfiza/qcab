/* autoAddPending.js
 * If the user has picked years/papers (or a paper/topic) but forgot to press
 * "Add to list", add that selection automatically before any other action runs.
 *
 * Load it anywhere after the page markup, e.g. last:
 *   <script src="js/autoAddPending.js"></script>
 */
(function () {
    'use strict';

    const $ = function (id) { return document.getElementById(id); };

    // Buttons that should trigger the automatic "Add to list".
    const ACTION_IDS = [
        'generateQCAB', 'downloadPDF', 'downloadQuestions', 'downloadAnswersBooklet',
        'exportMarkdown', 'generateRandomQuestions', 'randomModalBtn', 'addCustomQuestions'
    ];

    let lastAddedSignature = '';

    function activeMode() {
        const syl = $('modeSyllabus');
        return syl && !syl.hidden ? 'syllabus' : 'year-gs';
    }

    function signature(mode) {
        if (mode === 'syllabus') {
            return 'S|' + ($('gsPaperFilter2') || {}).value + '|' + ($('syllabusFilter') || {}).value;
        }
        return 'Y|' + ($('yearChips') ? $('yearChips').innerHTML : '') +
               '|' + ($('paperChips') ? $('paperChips').innerHTML : '');
    }

    function addPendingSelection() {
        const mode = activeMode();
        const addBtn = mode === 'syllabus' ? $('addSyllabusSetBtn') : $('addSetBtn');
        if (!addBtn || addBtn.disabled) return;          // nothing pending

        const sig = signature(mode);
        if (sig === lastAddedSignature) return;          // this exact selection was already added

        lastAddedSignature = sig;
        addBtn.click();

        const status = $('statusMsg');
        if (status) status.textContent = 'Your pending selection was added to the list automatically.';
    }

    // Capture phase on document runs before the buttons' own click handlers.
    document.addEventListener('click', function (e) {
        const btn = e.target.closest ? e.target.closest('button') : null;
        if (!btn || ACTION_IDS.indexOf(btn.id) === -1) return;
        addPendingSelection();
        if (btn.id === 'randomModalBtn') addEverythingIfListEmpty();
    }, true);

    // Random modal with nothing selected and nothing in the list:
    // assume the user wants everything (all years, all papers).
    function addEverythingIfListEmpty() {
        const rows = document.querySelectorAll('#questionsTable tbody tr');
        if (rows.length > 0) return;

        if (activeMode() === 'syllabus') {
            const tab = document.querySelector('.tab[data-mode="year-gs"]');
            if (tab) tab.click();
        }

        const yearsAll = $('yearsAll');
        const papersAll = $('papersAll');
        const addBtn = $('addSetBtn');
        if (!yearsAll || !papersAll || !addBtn) return;

        yearsAll.click();
        papersAll.click();
        if (addBtn.disabled) return;

        lastAddedSignature = signature('year-gs');
        addBtn.click();

        const status = $('statusMsg');
        if (status) status.textContent = 'Nothing was selected, so all years and papers were added.';
    }

    // Tab switch or a manual "Add to list" resets the guard so later picks work.
    document.addEventListener('click', function (e) {
        const btn = e.target.closest ? e.target.closest('button') : null;
        if (!btn) return;
        if (btn.id === 'addSetBtn' || btn.id === 'addSyllabusSetBtn' ||
            btn.id === 'resetQuestions' || btn.classList.contains('tab')) {
            lastAddedSignature = '';
        }
    });
})();