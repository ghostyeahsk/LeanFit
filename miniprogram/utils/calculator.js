/**
 * LeanFit 核心计算引擎
 * - 身体指标：BMI / BMR (Mifflin-St Jeor 男性) / TDEE
 * - 薄肌阶段自动判定与三大营养素目标
 * - 每日可锻炼时间段解析
 * - MET 科学热量消耗估算
 * - GitHub 风格打卡热力图等级与 26 周日期矩阵生成
 * - 连续打卡天数（streak）计算
 */

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad2(num) {
  return num < 10 ? `0${num}` : `${num}`;
}

function formatDateKey(dateObj) {
  const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * 解析 "HH:mm" 格式为分钟数
 */
function parseTimeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const parts = timeStr.split(':');
  if (parts.length !== 2) return 0;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

/**
 * 计算锻炼时间段时长（分钟），支持跨午夜，限制在 [15, 180] 合理区间
 */
function calcTimeSlotDuration(startTime, endTime) {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  let diff = end - start;
  if (diff <= 0) {
    diff += 24 * 60;
  }
  if (diff < 15) return 30;
  if (diff > 180) return 90;
  return diff;
}

/**
 * 计算男性薄肌档案指标与每日营养目标
 */
function calculateLeanMetrics({ heightCm, weightKg, age = 25 }) {
  const h = Number(heightCm) || 175;
  const w = Number(weightKg) || 68;
  const a = Number(age) || 25;

  const heightM = h / 100;
  const bmi = Number((w / (heightM * heightM)).toFixed(1));

  // Mifflin-St Jeor 男性基础代谢公式
  const bmr = Math.round(10 * w + 6.25 * h - 5 * a + 5);
  // 针对每周 4~5 练中等活跃度
  const tdee = Math.round(bmr * 1.45);

  let stageKey = 'recomp';
  let stageLabel = '薄肌塑形';
  let stageDesc = '体脂适中，采用高蛋白微赤字策略，同步雕刻腹肌线条与宽肩倒三角。';
  let calorieDelta = -100;
  let proteinPerKg = 2.1;

  if (bmi < 19.5) {
    stageKey = 'lean_bulk';
    stageLabel = '精瘦增肌';
    stageDesc = '体重偏轻，采用干净热量盈余 + 力量渐进超负荷，打造立体胸肩背。';
    calorieDelta = 250;
    proteinPerKg = 2.0;
  } else if (bmi > 23.5) {
    stageKey = 'cut_lean';
    stageLabel = '刷脂留肌';
    stageDesc = '优先降低体脂率至 12% 左右，高蛋白保肌 + 力量结合 HIIT 显露线条。';
    calorieDelta = -400;
    proteinPerKg = 2.2;
  }

  const targetCalories = Math.max(1500, Math.round((tdee + calorieDelta) / 10) * 10);
  const proteinG = Math.round(w * proteinPerKg);
  const fatG = Math.round((targetCalories * 0.25) / 9);
  const remainingKcal = Math.max(200, targetCalories - proteinG * 4 - fatG * 9);
  const carbsG = Math.round(remainingKcal / 4);

  // 休息日碳循环（碳水降低 20%，蛋白质保持不变）
  const restDayCalories = Math.max(1400, Math.round((targetCalories - carbsG * 0.2 * 4) / 10) * 10);
  const restDayCarbsG = Math.round(carbsG * 0.8);

  return {
    bmi,
    bmr,
    tdee,
    stageKey,
    stageLabel,
    stageDesc,
    targetCalories,
    restDayCalories,
    macros: {
      proteinG,
      carbsG,
      restDayCarbsG,
      fatG
    }
  };
}

/**
 * 基于 MET 系数科学估算训练热量消耗 (kcal)
 * 公式：MET * weightKg * durationHours
 */
function estimateCaloriesBurned({ weightKg, avgMet = 5.0, completedSets = 0, totalSets = 16, durationMin = 45 }) {
  const w = Number(weightKg) || 68;
  if (completedSets <= 0) return 0;
  const ratio = totalSets > 0 ? Math.min(1.2, completedSets / totalSets) : 1;
  const activeHours = (durationMin * ratio) / 60;
  return Math.max(15, Math.round(avgMet * w * activeHours));
}

/**
 * 计算每日打卡在 GitHub 风格热力图上的 5 档强度等级 (0 ~ 4)
 * - 0: 未打卡
 * - 1: 仅完成饮食打卡，或训练完成 < 50%
 * - 2: 训练完成 >= 50%，或主动恢复日打卡
 * - 3: 训练 100% 完成
 * - 4: 完美薄肌日（训练 100% 完成 + 饮食 >= 3 餐）
 */
function calculateHeatmapLevel(checkin) {
  if (!checkin) return 0;
  const completedSets = Number(checkin.completedSets) || 0;
  const totalSets = Number(checkin.totalSets) || 0;
  const mealsCount = Array.isArray(checkin.completedMeals) ? checkin.completedMeals.length : 0;
  const workoutCompleted = Boolean(checkin.workoutCompleted) || (totalSets > 0 && completedSets >= totalSets);
  const isRecovery = Boolean(checkin.isRecovery);

  if (workoutCompleted && mealsCount >= 3) return 4;
  if (workoutCompleted) return isRecovery ? 2 : 3;
  if (totalSets > 0 && completedSets / totalSets >= 0.5) return 2;
  if (completedSets > 0 || mealsCount > 0) return 1;
  return 0;
}

/**
 * 生成 GitHub 风格打卡热力图网格数据（默认近 26 周，每周 7 天：周日=0 ~ 周六=6）
 * 返回：
 * {
 *   weeks: [ { weekIndex, monthLabel, days: [ { date, level, isToday, isFuture, record } ] } ],
 *   totalActiveDays: number,
 *   totalPerfectDays: number
 * }
 */
function buildHeatmapMatrix(checkinsMap = {}, options = {}) {
  const numWeeks = options.weeks || 26;
  const today = options.today ? new Date(options.today) : new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = formatDateKey(today);

  // 计算本周六作为矩阵结束日期，保证与 GitHub 一致（每列 7 行：周日~周六）
  const endSaturday = new Date(today);
  endSaturday.setDate(today.getDate() + (6 - today.getDay()));

  const startSunday = new Date(endSaturday);
  startSunday.setDate(endSaturday.getDate() - (numWeeks * 7 - 1));

  const weeks = [];
  let totalActiveDays = 0;
  let totalPerfectDays = 0;
  let lastLabeledMonth = -1;

  const cursor = new Date(startSunday);
  for (let w = 0; w < numWeeks; w++) {
    const days = [];
    let monthLabel = '';

    for (let d = 0; d < 7; d++) {
      const dateKey = formatDateKey(cursor);
      const isFuture = cursor > today;
      const isToday = dateKey === todayKey;
      const record = !isFuture ? (checkinsMap[dateKey] || null) : null;
      const level = !isFuture ? (record && typeof record.level === 'number' ? record.level : calculateHeatmapLevel(record)) : -1;

      if (!isFuture && level > 0) totalActiveDays += 1;
      if (!isFuture && level === 4) totalPerfectDays += 1;

      // 在每个新月份首次出现的那一列标注月份名称（复刻 GitHub 顶部月份轴）
      if (d === 0 && cursor.getMonth() !== lastLabeledMonth) {
        monthLabel = MONTH_NAMES[cursor.getMonth()];
        lastLabeledMonth = cursor.getMonth();
      } else if (cursor.getDate() === 1 && cursor.getMonth() !== lastLabeledMonth) {
        monthLabel = MONTH_NAMES[cursor.getMonth()];
        lastLabeledMonth = cursor.getMonth();
      }

      days.push({
        date: dateKey,
        weekday: d,
        level,
        isToday,
        isFuture,
        record
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    weeks.push({
      weekIndex: w,
      monthLabel,
      days
    });
  }

  return {
    weeks,
    totalActiveDays,
    totalPerfectDays
  };
}

/**
 * 计算当前连续打卡天数（Streak）与历史最长连续天数
 */
function calculateStreakStats(checkinsMap = {}, todayInput) {
  const today = todayInput ? new Date(todayInput) : new Date();
  today.setHours(0, 0, 0, 0);

  const isActive = (dateKey) => {
    const rec = checkinsMap[dateKey];
    return rec && calculateHeatmapLevel(rec) > 0;
  };

  // 当前连续天数：如果今天没打，允许从昨天起算（避免当天刚开始时归零）
  let currentStreak = 0;
  const cursor = new Date(today);
  if (!isActive(formatDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (isActive(formatDateKey(cursor))) {
    currentStreak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  // 历史最长连续天数
  const activeDates = Object.keys(checkinsMap)
    .filter((k) => isActive(k))
    .sort();

  let longestStreak = 0;
  let run = 0;
  let prevTime = null;
  for (const dateStr of activeDates) {
    const t = new Date(`${dateStr}T00:00:00`).getTime();
    if (prevTime !== null && Math.round((t - prevTime) / 86400000) === 1) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > longestStreak) longestStreak = run;
    prevTime = t;
  }

  return {
    currentStreak,
    longestStreak,
    totalCheckinDays: activeDates.length
  };
}

module.exports = {
  formatDateKey,
  parseTimeToMinutes,
  calcTimeSlotDuration,
  calculateLeanMetrics,
  estimateCaloriesBurned,
  calculateHeatmapLevel,
  buildHeatmapMatrix,
  calculateStreakStats
};
