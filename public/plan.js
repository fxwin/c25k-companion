/* ===== C25K Companion — plan.js ===== */
/* Workout plan data */
(function () {
  'use strict';

  const WARMUP_SEC = 300;

  function warmup() { return { type: 'warmup', duration: WARMUP_SEC }; }

  // totalMinutes excludes warmup. Keeps total time exact; ends on a jog.
  function alternate(jogSec, walkSec, totalMinutes) {
    const segs = [];
    const totalSec = totalMinutes * 60;
    let elapsed = 0;

    while (elapsed < totalSec) {
      // Jog
      const j = Math.min(jogSec, totalSec - elapsed);
      segs.push({ type: 'jog', duration: j });
      elapsed += j;
      if (elapsed >= totalSec) break;

      // Walk
      const w = Math.min(walkSec, totalSec - elapsed);
      segs.push({ type: 'walk', duration: w });
      elapsed += w;
    }

    // Ensure we end on a jog (swap last two if needed)
    if (segs.length >= 2 && segs[segs.length - 1].type === 'walk') {
      const lastWalk = segs.pop();
      const lastJog = segs.pop();
      segs.push(lastWalk);
      segs.push(lastJog);
    }

    return segs;
  }

  function repeat(pattern, n) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(...pattern);
    return out;
  }

  window.C25K = window.C25K || {};
  window.C25K.PLAN = [
    // Test workout (remove before going live)
    { week: 0, day: 1, segments: [
      { type: 'warmup', duration: 120 },
      { type: 'jog', duration: 60 }, { type: 'walk', duration: 90 },
      { type: 'jog', duration: 60 }, { type: 'walk', duration: 90 },
    ]},

    // Week 1 (unchanged)
    { week: 1, day: 1, segments: [warmup(), ...alternate(60, 90, 20)] },
    { week: 1, day: 2, segments: [warmup(), ...alternate(60, 90, 20)] },
    { week: 1, day: 3, segments: [warmup(), ...alternate(60, 90, 20)] },

    // Week 2 (day 3 extended to 30 min total incl warmup => 25 min alternations)
    { week: 2, day: 1, segments: [warmup(), ...alternate(90, 120, 20)] },
    { week: 2, day: 2, segments: [warmup(), ...alternate(90, 120, 20)] },
    { week: 2, day: 3, segments: [warmup(), ...alternate(90, 120, 25)] },

    // Week 3 (day 3 extended to 35 min total incl warmup => 30 min work)
    { week: 3, day: 1, segments: [
      warmup(),
      { type: 'jog', duration: 90 }, { type: 'walk', duration: 90 },
      { type: 'jog', duration: 180 }, { type: 'walk', duration: 180 },
      { type: 'jog', duration: 90 }, { type: 'walk', duration: 90 },
      { type: 'jog', duration: 180 }, { type: 'walk', duration: 180 },
    ]},
    { week: 3, day: 2, segments: [
      warmup(),
      { type: 'jog', duration: 90 }, { type: 'walk', duration: 90 },
      { type: 'jog', duration: 180 }, { type: 'walk', duration: 180 },
      { type: 'jog', duration: 90 }, { type: 'walk', duration: 90 },
      { type: 'jog', duration: 180 }, { type: 'walk', duration: 180 },
    ]},
    { week: 3, day: 3, segments: [
      warmup(),
      ...repeat([
        { type: 'jog', duration: 90 }, { type: 'walk', duration: 90 },
        { type: 'jog', duration: 180 }, { type: 'walk', duration: 180 },
      ], 3), // 27 min
      { type: 'jog', duration: 90 }, { type: 'walk', duration: 90 }, // +3 min => 30 min
    ]},

    // Week 4 (day 3 extended to 40 min total incl warmup => 35 min work)
    { week: 4, day: 1, segments: [
      warmup(),
      { type: 'jog', duration: 180 }, { type: 'walk', duration: 90 },
      { type: 'jog', duration: 300 }, { type: 'walk', duration: 150 },
      { type: 'jog', duration: 180 }, { type: 'walk', duration: 90 },
      { type: 'jog', duration: 300 },
    ]},
    { week: 4, day: 2, segments: [
      warmup(),
      { type: 'jog', duration: 180 }, { type: 'walk', duration: 90 },
      { type: 'jog', duration: 300 }, { type: 'walk', duration: 150 },
      { type: 'jog', duration: 180 }, { type: 'walk', duration: 90 },
      { type: 'jog', duration: 300 },
    ]},
    { week: 4, day: 3, segments: [
      warmup(),
      ...repeat([{ type: 'jog', duration: 300 }, { type: 'walk', duration: 150 }], 4),
      { type: 'jog', duration: 300 }, // total after warmup: 35 min
    ]},

    // Week 5 (day 3: warmup + 40 min run)
    {
      week: 5, day: 1, segments: [
        warmup(),
        { type: 'jog', duration: 300 }, { type: 'walk', duration: 180 },
        { type: 'jog', duration: 300 }, { type: 'walk', duration: 180 },
        { type: 'jog', duration: 300 },
      ]
    },
    {
      week: 5, day: 2, segments: [
        warmup(),
        { type: 'jog', duration: 480 }, { type: 'walk', duration: 300 },
        { type: 'jog', duration: 480 },
      ]
    },
    { week: 5, day: 3, segments: [warmup(), { type: 'jog', duration: 2400 }] },

    // Week 6 (day 3: warmup + 45 min run)
    {
      week: 6, day: 1, segments: [
        warmup(),
        { type: 'jog', duration: 300 }, { type: 'walk', duration: 180 },
        { type: 'jog', duration: 480 }, { type: 'walk', duration: 180 },
        { type: 'jog', duration: 300 },
      ]
    },
    {
      week: 6, day: 2, segments: [
        warmup(),
        { type: 'jog', duration: 600 }, { type: 'walk', duration: 180 },
        { type: 'jog', duration: 600 },
      ]
    },
    { week: 6, day: 3, segments: [warmup(), { type: 'jog', duration: 2700 }] },

    // Week 7 (day 3: warmup + 50 min run)
    { week: 7, day: 1, segments: [warmup(), { type: 'jog', duration: 1500 }] },
    { week: 7, day: 2, segments: [warmup(), { type: 'jog', duration: 1500 }] },
    { week: 7, day: 3, segments: [warmup(), { type: 'jog', duration: 3000 }] },

    // Week 8 (day 3: warmup + 55 min run)
    { week: 8, day: 1, segments: [warmup(), { type: 'jog', duration: 1680 }] },
    { week: 8, day: 2, segments: [warmup(), { type: 'jog', duration: 1680 }] },
    { week: 8, day: 3, segments: [warmup(), { type: 'jog', duration: 3300 }] },

    // Week 9 (day 3: warmup + 60 min run)
    { week: 9, day: 1, segments: [warmup(), { type: 'jog', duration: 1800 }] },
    { week: 9, day: 2, segments: [warmup(), { type: 'jog', duration: 1800 }] },
    { week: 9, day: 3, segments: [warmup(), { type: 'jog', duration: 3600 }] },
  ];
})();