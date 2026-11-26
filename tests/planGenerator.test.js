const test = require('node:test');
const assert = require('node:assert/strict');
const calculator = require('../miniprogram/utils/calculator');
const planGenerator = require('../miniprogram/utils/planGenerator');

test('generateWeeklyPlan generates valid 7-day split for all 3 scenes and durations', () => {
  const scenes = ['bodyweight', 'dumbbell', 'gym'];
  const durations = [30, 45, 60];

  for (const scene of scenes) {
    for (const durationMin of durations) {
      const metrics = calculator.calculateLeanMetrics({ heightCm: 178, weightKg: 70, age: 25 });
      const plan = planGenerator.generateWeeklyPlan({ scene, durationMin, metrics });
      assert.equal(plan.length, 7, `7 days expected for ${scene}/${durationMin}`);

      const trainingDays = plan.filter((d) => !d.isRest);
      assert.equal(trainingDays.length, 6);
      trainingDays.forEach((d) => {
        assert.ok(d.exercises.length >= 3, `${d.title} should have >=3 exercises`);
        assert.ok(d.totalSets > 0);
        assert.ok(d.avgMet > 0);
      });

      const restDay = plan.find((d) => d.dayOfWeek === 7);
      assert.equal(restDay.isRest, true);
      assert.equal(restDay.exercises.length, 0);
    }
  }
});

test('generateDailyDiet scales calories and supports meal swapping', () => {
  const metrics = calculator.calculateLeanMetrics({ heightCm: 180, weightKg: 74, age: 25 });
  const profile = { metrics };

  const trainDiet = planGenerator.generateDailyDiet(profile, true, {}, 3);
  const restDiet = planGenerator.generateDailyDiet(profile, false, {}, 3);

  assert.equal(trainDiet.meals.length, 4);
  assert.equal(restDiet.meals.length, 4);
  assert.ok(trainDiet.targetCalories > restDiet.targetCalories);
  assert.ok(Math.abs(trainDiet.summary.calories - trainDiet.targetCalories) < 120);

  const originalBreakfastId = trainDiet.meals[0].id;
  const swapped = planGenerator.generateDailyDiet(
    profile,
    true,
    { breakfast: (trainDiet.meals[0].templateIndex + 1) % trainDiet.meals[0].templateCount },
    3
  );
  assert.notEqual(swapped.meals[0].id, originalBreakfastId);
});
