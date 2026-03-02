/* ===== C25K Companion — plan.js ===== */
/* Workout plan data */
(function () {
  'use strict';

  function warmup() { return { type: 'warmup', duration: 300 }; }

  function alternate(jogSec, walkSec, totalMinutes) {
    const segs = [];
    const totalSec = totalMinutes * 60;
    let elapsed = 0;
    while (elapsed < totalSec) {
      segs.push({ type: 'jog', duration: jogSec });
      elapsed += jogSec;
      if (elapsed >= totalSec) break;
      segs.push({ type: 'walk', duration: walkSec });
      elapsed += walkSec;
    }
    return segs;
  }

  window.C25K = window.C25K || {};
  window.C25K.PLAN = [
    // Test workout (remove before going live)
    { week: 0, day: 1, segments: [
      { type: 'warmup', duration: 5 },
      { type: 'jog', duration: 3 }, { type: 'walk', duration: 3 },
      { type: 'jog', duration: 3 }, { type: 'walk', duration: 3 },
      { type: 'jog', duration: 3 }, { type: 'walk', duration: 3 },
      { type: 'jog', duration: 3 }, { type: 'walk', duration: 3 },
    ]},
    // Week 1
    { week: 1, day: 1, segments: [warmup(), ...alternate(60, 90, 20)] },
    { week: 1, day: 2, segments: [warmup(), ...alternate(60, 90, 20)] },
    { week: 1, day: 3, segments: [warmup(), ...alternate(60, 90, 20)] },
    // Week 2
    { week: 2, day: 1, segments: [warmup(), ...alternate(90, 120, 20)] },
    { week: 2, day: 2, segments: [warmup(), ...alternate(90, 120, 20)] },
    { week: 2, day: 3, segments: [warmup(), ...alternate(90, 120, 20)] },
    // Week 3
    ...[1, 2, 3].map(d => ({
      week: 3, day: d, segments: [
        warmup(),
        { type: 'jog', duration: 90 }, { type: 'walk', duration: 90 },
        { type: 'jog', duration: 180 }, { type: 'walk', duration: 180 },
        { type: 'jog', duration: 90 }, { type: 'walk', duration: 90 },
        { type: 'jog', duration: 180 }, { type: 'walk', duration: 180 },
      ]
    })),
    // Week 4
    ...[1, 2, 3].map(d => ({
      week: 4, day: d, segments: [
        warmup(),
        { type: 'jog', duration: 180 }, { type: 'walk', duration: 90 },
        { type: 'jog', duration: 300 }, { type: 'walk', duration: 150 },
        { type: 'jog', duration: 180 }, { type: 'walk', duration: 90 },
        { type: 'jog', duration: 300 },
      ]
    })),
    // Week 5
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
    {
      week: 5, day: 3, segments: [warmup(), { type: 'jog', duration: 1200 }]
    },
    // Week 6
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
    {
      week: 6, day: 3, segments: [warmup(), { type: 'jog', duration: 1500 }]
    },
    // Week 7
    ...[1, 2, 3].map(d => ({
      week: 7, day: d, segments: [warmup(), { type: 'jog', duration: 1500 }]
    })),
    // Week 8
    ...[1, 2, 3].map(d => ({
      week: 8, day: d, segments: [warmup(), { type: 'jog', duration: 1680 }]
    })),
    // Week 9
    ...[1, 2, 3].map(d => ({
      week: 9, day: d, segments: [warmup(), { type: 'jog', duration: 1800 }]
    })),
  ];
})();
