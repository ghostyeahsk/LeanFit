const calculator = require('../../utils/calculator');
const planGenerator = require('../../utils/planGenerator');
const storage = require('../../utils/storage');

const RPE_OPTIONS = [
  { value: 1, label: '很轻松' },
  { value: 2, label: '较轻松' },
  { value: 3, label: '刚刚好' },
  { value: 4, label: '有挑战' },
  { value: 5, label: '力竭拉满' }
];

Page({
  data: {
    todayKey: '',
    profile: null,
    todayPlan: null,
    exerciseTasks: [],
    completedSets: 0,
    totalSets: 0,
    progressPercent: 0,
    caloriesBurned: 0,
    workoutCompleted: false,
    rpe: 0,
    rpeOptions: RPE_OPTIONS,
    keepScreenOn: false,
    timerVisible: false,
    timerSeconds: 60,
    timerExerciseName: '',
    streakDays: 0
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

    const checkin = storage.getCheckinByDate(todayKey);
    const lastSetsMap = storage.getLastExerciseSets();
    const streakStats = calculator.calculateStreakStats(storage.getAllCheckins(), now);

    // 构建带逐组状态的动作任务列表
    const exerciseTasks = (todayPlan.exercises || []).map((ex, idx) => {
      const savedExSets = checkin && checkin.setLogs && checkin.setLogs[ex.id];
      const lastExSets = lastSetsMap[ex.id] || [];
      const setList = [];

      for (let i = 0; i < ex.sets; i++) {
        const saved = savedExSets && savedExSets[i];
        const prev = lastExSets[i];
        setList.push({
          setIndex: i,
          weight: saved && saved.weight !== undefined ? saved.weight : (prev ? prev.weight : ex.defaultWeight),
          reps: saved && saved.reps !== undefined ? saved.reps : (prev ? prev.reps : ex.reps),
          done: Boolean(saved && saved.done)
        });
      }

      const doneCount = setList.filter((s) => s.done).length;
      return {
        ...ex,
        expanded: idx === 0, // 默认展开第一个动作
        doneCount,
        setList
      };
    });

    const stats = this.computeProgress(exerciseTasks, todayPlan, profile, checkin);

    this.setData({
      todayKey,
      profile,
      todayPlan,
      exerciseTasks,
      streakDays: streakStats.currentStreak,
      rpe: (checkin && checkin.rpe) || 0,
      ...stats
    });
  },

  onHide() {
    if (this.data.keepScreenOn && wx.setKeepScreenOn) {
      wx.setKeepScreenOn({ keepScreenOn: false });
      this.setData({ keepScreenOn: false });
    }
  },

  computeProgress(exerciseTasks, todayPlan, profile, checkin) {
    if (todayPlan.isRest) {
      const restDone = Boolean(checkin && checkin.workoutCompleted);
      return {
        completedSets: restDone ? 1 : 0,
        totalSets: 1,
        progressPercent: restDone ? 100 : 0,
        caloriesBurned: 0,
        workoutCompleted: restDone
      };
    }

    let completedSets = 0;
    let totalSets = 0;
    exerciseTasks.forEach((ex) => {
      totalSets += ex.setList.length;
      completedSets += ex.setList.filter((s) => s.done).length;
    });

    const progressPercent = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;
    const workoutCompleted = totalSets > 0 && completedSets >= totalSets;
    const caloriesBurned = calculator.estimateCaloriesBurned({
      weightKg: profile.weightKg,
      avgMet: todayPlan.avgMet,
      completedSets,
      totalSets,
      durationMin: todayPlan.estimatedMin || profile.durationMin
    });

    return {
      completedSets,
      totalSets,
      progressPercent,
      caloriesBurned,
      workoutCompleted
    };
  },

  persistTodayCheckin(exerciseTasks, extraPatch = {}) {
    const { todayKey, todayPlan, profile, rpe } = this.data;
    const setLogs = {};
    exerciseTasks.forEach((ex) => {
      setLogs[ex.id] = ex.setList.map((s) => ({
        weight: s.weight,
        reps: s.reps,
        done: s.done
      }));
    });

    const stats = this.computeProgress(exerciseTasks, todayPlan, profile, extraPatch);
    const saved = storage.saveCheckin(todayKey, {
      dayTitle: todayPlan.title,
      isRecovery: todayPlan.isRecovery,
      completedSets: stats.completedSets,
      totalSets: stats.totalSets,
      setLogs,
      caloriesBurned: stats.caloriesBurned,
      workoutCompleted: extraPatch.workoutCompleted !== undefined ? extraPatch.workoutCompleted : stats.workoutCompleted,
      rpe: extraPatch.rpe !== undefined ? extraPatch.rpe : rpe
    });

    const streakStats = calculator.calculateStreakStats(storage.getAllCheckins());

    this.setData({
      exerciseTasks,
      ...stats,
      workoutCompleted: saved.workoutCompleted,
      rpe: saved.rpe || 0,
      streakDays: streakStats.currentStreak
    });
  },

  onToggleExpand(e) {
    const idx = e.currentTarget.dataset.index;
    const key = `exerciseTasks[${idx}].expanded`;
    this.setData({ [key]: !this.data.exerciseTasks[idx].expanded });
  },

  onWeightInput(e) {
    const { exIdx, setIdx } = e.currentTarget.dataset;
    const val = e.detail.value;
    const tasks = this.data.exerciseTasks;
    tasks[exIdx].setList[setIdx].weight = val === '' ? 0 : Number(val);
    this.persistTodayCheckin(tasks);
  },

  onRepsInput(e) {
    const { exIdx, setIdx } = e.currentTarget.dataset;
    const val = e.detail.value;
    const tasks = this.data.exerciseTasks;
    tasks[exIdx].setList[setIdx].reps = val;
    this.persistTodayCheckin(tasks);
  },

  onToggleSet(e) {
    const { exIdx, setIdx } = e.currentTarget.dataset;
    const tasks = this.data.exerciseTasks;
    const ex = tasks[exIdx];
    const targetSet = ex.setList[setIdx];
    const nextDone = !targetSet.done;
    targetSet.done = nextDone;
    ex.doneCount = ex.setList.filter((s) => s.done).length;

    const prevCompleted = this.data.workoutCompleted;
    this.persistTodayCheckin(tasks);

    if (nextDone) {
      if (wx.vibrateShort) {
        wx.vibrateShort({ type: 'light' });
      }
      // 如果本动作还有休息时间且未全部完成，弹出组间倒计时器
      if (!this.data.workoutCompleted && ex.restSec > 0) {
        this.setData({
          timerVisible: true,
          timerSeconds: ex.restSec,
          timerExerciseName: ex.name
        });
      }
      // 刚达成 100% 完成时给予正反馈
      if (!prevCompleted && this.data.workoutCompleted) {
        this.setData({ timerVisible: false });
        wx.showToast({ title: '今日薄肌任务达成！', icon: 'success' });
      }
    }
  },

  onCompleteRestDay() {
    const { todayKey, todayPlan } = this.data;
    const nextVal = !this.data.workoutCompleted;
    storage.saveCheckin(todayKey, {
      dayTitle: todayPlan.title,
      isRecovery: true,
      completedSets: nextVal ? 1 : 0,
      totalSets: 1,
      caloriesBurned: 0,
      workoutCompleted: nextVal
    });
    const streakStats = calculator.calculateStreakStats(storage.getAllCheckins());
    this.setData({
      workoutCompleted: nextVal,
      completedSets: nextVal ? 1 : 0,
      progressPercent: nextVal ? 100 : 0,
      streakDays: streakStats.currentStreak
    });
    wx.showToast({
      title: nextVal ? '休息日打卡成功，热力图已点亮' : '已取消打卡',
      icon: 'none'
    });
  },

  onSelectRpe(e) {
    const val = Number(e.currentTarget.dataset.val);
    this.persistTodayCheckin(this.data.exerciseTasks, { rpe: val });
    wx.showToast({ title: `已记录今日体感 RPE ${val}`, icon: 'none' });
  },

  onToggleScreenOn() {
    const next = !this.data.keepScreenOn;
    if (wx.setKeepScreenOn) {
      wx.setKeepScreenOn({ keepScreenOn: next });
    }
    this.setData({ keepScreenOn: next });
    wx.showToast({ title: next ? '已开启训练屏幕常亮' : '已关闭屏幕常亮', icon: 'none' });
  },

  onTimerClose() {
    this.setData({ timerVisible: false });
  },

  onGoDiet() {
    wx.switchTab({ url: '/pages/diet/diet' });
  }
});
