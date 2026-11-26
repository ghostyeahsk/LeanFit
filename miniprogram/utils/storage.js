/**
 * LeanFit 统一数据持久层
 * - 双写机制：本地 wx.setStorageSync 即时持久化 + 微信云开发 CloudBase 异步同步
 * - 未配置云环境 ID 或离线时自动降级为纯本地模式，不影响任何核心功能
 */

const calculator = require('./calculator');

const KEYS = {
  PROFILE: 'leanfit_user_profile_v1',
  PLAN: 'leanfit_weekly_plan_v1',
  CHECKINS: 'leanfit_checkins_map_v1',
  LAST_SETS: 'leanfit_last_exercise_sets_v1',
  MEAL_OVERRIDES: 'leanfit_meal_overrides_v1',
  WEIGHT_LOGS: 'leanfit_weight_logs_v1'
};

let cloudReady = false;

function setCloudReady(ready) {
  cloudReady = Boolean(ready);
}

function isCloudReady() {
  return cloudReady && typeof wx !== 'undefined' && Boolean(wx.cloud);
}

function safeGet(key, fallback) {
  try {
    const val = wx.getStorageSync(key);
    return val !== '' && val !== undefined && val !== null ? val : fallback;
  } catch (err) {
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    wx.setStorageSync(key, value);
  } catch (err) {
    console.error('[LeanFit Storage] 写入失败:', key, err);
  }
}

function getUserProfile() {
  return safeGet(KEYS.PROFILE, null);
}

function saveUserProfile(profile) {
  const enriched = {
    ...profile,
    updatedAt: Date.now()
  };
  safeSet(KEYS.PROFILE, enriched);
  syncProfileToCloud(enriched, getWeeklyPlan());
  return enriched;
}

function getWeeklyPlan() {
  return safeGet(KEYS.PLAN, null);
}

function saveWeeklyPlan(weekSplit) {
  safeSet(KEYS.PLAN, weekSplit);
  const profile = getUserProfile();
  if (profile) {
    syncProfileToCloud(profile, weekSplit);
  }
  return weekSplit;
}

function getAllCheckins() {
  return safeGet(KEYS.CHECKINS, {});
}

function getCheckinByDate(dateKey) {
  const map = getAllCheckins();
  return map[dateKey] || null;
}

/**
 * 保存/更新某天打卡记录（自动计算热力图 level 0~4 并同步云端）
 */
function saveCheckin(dateKey, patch) {
  const map = getAllCheckins();
  const prev = map[dateKey] || {
    date: dateKey,
    dayTitle: '',
    completedSets: 0,
    totalSets: 0,
    setLogs: {},
    workoutCompleted: false,
    isRecovery: false,
    caloriesBurned: 0,
    rpe: 0,
    completedMeals: []
  };

  const merged = {
    ...prev,
    ...patch,
    date: dateKey,
    updatedAt: Date.now()
  };
  merged.level = calculator.calculateHeatmapLevel(merged);

  map[dateKey] = merged;
  safeSet(KEYS.CHECKINS, map);

  // 记录动作最近一次负重/次数，供下次训练自动带入（借鉴 RepLoop）
  if (patch.setLogs && typeof patch.setLogs === 'object') {
    const lastSets = safeGet(KEYS.LAST_SETS, {});
    Object.keys(patch.setLogs).forEach((exId) => {
      const setsArr = patch.setLogs[exId];
      if (Array.isArray(setsArr) && setsArr.length > 0) {
        lastSets[exId] = setsArr.map((s) => ({
          weight: s.weight,
          reps: s.reps
        }));
      }
    });
    safeSet(KEYS.LAST_SETS, lastSets);
  }

  syncCheckinToCloud(merged);
  return merged;
}

function getLastExerciseSets() {
  return safeGet(KEYS.LAST_SETS, {});
}

function getMealOverrides(dateKey) {
  const all = safeGet(KEYS.MEAL_OVERRIDES, {});
  return all[dateKey] || {};
}

function saveMealOverrides(dateKey, overrides) {
  const all = safeGet(KEYS.MEAL_OVERRIDES, {});
  all[dateKey] = overrides;
  safeSet(KEYS.MEAL_OVERRIDES, all);
}

function getWeightLogs() {
  return safeGet(KEYS.WEIGHT_LOGS, []);
}

function addWeightLog(weightKg, heightCm, dateKey) {
  const key = dateKey || calculator.formatDateKey(new Date());
  const logs = getWeightLogs();
  const hM = (Number(heightCm) || 175) / 100;
  const bmi = Number((Number(weightKg) / (hM * hM)).toFixed(1));

  const idx = logs.findIndex((item) => item.date === key);
  const entry = { date: key, weightKg: Number(weightKg), bmi, updatedAt: Date.now() };
  if (idx >= 0) {
    logs[idx] = entry;
  } else {
    logs.unshift(entry);
  }
  logs.sort((a, b) => (a.date < b.date ? 1 : -1));
  safeSet(KEYS.WEIGHT_LOGS, logs.slice(0, 60));
  return logs;
}

// ==================== CloudBase 云同步封装 ====================

async function syncProfileToCloud(profile, weekSplit) {
  if (!isCloudReady()) return;
  try {
    await wx.cloud.callFunction({
      name: 'syncProfile',
      data: {
        action: 'save',
        profile,
        weekSplit
      }
    });
  } catch (err) {
    console.warn('[LeanFit Cloud] syncProfile 失败，已保留本地数据', err);
  }
}

async function syncCheckinToCloud(checkin) {
  if (!isCloudReady()) return;
  try {
    await wx.cloud.callFunction({
      name: 'submitCheckin',
      data: { checkin }
    });
  } catch (err) {
    console.warn('[LeanFit Cloud] submitCheckin 失败，已保留本地数据', err);
  }
}

async function pullFromCloud() {
  if (!isCloudReady()) return null;
  try {
    const res = await wx.cloud.callFunction({
      name: 'syncProfile',
      data: { action: 'pull' }
    });
    const result = res && res.result;
    if (!result || !result.ok) return null;

    if (result.profile) {
      safeSet(KEYS.PROFILE, result.profile);
    }
    if (result.weekSplit) {
      safeSet(KEYS.PLAN, result.weekSplit);
    }
    if (Array.isArray(result.checkins)) {
      const localMap = getAllCheckins();
      result.checkins.forEach((item) => {
        if (item && item.date) {
          const existing = localMap[item.date];
          if (!existing || (item.updatedAt || 0) >= (existing.updatedAt || 0)) {
            localMap[item.date] = item;
          }
        }
      });
      safeSet(KEYS.CHECKINS, localMap);
    }
    return result.profile || null;
  } catch (err) {
    console.warn('[LeanFit Cloud] pullFromCloud 失败', err);
    return null;
  }
}

module.exports = {
  setCloudReady,
  isCloudReady,
  getUserProfile,
  saveUserProfile,
  getWeeklyPlan,
  saveWeeklyPlan,
  getAllCheckins,
  getCheckinByDate,
  saveCheckin,
  getLastExerciseSets,
  getMealOverrides,
  saveMealOverrides,
  getWeightLogs,
  addWeightLog,
  pullFromCloud
};
