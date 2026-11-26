const calculator = require('../../utils/calculator');
const planGenerator = require('../../utils/planGenerator');
const storage = require('../../utils/storage');
const { SCENE_LABELS } = require('../../data/exercises');

Page({
  data: {
    profile: null,
    sceneLabel: '',
    checkinsMap: {},
    streakStats: {
      currentStreak: 0,
      longestStreak: 0,
      totalCheckinDays: 0
    },
    weightLogs: [],
    weightInput: '',
    cloudReady: false
  },

  onShow() {
    this.loadData();
  },

  loadData() {
    const profile = storage.getUserProfile();
    if (!profile) {
      wx.redirectTo({ url: '/pages/onboarding/onboarding' });
      return;
    }

    const checkinsMap = storage.getAllCheckins();
    const streakStats = calculator.calculateStreakStats(checkinsMap, new Date());
    const weightLogs = storage.getWeightLogs();

    this.setData({
      profile,
      sceneLabel: SCENE_LABELS[profile.scene] || '居家哑铃',
      checkinsMap,
      streakStats,
      weightLogs: weightLogs.slice(0, 7),
      weightInput: String(profile.weightKg || ''),
      cloudReady: storage.isCloudReady()
    });
  },

  onWeightInputChange(e) {
    this.setData({ weightInput: e.detail.value });
  },

  onLogWeight() {
    const val = Number(this.data.weightInput);
    if (Number.isNaN(val) || val < 35 || val > 180) {
      wx.showToast({ title: '请输入 35~180 kg 合理体重', icon: 'none' });
      return;
    }

    const profile = this.data.profile;
    const updatedMetrics = calculator.calculateLeanMetrics({
      heightCm: profile.heightCm,
      weightKg: val,
      age: profile.age
    });

    const updatedProfile = storage.saveUserProfile({
      ...profile,
      weightKg: val,
      metrics: updatedMetrics
    });

    storage.addWeightLog(val, profile.heightCm);
    const weekSplit = planGenerator.generateWeeklyPlan(updatedProfile);
    storage.saveWeeklyPlan(weekSplit);

    this.loadData();
    wx.showToast({ title: '已记录今日体重并更新指标', icon: 'success' });
  },

  onEditProfile() {
    wx.navigateTo({
      url: '/pages/onboarding/onboarding?mode=edit'
    });
  },

  async onManualSync() {
    if (!storage.isCloudReady()) {
      wx.showModal({
        title: '本地离线模式',
        content: '当前未配置微信云开发 CLOUD_ENV_ID，所有数据已安全保存在本地。如需开启多端云同步，请参考项目 README 在 app.js 中填入云环境 ID。',
        showCancel: false
      });
      return;
    }
    wx.showLoading({ title: '云端同步中...' });
    await storage.pullFromCloud();
    wx.hideLoading();
    this.loadData();
    wx.showToast({ title: '云端数据已同步', icon: 'success' });
  }
});
