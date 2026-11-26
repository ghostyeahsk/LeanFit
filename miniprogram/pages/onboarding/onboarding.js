const calculator = require('../../utils/calculator');
const planGenerator = require('../../utils/planGenerator');
const storage = require('../../utils/storage');

const SCENE_OPTIONS = [
  { key: 'bodyweight', title: '居家徒手', desc: '零器械随时开练，俯卧撑/核心/HIIT' },
  { key: 'dumbbell', title: '居家哑铃', desc: '一对可调哑铃，高效打造宽肩上胸' },
  { key: 'gym', title: '健身房器械', desc: '系统分化器械与自由重量，塑形最快' }
];

Page({
  data: {
    isEditMode: false,
    heightCm: 176,
    weightKg: 68,
    age: 25,
    workoutStartTime: '19:30',
    workoutEndTime: '20:20',
    durationMin: 50,
    scene: 'dumbbell',
    sceneOptions: SCENE_OPTIONS,
    previewMetrics: null
  },

  onLoad(options) {
    const existing = storage.getUserProfile();
    const isEditMode = options && options.mode === 'edit';
    if (existing) {
      this.setData({
        isEditMode,
        heightCm: existing.heightCm || 176,
        weightKg: existing.weightKg || 68,
        age: existing.age || 25,
        workoutStartTime: existing.workoutStartTime || '19:30',
        workoutEndTime: existing.workoutEndTime || '20:20',
        scene: existing.scene || 'dumbbell'
      });
    }
    this.recomputePreview();
  },

  recomputePreview() {
    const { heightCm, weightKg, age, workoutStartTime, workoutEndTime } = this.data;
    const durationMin = calculator.calcTimeSlotDuration(workoutStartTime, workoutEndTime);
    const previewMetrics = calculator.calculateLeanMetrics({ heightCm, weightKg, age });
    this.setData({
      durationMin,
      previewMetrics
    });
  },

  onHeightChanging(e) {
    this.setData({ heightCm: Number(e.detail.value) }, () => this.recomputePreview());
  },

  onWeightChanging(e) {
    this.setData({ weightKg: Number(e.detail.value) }, () => this.recomputePreview());
  },

  onAgeInput(e) {
    const val = Number(e.detail.value);
    if (!Number.isNaN(val) && val >= 14 && val <= 75) {
      this.setData({ age: val }, () => this.recomputePreview());
    }
  },

  onStartTimeChange(e) {
    this.setData({ workoutStartTime: e.detail.value }, () => this.recomputePreview());
  },

  onEndTimeChange(e) {
    this.setData({ workoutEndTime: e.detail.value }, () => this.recomputePreview());
  },

  onSelectScene(e) {
    const scene = e.currentTarget.dataset.scene;
    this.setData({ scene });
  },

  onSubmit() {
    const { heightCm, weightKg, age, workoutStartTime, workoutEndTime, scene } = this.data;
    const durationMin = calculator.calcTimeSlotDuration(workoutStartTime, workoutEndTime);
    const metrics = calculator.calculateLeanMetrics({ heightCm, weightKg, age });

    const profile = {
      gender: 'male',
      goal: 'lean_muscular',
      heightCm,
      weightKg,
      age,
      workoutStartTime,
      workoutEndTime,
      durationMin,
      scene,
      metrics
    };

    const savedProfile = storage.saveUserProfile(profile);
    storage.addWeightLog(weightKg, heightCm);
    const weekSplit = planGenerator.generateWeeklyPlan(savedProfile);
    storage.saveWeeklyPlan(weekSplit);

    const app = getApp();
    if (app && app.globalData) {
      app.globalData.userProfile = savedProfile;
    }

    wx.showToast({
      title: this.data.isEditMode ? '档案与计划已更新' : '薄肌计划已生成！',
      icon: 'success',
      duration: 1200
    });

    setTimeout(() => {
      wx.switchTab({
        url: '/pages/today/today'
      });
    }, 500);
  }
});
