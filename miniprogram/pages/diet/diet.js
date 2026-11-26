const calculator = require('../../utils/calculator');
const planGenerator = require('../../utils/planGenerator');
const storage = require('../../utils/storage');

Page({
  data: {
    todayKey: '',
    profile: null,
    isTrainingDay: true,
    dietPlan: null,
    completedMeals: [],
    consumed: {
      calories: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0
    },
    macroPercents: {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0
    }
  },

  onShow() {
    const profile = storage.getUserProfile();
    if (!profile) {
      wx.redirectTo({ url: '/pages/onboarding/onboarding' });
      return;
    }

    let weekSplit = storage.getWeeklyPlan();
    if (!Array.isArray(weekSplit) || weekSplit.length !== 7) {
      weekSplit = planGenerator.generateWeeklyPlan(profile);
      storage.saveWeeklyPlan(weekSplit);
    }

    const now = new Date();
    const todayKey = calculator.formatDateKey(now);
    const dayOfWeek = planGenerator.getTodayDayOfWeek(now);
    const todayPlan = weekSplit.find((d) => d.dayOfWeek === dayOfWeek) || weekSplit[0];
    const isTrainingDay = !todayPlan.isRest && !todayPlan.isRecovery;

    this.setData({ profile, todayKey, isTrainingDay }, () => {
      this.refreshDiet();
    });
  },

  refreshDiet() {
    const { profile, todayKey, isTrainingDay } = this.data;
    const overrides = storage.getMealOverrides(todayKey);
    const daySeed = new Date().getDate();
    const dietPlan = planGenerator.generateDailyDiet(profile, isTrainingDay, overrides, daySeed);

    const checkin = storage.getCheckinByDate(todayKey);
    const completedMeals = (checkin && Array.isArray(checkin.completedMeals)) ? checkin.completedMeals : [];

    const enrichedMeals = dietPlan.meals.map((m) => ({
      ...m,
      eaten: completedMeals.includes(m.slotKey)
    }));
    dietPlan.meals = enrichedMeals;

    const consumed = enrichedMeals.reduce(
      (acc, m) => {
        if (m.eaten) {
          acc.calories += m.calories;
          acc.proteinG += m.proteinG;
          acc.carbsG += m.carbsG;
          acc.fatG += m.fatG;
        }
        return acc;
      },
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
    );

    const clamp = (val, target) => (target > 0 ? Math.min(100, Math.round((val / target) * 100)) : 0);
    const macroPercents = {
      calories: clamp(consumed.calories, dietPlan.targetCalories),
      protein: clamp(consumed.proteinG, dietPlan.targetMacros.proteinG),
      carbs: clamp(consumed.carbsG, dietPlan.targetMacros.carbsG),
      fat: clamp(consumed.fatG, dietPlan.targetMacros.fatG)
    };

    this.setData({
      dietPlan,
      completedMeals,
      consumed,
      macroPercents
    });
  },

  onToggleDayType() {
    this.setData({ isTrainingDay: !this.data.isTrainingDay }, () => {
      this.refreshDiet();
    });
  },

  onSwapMeal(e) {
    const { slotKey, currentIdx, count } = e.currentTarget.dataset;
    const nextIdx = (Number(currentIdx) + 1) % Number(count);
    const overrides = storage.getMealOverrides(this.data.todayKey);
    overrides[slotKey] = nextIdx;
    storage.saveMealOverrides(this.data.todayKey, overrides);
    this.refreshDiet();
    wx.showToast({ title: '已为你更换一份同热量食谱', icon: 'none' });
  },

  onToggleMealDone(e) {
    const slotKey = e.currentTarget.dataset.slotKey;
    const current = [...this.data.completedMeals];
    const idx = current.indexOf(slotKey);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(slotKey);
    }

    storage.saveCheckin(this.data.todayKey, {
      completedMeals: current
    });

    this.refreshDiet();
    if (idx < 0) {
      wx.showToast({
        title: current.length >= 3 ? '饮食达标！已同步至热力图' : '已打卡该餐',
        icon: 'none'
      });
    }
  }
});
