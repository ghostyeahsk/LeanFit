/**
 * LeanFit 个性化薄肌周计划与每日健身餐生成引擎
 */

const { EXERCISES, SCENE_LABELS } = require('../data/exercises');
const { MEAL_SLOTS, MEAL_TEMPLATES } = require('../data/meals');

/**
 * 薄肌 7 天科学分化模板（dayOfWeek: 1=周一 ... 7=周日）
 */
const WEEKLY_BLUEPRINT = [
  {
    dayOfWeek: 1,
    shortLabel: '周一',
    title: '上胸立体 + 三头线条',
    focus: '打造穿衣撑起衣领的饱满上胸与清晰手臂后侧',
    type: 'strength',
    isRest: false,
    isRecovery: false,
    categories: ['chest', 'triceps']
  },
  {
    dayOfWeek: 2,
    shortLabel: '周二',
    title: '倒三角背部 + 二头饱满',
    focus: '拉宽背阔肌与改善伏案圆肩，塑造倒三角轮廓',
    type: 'strength',
    isRest: false,
    isRecovery: false,
    categories: ['back', 'biceps']
  },
  {
    dayOfWeek: 3,
    shortLabel: '周三',
    title: '腹肌雕刻 + 燃脂 HIIT',
    focus: '强化腹直肌与人鱼线，结合高效 HIIT 维持低体脂',
    type: 'hiit_core',
    isRest: false,
    isRecovery: false,
    categories: ['core', 'hiit']
  },
  {
    dayOfWeek: 4,
    shortLabel: '周四',
    title: '主动恢复 & 柔韧拉伸',
    focus: '打开胸椎与髋关节，促进血液循环加速肌肉超量恢复',
    type: 'recovery',
    isRest: false,
    isRecovery: true,
    categories: ['mobility']
  },
  {
    dayOfWeek: 5,
    shortLabel: '周五',
    title: '3D 宽肩 + 核心稳定',
    focus: '薄肌衣架子灵魂日：全面轰炸三角肌前/中/后束',
    type: 'strength',
    isRest: false,
    isRecovery: false,
    categories: ['shoulders', 'core']
  },
  {
    dayOfWeek: 6,
    shortLabel: '周六',
    title: '下肢力量 + 促睾代谢',
    focus: '复合下肢训练拉高基础代谢与内源激素，练腿不粗腿',
    type: 'strength',
    isRest: false,
    isRecovery: false,
    categories: ['legs', 'core']
  },
  {
    dayOfWeek: 7,
    shortLabel: '周日',
    title: '完全休息 & 营养超量恢复',
    focus: '保证 7.5 小时以上睡眠，肌肉在休息日生长',
    type: 'rest',
    isRest: true,
    isRecovery: false,
    categories: []
  }
];

function getExercisesByCategoryAndScene(category, scene) {
  // 优先匹配指定场景
  const exact = EXERCISES.filter((ex) => ex.category === category && ex.scene === scene);
  if (exact.length > 0) return exact;
  // 对于 core / hiit / mobility，通用徒手动作适配所有场景
  return EXERCISES.filter((ex) => ex.category === category);
}

/**
 * 根据用户档案生成 7 天薄肌分化训练计划
 */
function generateWeeklyPlan(profile) {
  const scene = (profile && profile.scene) || 'dumbbell';
  const durationMin = Number(profile && profile.durationMin) || 45;
  const stageKey = (profile && profile.metrics && profile.metrics.stageKey) || 'recomp';

  // 根据单次可用时长决定每日动作上限与组数微调
  let maxExercises = 5;
  let setAdjust = 0;
  if (durationMin <= 35) {
    maxExercises = 4;
    setAdjust = -1;
  } else if (durationMin >= 60) {
    maxExercises = 6;
    setAdjust = 0;
  }

  return WEEKLY_BLUEPRINT.map((bp) => {
    if (bp.isRest) {
      return {
        ...bp,
        scene,
        sceneLabel: SCENE_LABELS[scene] || '居家哑铃',
        estimatedMin: 0,
        avgMet: 1.5,
        totalSets: 0,
        exercises: []
      };
    }

    const picked = [];
    const primaryCat = bp.categories[0];
    const secondaryCat = bp.categories[1];

    const primaryPool = getExercisesByCategoryAndScene(primaryCat, scene);
    const primaryCount = bp.isRecovery ? Math.min(4, primaryPool.length) : Math.min(3, primaryPool.length);
    picked.push(...primaryPool.slice(0, primaryCount));

    if (secondaryCat) {
      const secondaryPool = getExercisesByCategoryAndScene(secondaryCat, scene);
      // 刷脂阶段周三增加 HIIT 占比
      const remainingSlots = Math.max(1, maxExercises - picked.length);
      const secCount =
        stageKey === 'cut_lean' && secondaryCat === 'hiit'
          ? Math.min(3, secondaryPool.length)
          : Math.min(remainingSlots, secondaryPool.length);
      picked.push(...secondaryPool.slice(0, secCount));
    }

    const normalizedExercises = picked.slice(0, maxExercises).map((ex) => {
      const sets = Math.max(2, ex.sets + (bp.isRecovery ? 0 : setAdjust));
      return {
        ...ex,
        sets
      };
    });

    const totalSets = normalizedExercises.reduce((sum, e) => sum + e.sets, 0);
    const avgMet =
      normalizedExercises.length > 0
        ? Number(
            (
              normalizedExercises.reduce((sum, e) => sum + (e.met || 5.0), 0) /
              normalizedExercises.length
            ).toFixed(2)
          )
        : 5.0;

    const estimatedMin = bp.isRecovery
      ? 25
      : Math.min(durationMin, Math.max(20, Math.round(totalSets * 2.4)));

    return {
      ...bp,
      scene,
      sceneLabel: SCENE_LABELS[scene] || '居家哑铃',
      estimatedMin,
      avgMet,
      totalSets,
      exercises: normalizedExercises
    };
  });
}

/**
 * 获取今天对应的星期序号 (1=周一 ... 7=周日)
 */
function getTodayDayOfWeek(dateObj) {
  const d = dateObj instanceof Date ? dateObj : new Date();
  const jsDay = d.getDay(); // 0=周日, 1=周一 ... 6=周六
  return jsDay === 0 ? 7 : jsDay;
}

/**
 * 根据目标热量等比缩放单餐食材克数与营养素
 */
function scaleMealTemplate(template, targetKcal) {
  const scale = Math.max(0.65, Math.min(1.5, targetKcal / template.baseKcal));

  const scaledItems = template.items.map((item) => {
    let scaledAmount;
    if (item.unit === '个' || item.unit === '片' || item.unit === '根' || item.unit === '杯') {
      scaledAmount = Math.max(1, Math.round(item.amount * scale * 2) / 2);
    } else {
      scaledAmount = Math.max(5, Math.round((item.amount * scale) / 5) * 5);
    }
    return {
      ...item,
      amount: scaledAmount
    };
  });

  return {
    id: template.id,
    name: template.name,
    tag: template.tag,
    calories: Math.round(template.baseKcal * scale),
    proteinG: Math.round(template.proteinG * scale),
    carbsG: Math.round(template.carbsG * scale),
    fatG: Math.round(template.fatG * scale),
    items: scaledItems,
    prepTip: template.prepTip
  };
}

/**
 * 生成某天的四餐健身食谱（区分训练日 / 休息日，支持单餐换一换）
 * @param {object} profile 用户档案
 * @param {boolean} isTrainingDay 当天是否为训练日
 * @param {object} overrides 各餐次选中的模板下标映射，如 { breakfast: 1 }
 * @param {number} daySeed 日期种子（让每天默认推荐略微轮换不单调）
 */
function generateDailyDiet(profile, isTrainingDay = true, overrides = {}, daySeed = 0) {
  const metrics = (profile && profile.metrics) || {
    targetCalories: 2100,
    restDayCalories: 1900,
    macros: { proteinG: 145, carbsG: 230, restDayCarbsG: 185, fatG: 58 }
  };

  const dayType = isTrainingDay ? 'training' : 'rest';
  const totalTargetKcal = isTrainingDay ? metrics.targetCalories : metrics.restDayCalories;

  const meals = MEAL_SLOTS.map((slot, slotIdx) => {
    const allTemplates = MEAL_TEMPLATES[slot.key] || [];
    const preferred = allTemplates.filter((t) => t.dayTypes.includes(dayType));
    const pool = preferred.length > 0 ? preferred : allTemplates;

    const overrideIdx = overrides[slot.key];
    const pickedIdx =
      typeof overrideIdx === 'number'
        ? ((overrideIdx % allTemplates.length) + allTemplates.length) % allTemplates.length
        : allTemplates.indexOf(pool[(daySeed + slotIdx) % pool.length]);

    const safeIdx = pickedIdx >= 0 ? pickedIdx : 0;
    const template = allTemplates[safeIdx];
    const mealTargetKcal = Math.round(totalTargetKcal * slot.ratio);
    const scaled = scaleMealTemplate(template, mealTargetKcal);

    return {
      slotKey: slot.key,
      slotTitle: slot.title,
      timeHint: slot.timeHint,
      templateIndex: safeIdx,
      templateCount: allTemplates.length,
      ...scaled
    };
  });

  const summary = meals.reduce(
    (acc, m) => {
      acc.calories += m.calories;
      acc.proteinG += m.proteinG;
      acc.carbsG += m.carbsG;
      acc.fatG += m.fatG;
      return acc;
    },
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  );

  return {
    dayType,
    dayTypeLabel: isTrainingDay ? '训练日 · 中高碳充能' : '休息日 · 低碳控脂',
    targetCalories: totalTargetKcal,
    targetMacros: {
      proteinG: metrics.macros.proteinG,
      carbsG: isTrainingDay ? metrics.macros.carbsG : metrics.macros.restDayCarbsG,
      fatG: metrics.macros.fatG
    },
    summary,
    meals
  };
}

module.exports = {
  WEEKLY_BLUEPRINT,
  generateWeeklyPlan,
  getTodayDayOfWeek,
  generateDailyDiet
};
