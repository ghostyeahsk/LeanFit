const test = require('node:test');
const assert = require('node:assert/strict');
const calculator = require('../miniprogram/utils/calculator');

test('calculateLeanMetrics correctly classifies lean_bulk, recomp, and cut_lean', () => {
  const thin = calculator.calculateLeanMetrics({ heightCm: 180, weightKg: 58, age: 24 });
  assert.equal(thin.stageKey, 'lean_bulk');
  assert.ok(thin.bmi < 19.5);
  assert.ok(thin.targetCalories > thin.tdee);
  assert.ok(thin.macros.proteinG >= 110);

  const recomp = calculator.calculateLeanMetrics({ heightCm: 178, weightKg: 70, age: 26 });
  assert.equal(recomp.stageKey, 'recomp');
  assert.ok(recomp.bmi >= 19.5 && recomp.bmi <= 23.5);
  assert.ok(recomp.restDayCalories < recomp.targetCalories);

  const cut = calculator.calculateLeanMetrics({ heightCm: 175, weightKg: 82, age: 28 });
  assert.equal(cut.stageKey, 'cut_lean');
  assert.ok(cut.bmi > 23.5);
  assert.ok(cut.targetCalories < cut.tdee);
});

test('calcTimeSlotDuration handles normal and overnight ranges', () => {
  assert.equal(calculator.calcTimeSlotDuration('19:30', '20:20'), 50);
  assert.equal(calculator.calcTimeSlotDuration('07:00', '07:45'), 45);
  assert.equal(calculator.calcTimeSlotDuration('23:30', '00:15'), 45);
});

test('estimateCaloriesBurned computes MET-based kcal', () => {
  const zero = calculator.estimateCaloriesBurned({ weightKg: 70, completedSets: 0, totalSets: 16 });
  assert.equal(zero, 0);

  const full = calculator.estimateCaloriesBurned({
    weightKg: 70,
    avgMet: 5.0,
    completedSets: 16,
    totalSets: 16,
    durationMin: 60
  });
  assert.equal(full, 350);
});

test('calculateHeatmapLevel maps 0..4 accurately', () => {
  assert.equal(calculator.calculateHeatmapLevel(null), 0);
  assert.equal(calculator.calculateHeatmapLevel({ completedSets: 0, totalSets: 10, completedMeals: [] }), 0);
  assert.equal(calculator.calculateHeatmapLevel({ completedSets: 2, totalSets: 10, completedMeals: [] }), 1);
  assert.equal(calculator.calculateHeatmapLevel({ completedSets: 0, totalSets: 10, completedMeals: ['breakfast'] }), 1);
  assert.equal(calculator.calculateHeatmapLevel({ completedSets: 6, totalSets: 10, completedMeals: [] }), 2);
  assert.equal(
    calculator.calculateHeatmapLevel({ completedSets: 10, totalSets: 10, workoutCompleted: true, completedMeals: ['breakfast'] }),
    3
  );
  assert.equal(
    calculator.calculateHeatmapLevel({
      completedSets: 10,
      totalSets: 10,
      workoutCompleted: true,
      completedMeals: ['breakfast', 'lunch', 'dinner']
    }),
    4
  );
});

test('buildHeatmapMatrix builds 26 weeks x 7 days aligned to Saturday with today marked', () => {
  const today = new Date('2026-11-25T10:00:00');
  const checkins = {
    '2026-11-25': {
      date: '2026-11-25',
      completedSets: 12,
      totalSets: 12,
      workoutCompleted: true,
      completedMeals: ['breakfast', 'lunch', 'snack', 'dinner']
    },
    '2026-11-24': {
      date: '2026-11-24',
      completedSets: 12,
      totalSets: 12,
      workoutCompleted: true,
      completedMeals: []
    }
  };

  const matrix = calculator.buildHeatmapMatrix(checkins, { weeks: 26, today });
  assert.equal(matrix.weeks.length, 26);
  assert.equal(matrix.totalActiveDays, 2);
  assert.equal(matrix.totalPerfectDays, 1);

  matrix.weeks.forEach((w) => {
    assert.equal(w.days.length, 7);
    assert.equal(w.days[0].weekday, 0);
    assert.equal(w.days[6].weekday, 6);
  });

  const lastWeek = matrix.weeks[matrix.weeks.length - 1];
  const todayCell = lastWeek.days.find((d) => d.date === '2026-11-25');
  assert.ok(todayCell);
  assert.equal(todayCell.isToday, true);
  assert.equal(todayCell.level, 4);

  const streak = calculator.calculateStreakStats(checkins, today);
  assert.equal(streak.currentStreak, 2);
  assert.equal(streak.longestStreak, 2);
  assert.equal(streak.totalCheckinDays, 2);
});
