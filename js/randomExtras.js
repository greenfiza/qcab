/* randomExtras.js
 * Load AFTER populateQuestions.js and generatePDF.js:
 *   <script src="js/randomExtras.js"></script>
 *
 * 1. After "Pick random", removes every question that was not picked.
 * 2. Adds a "Random modal" button that shows one random question at a time
 *    (Next / Previous, no repeats) from the questions currently in the list.
 */
(function () {
    'use strict';

    const tbody = document.querySelector('#questionsTable tbody');
    const randomBtn = document.getElementById('randomBtn');
    const pickBtn = document.getElementById('generateRandomQuestions');
    if (!tbody || !randomBtn) return;

    /* ---------- helpers ---------- */
    function cellText(cell) {
        if (!cell) return '';
        const f = cell.querySelector('input:not([type=checkbox]), textarea, select');
        return ((f ? f.value : cell.textContent) || '').trim();
    }

    function readRows() {
        return Array.from(tbody.querySelectorAll('tr')).map(function (tr) {
            const c = tr.children;
            return {
                year: cellText(c[1]),
                paper: cellText(c[2]),
                text: cellText(c[3]),
                marks: cellText(c[4]),
                words: cellText(c[5])
            };
        }).filter(function (q) { return q.text; });
    }

    /* ---------- 1. random pick also removes unselected ---------- */
    if (pickBtn) {
        pickBtn.addEventListener('click', function () {
            // Runs after the existing handler (which ticks the random rows).
            setTimeout(function () {
                const rows = Array.from(tbody.querySelectorAll('tr'));
                const anyChecked = rows.some(function (tr) {
                    const cb = tr.querySelector('input[type=checkbox]');
                    return cb && cb.checked;
                });
                if (!anyChecked) return; // nothing was picked, keep list as is

                rows.forEach(function (tr) {
                    const cb = tr.querySelector('input[type=checkbox]');
                    if (cb && !cb.checked) tr.remove();
                });

                // Let the page refresh counts / empty state / marks
                const remaining = tbody.querySelector('input[type=checkbox]');
                if (remaining) remaining.dispatchEvent(new Event('change', { bubbles: true }));
                const sel = document.getElementById('selectAll');
                if (sel) sel.checked = true;
                document.dispatchEvent(new CustomEvent('questions:pruned'));
            }, 0);
        });
    }

    /* ---------- 2. random modal ---------- */
    const style = document.createElement('style');
    style.textContent = [
        '.rq-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;z-index:1000;padding:16px}',
        '.rq-overlay.open{display:flex}',
        '.rq-box{background:#fff;border-radius:14px;max-width:720px;width:100%;max-height:90vh;overflow:auto;padding:22px;box-shadow:0 10px 40px rgba(0,0,0,.25)}',
        '.rq-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}',
        '.rq-head h2{margin:0;font-size:1.15rem}',
        '.rq-close{border:0;background:none;font-size:1.5rem;cursor:pointer;line-height:1}',
        '.rq-filters{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px}',
        '.rq-filters select{padding:8px 10px;border-radius:8px;border:1px solid #d8d2c4;background:#faf8f2}',
        '.rq-meta{font-size:.85rem;color:#6b6659;margin-bottom:8px}',
        '.rq-question{font-size:1.05rem;line-height:1.55;padding:16px;border:1px solid #e6e0d2;border-radius:10px;background:#faf8f2;min-height:110px;white-space:pre-wrap}',
        '.rq-nav{display:flex;justify-content:space-between;align-items:center;margin-top:16px;gap:10px}',
        '.rq-nav button{padding:9px 18px;border-radius:8px;border:1px solid #d8d2c4;background:#fff;cursor:pointer;font-size:.95rem}',
        '.rq-nav button.rq-next{background:#2f6b4f;color:#fff;border-color:#2f6b4f}',
        '.rq-nav button:disabled{opacity:.45;cursor:not-allowed}',
        '.rq-count{font-size:.85rem;color:#6b6659}',

        /* ---- bigger modal, bigger question ---- */
        '.rq-box{max-width:1000px;width:94vw;min-height:70vh;max-height:94vh;padding:28px;display:flex;flex-direction:column}',
        '.rq-head h2{font-size:1.4rem}',
        '.rq-filters select{font-size:1rem;padding:10px 12px;min-width:180px}',
        '.rq-meta{font-size:1rem;margin-bottom:12px}',
        '.rq-question{flex:1;font-size:clamp(.93rem,1.8vw,1.31rem);line-height:1.65;padding:28px;min-height:260px;overflow:auto}',
        '.rq-nav{margin-top:20px}',
        '.rq-nav button{padding:14px 30px;font-size:1.05rem;min-width:120px}',
        '.rq-count{font-size:.95rem}',

        /* ---- mobile: near full screen, stacked controls, big tap targets ---- */
        '@media (max-width:640px){',
        '.rq-overlay{padding:0;align-items:stretch}',
        '.rq-box{width:100vw;max-width:none;min-height:100vh;min-height:100dvh;max-height:100dvh;border-radius:0;padding:16px}',
        '.rq-head h2{font-size:1.2rem}',
        '.rq-filters{flex-direction:column;gap:8px}',
        '.rq-filters select{width:100%;min-width:0;font-size:16px}',
        '.rq-question{font-size:.93rem;line-height:1.6;padding:18px;min-height:0}',
        '.rq-nav{position:sticky;bottom:0;background:#fff;padding-top:12px;padding-bottom:env(safe-area-inset-bottom,0);flex-wrap:wrap}',
        '.rq-nav button{flex:1;min-width:0;padding:16px 10px}',
        '.rq-count{order:-1;width:100%;text-align:center}',
        '}'
    ].join('');
    document.head.appendChild(style);

    // Button right after the Random button
    const modalBtn = document.createElement('button');
    modalBtn.type = 'button';
    modalBtn.id = 'randomModalBtn';
    modalBtn.className = randomBtn.className;
    modalBtn.textContent = 'Random modal';
    randomBtn.insertAdjacentElement('afterend', modalBtn);

    const overlay = document.createElement('div');
    overlay.className = 'rq-overlay';
    overlay.innerHTML =
        '<div class="rq-box" role="dialog" aria-modal="true" aria-label="Random question">' +
        '<div class="rq-head"><h2>Random question</h2><button type="button" class="rq-close" aria-label="Close">&times;</button></div>' +
        '<div class="rq-filters">' +
        '<select id="rqPaper"></select><select id="rqYear"></select></div>' +
        '<div class="rq-meta" id="rqMeta"></div>' +
        '<div class="rq-question" id="rqQuestion"></div>' +
        '<div class="rq-nav"><button type="button" id="rqPrev">Previous</button>' +
        '<span class="rq-count" id="rqCount"></span>' +
        '<button type="button" class="rq-next" id="rqNext">Next</button></div>' +
        '</div>';
    document.body.appendChild(overlay);

    const paperSel = overlay.querySelector('#rqPaper');
    const yearSel = overlay.querySelector('#rqYear');
    const metaEl = overlay.querySelector('#rqMeta');
    const qEl = overlay.querySelector('#rqQuestion');
    const prevBtn = overlay.querySelector('#rqPrev');
    const nextBtn = overlay.querySelector('#rqNext');
    const countEl = overlay.querySelector('#rqCount');

    let all = [];       // every question in the list
    let pool = [];      // filtered by subject + year
    let history = [];   // questions shown so far (in order)
    let pos = -1;       // current position in history
    const used = new Set();

    function fillSelect(sel, label, values) {
        const keep = sel.value;
        sel.innerHTML = '<option value="">' + label + '</option>' +
            values.map(function (v) { return '<option value="' + v.replace(/"/g, '&quot;') + '">' + v + '</option>'; }).join('');
        if (values.indexOf(keep) !== -1) sel.value = keep;
    }

    function uniqueSorted(key) {
        return Array.from(new Set(all.map(function (q) { return q[key]; }).filter(Boolean))).sort();
    }

    function rebuildPool() {
        pool = all.filter(function (q) {
            return (!paperSel.value || q.paper === paperSel.value) &&
                   (!yearSel.value || q.year === yearSel.value);
        });
        history = [];
        pos = -1;
        used.clear();
        showNext();
    }

    function render() {
        if (!pool.length) {
            metaEl.textContent = '';
            qEl.textContent = 'No questions match this subject and year. Add questions to the list first, or change the filters.';
            countEl.textContent = '';
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            return;
        }
        const q = history[pos];
        metaEl.textContent = [q.year, q.paper, q.marks ? q.marks + ' marks' : '', q.words ? q.words + ' words' : '']
            .filter(Boolean).join('  |  ');
        qEl.textContent = q.text;
        countEl.textContent = (pos + 1) + ' of ' + pool.length + ' seen: ' + used.size;
        prevBtn.disabled = pos <= 0;
        nextBtn.disabled = pos >= history.length - 1 && used.size >= pool.length;
    }

    function showNext() {
        if (pos < history.length - 1) {          // moving forward through history
            pos++;
        } else {
            const unused = pool.filter(function (q) { return !used.has(q); });
            if (unused.length) {
                const q = unused[Math.floor(Math.random() * unused.length)];
                used.add(q);
                history.push(q);
                pos = history.length - 1;
            }
        }
        render();
        if (pool.length && used.size >= pool.length && pos === history.length - 1) {
            countEl.textContent = 'All ' + pool.length + ' questions shown';
        }
    }

    function showPrev() {
        if (pos > 0) { pos--; render(); }
    }

    function openModal() {
        all = readRows();
        fillSelect(paperSel, 'All subjects', uniqueSorted('paper'));
        fillSelect(yearSel, 'All years', uniqueSorted('year'));
        overlay.classList.add('open');
        rebuildPool();
    }

    function closeModal() { overlay.classList.remove('open'); }

    modalBtn.addEventListener('click', openModal);
    overlay.querySelector('.rq-close').addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', function (e) {
        if (!overlay.classList.contains('open')) return;
        if (e.key === 'Escape') closeModal();
        else if (e.key === 'ArrowRight' && !nextBtn.disabled) showNext();
        else if (e.key === 'ArrowLeft') showPrev();
    });
    nextBtn.addEventListener('click', showNext);
    prevBtn.addEventListener('click', showPrev);
    paperSel.addEventListener('change', rebuildPool);
    yearSel.addEventListener('change', rebuildPool);
})();