const planGenerator = require('../../utils/planGenerator');
const storage = require('../../utils/storage');

const SCENE_TABS = [
  { key: 'bodyweight', label: '居家徒手' },
  { key: 'dumbbell', label: '居家哑铃' },
  { key: 'gym', label: '健身房' }
];

Page({
  data: {
    profile: null,
    weekSplit: [],
    todayDayOfWeek: 1,
    selectedDayOfWeek: 1,
    selectedPlan: null,
    sceneTabs: SCENE_TABS
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

    const todayDayOfWeek = planGenerator.getTodayDayOfWeek(new Date());
    const selectedDayOfWeek = this.data.selectedPlan ? this.data.selectedDayOfWeek : todayDayOfWeek;
    const selectedPlan = weekSplit.find((d) => d.dayOfWeek === selectedDayOfWeek) || weekSplit[0];

    this.setData({
      profile,
      weekSplit,
      todayDayOfWeek,
      selectedDayOfWeek,
      selectedPlan
    });
  },

  onSelectDay(e) {
    const day = Number(e.currentTarget.dataset.day);
    const selectedPlan = this.data.weekSplit.find((d) => d.dayOfWeek === day) || this.data.weekSplit[0];
    this.setData({
      selectedDayOfWeek: day,
      selectedPlan
    });
  },

  onSwitchScene(e) {
    const scene = e.currentTarget.dataset.scene;
    const profile = this.data.profile;
    if (!profile || profile.scene === scene) return;

    const updatedProfile = storage.saveUserProfile({
      ...profile,
      scene
    });
    const weekSplit = planGenerator.generateWeeklyPlan(updatedProfile);
    storage.saveWeeklyPlan(weekSplit);

    const selectedPlan = weekSplit.find((d) => d.dayOfWeek === this.data.selectedDayOfWeek) || weekSplit[0];
    this.setData({
      profile: updatedProfile,
      weekSplit,
      selectedPlan
    });

    wx.showToast({ title: '已切换场景并更新周计划', icon: 'none' });
  },

  onGoToday() {
    wx.switchTab({ url: '/pages/today/today' });
  }
});
