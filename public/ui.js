/* ===== C25K Companion — ui.js ===== */
/* Reusable UI builders: timeline bars, active timeline, program overview */
(function () {
  'use strict';

  const ns = window.C25K;
  const { $, $$, fmtDuration, formatDurationShort, totalDuration, workoutLabel } = ns;

  // ─── Show/hide screens ─────────────────────────────────────
  ns.showScreen = function (id) {
    $$('.screen').forEach(s => s.hidden = true);
    $(id).hidden = false;
    window.scrollTo(0, 0);
  };

  // ─── Build timeline bar for a workout ──────────────────────
  ns.buildTimelineBar = function (container, segments) {
    container.innerHTML = '';
    const total = totalDuration(segments);
    segments.forEach(s => {
      const el = document.createElement('div');
      el.className = `seg seg-${s.type}`;
      el.style.flex = `${s.duration / total}`;
      const dur = s.duration >= 60 ? `${Math.round(s.duration / 60)}m` : `${s.duration}s`;
      el.textContent = s.duration / total > 0.08 ? dur : '';
      container.appendChild(el);
    });
  };

  // ─── Build active timeline list ────────────────────────────
  ns.buildActiveTimeline = function (container, segments, activeIdx) {
    container.innerHTML = '';

    function segLabel(s) {
      return s.type === 'warmup' ? 'Warmup Walk' : s.type === 'jog' ? 'Jog' : 'Walk';
    }

    // 1) Completed sections
    if (activeIdx > 0) {
      const doneTime = segments.slice(0, activeIdx).reduce((a, s) => a + s.duration, 0);
      const el = document.createElement('div');
      el.className = 'tl-item done';
      el.innerHTML = `<span class="tl-dot"></span><span>${activeIdx} section${activeIdx > 1 ? 's' : ''} completed</span><span class="tl-dur">${formatDurationShort(doneTime)}</span>`;
      container.appendChild(el);
    }

    // 2) Current section
    const cur = segments[activeIdx];
    const curEl = document.createElement('div');
    curEl.className = 'tl-item active';
    curEl.innerHTML = `<span class="tl-dot"></span><span>${segLabel(cur)}</span><span class="tl-dur">${formatDurationShort(cur.duration)}</span>`;
    container.appendChild(curEl);

    // 3) Next section
    if (activeIdx + 1 < segments.length) {
      const nxt = segments[activeIdx + 1];
      const nxtEl = document.createElement('div');
      nxtEl.className = 'tl-item';
      nxtEl.innerHTML = `<span class="tl-dot"></span><span>Up next: ${segLabel(nxt)}</span><span class="tl-dur">${formatDurationShort(nxt.duration)}</span>`;
      container.appendChild(nxtEl);
    }

    // 4) Remaining sections after next
    const remainStart = activeIdx + 2;
    if (remainStart < segments.length) {
      const remainCount = segments.length - remainStart;
      const remainTime = segments.slice(remainStart).reduce((a, s) => a + s.duration, 0);
      const remEl = document.createElement('div');
      remEl.className = 'tl-item remaining';
      remEl.innerHTML = `<span class="tl-dot"></span><span>${remainCount} more segment${remainCount > 1 ? 's' : ''}</span><span class="tl-dur">${formatDurationShort(remainTime)}</span>`;
      container.appendChild(remEl);
    }
  };

  // ─── Build program overview (expandable week list) ─────────
  ns.buildProgramOverview = function (data, callbacks) {
    const PLAN = ns.PLAN;
    const container = $('#program-weeks');
    container.innerHTML = '';
    const currentIdx = data.currentWorkout;

    for (let week = 1; week <= 9; week++) {
      const weekWorkouts = PLAN.filter(w => w.week === week);
      const firstIdx = PLAN.indexOf(weekWorkouts[0]);
      const lastIdx = PLAN.indexOf(weekWorkouts[weekWorkouts.length - 1]);

      const details = document.createElement('details');
      details.className = 'week-group';

      const isCurrent = currentIdx >= firstIdx && currentIdx <= lastIdx;
      const isDone = currentIdx > lastIdx;
      if (isCurrent) details.open = true;

      let badge = '';
      if (isDone) badge = '<span class="week-badge badge-done">Done</span>';
      else if (isCurrent) badge = '<span class="week-badge badge-current">Current</span>';

      const summary = document.createElement('summary');
      summary.innerHTML = `Week ${week}${badge}`;
      details.appendChild(summary);

      const list = document.createElement('div');
      list.className = 'wo-list';

      weekWorkouts.forEach(w => {
        const woIdx = PLAN.indexOf(w);
        const done = woIdx < currentIdx;
        const current = woIdx === currentIdx;
        const selected = ns.hasOverride(data) && data.overrideWorkoutIdx === woIdx;

        const wrapper = document.createElement('div');
        wrapper.className = 'wo-list-entry';

        const el = document.createElement('div');
        el.className = 'wo-list-item' + (done ? ' wo-done' : '') + (current ? ' wo-current' : '') + (selected ? ' wo-selected' : '');
        el.style.cursor = 'pointer';

        const checkContent = done ? '\u2713' : '';
        const dur = formatDurationShort(totalDuration(w.segments));
        el.innerHTML = `
          <span class="wo-check">${checkContent}</span>
          <span>Day ${w.day}</span>
          <span class="wo-actions">
            <button class="btn btn-link btn-muted wo-set-next-inline" data-idx="${woIdx}">Set next</button>
            <span class="wo-dur">${dur}</span>
          </span>
        `;
        wrapper.appendChild(el);

        // Expandable workout preview
        const preview = document.createElement('div');
        preview.className = 'wo-preview';
        preview.hidden = true;
        preview.innerHTML = `
          <div class="timeline-legend wo-legend">
            <span class="legend-item"><span class="legend-swatch seg-warmup"></span>Warmup</span>
            <span class="legend-item"><span class="legend-swatch seg-jog"></span>Jog</span>
            <span class="legend-item"><span class="legend-swatch seg-walk"></span>Walk</span>
          </div>
          <div class="timeline-preview wo-timeline"></div>
          <div class="workout-total-time">Total: ${dur}</div>
        `;
        wrapper.appendChild(preview);

        const setBtn = el.querySelector('.wo-set-next-inline');
        setBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (woIdx === data.currentWorkout) {
            data.overrideWorkoutIdx = null;
          } else {
            data.overrideWorkoutIdx = woIdx;
          }
          ns.saveData(data);
          callbacks.onSetNext();
        });

        el.addEventListener('click', () => {
          const isOpen = !preview.hidden;
          list.querySelectorAll('.wo-preview').forEach(p => p.hidden = true);
          list.querySelectorAll('.wo-list-item').forEach(i => i.classList.remove('wo-expanded'));
          if (!isOpen) {
            preview.hidden = false;
            el.classList.add('wo-expanded');
            const tlContainer = preview.querySelector('.wo-timeline');
            if (!tlContainer.hasChildNodes()) {
              ns.buildTimelineBar(tlContainer, w.segments);
            }
          }
        });

        list.appendChild(wrapper);
      });

      details.appendChild(list);
      container.appendChild(details);
    }
  };
})();
