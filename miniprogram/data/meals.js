/**
 * LeanFit 男性薄肌每日健身餐食谱库
 *
 * 设计原则：
 * - 每日 4 餐：breakfast(25%) / lunch(35%) / snack(15%) / dinner(25%)
 * - 每份模板包含基准热量 (baseKcal)，生成每日食谱时按用户目标热量自动等比缩放食材克数
 * - 区分训练日 (training) 与休息日 (rest) 碳循环，兼顾高蛋白留肌与低体脂控制
 */

const MEAL_SLOTS = [
  { key: 'breakfast', title: '早餐', timeHint: '07:30 - 09:00', ratio: 0.25 },
  { key: 'lunch', title: '午餐', timeHint: '12:00 - 13:30', ratio: 0.35 },
  { key: 'snack', title: '练前/练后加餐', timeHint: '锻炼前后 45min', ratio: 0.15 },
  { key: 'dinner', title: '晚餐', timeHint: '18:30 - 20:00', ratio: 0.25 }
];

const MEAL_TEMPLATES = {
  breakfast: [
    {
      id: 'bf_1',
      name: '燕麦鸡蛋牛奶碗',
      tag: '高蛋白慢碳',
      dayTypes: ['training', 'rest'],
      baseKcal: 520,
      proteinG: 34,
      carbsG: 56,
      fatG: 16,
      items: [
        { name: '即食燕麦片', amount: 60, unit: 'g' },
        { name: '全蛋（水煮/煎）', amount: 2, unit: '个' },
        { name: '纯蛋白', amount: 2, unit: '个' },
        { name: '低脂纯牛奶', amount: 250, unit: 'ml' },
        { name: '蓝莓/圣女果', amount: 80, unit: 'g' }
      ],
      prepTip: '燕麦用热牛奶冲泡，搭配白煮蛋，5 分钟搞定稳定供能。'
    },
    {
      id: 'bf_2',
      name: '全麦鸡胸三明治 + 黑咖啡',
      tag: '通勤快手',
      dayTypes: ['training', 'rest'],
      baseKcal: 510,
      proteinG: 38,
      carbsG: 52,
      fatG: 14,
      items: [
        { name: '100%全麦吐司', amount: 2, unit: '片' },
        { name: '即食鸡胸肉', amount: 120, unit: 'g' },
        { name: '煎蛋（少油）', amount: 1, unit: '个' },
        { name: '生菜 + 番茄片', amount: 80, unit: 'g' },
        { name: '无糖美式咖啡', amount: 1, unit: '杯' }
      ],
      prepTip: '黑咖啡提升上午代谢，优先选配料表首位为全麦粉的吐司。'
    },
    {
      id: 'bf_3',
      name: '红薯鸡蛋白 + 希腊酸奶杯',
      tag: '低碳控脂',
      dayTypes: ['rest', 'training'],
      baseKcal: 480,
      proteinG: 35,
      carbsG: 48,
      fatG: 13,
      items: [
        { name: '蒸红薯/紫薯', amount: 160, unit: 'g' },
        { name: '水煮鸡蛋', amount: 3, unit: '个' },
        { name: '无糖希腊酸奶', amount: 150, unit: 'g' },
        { name: '原味巴旦木', amount: 12, unit: 'g' }
      ],
      prepTip: '低 GI 慢碳搭配优质脂肪，饱腹感强，适合刷脂或休息日。'
    }
  ],

  lunch: [
    {
      id: 'ln_1',
      name: '黑椒嫩煎鸡胸 + 杂粮糙米饭',
      tag: '薄肌经典',
      dayTypes: ['training', 'rest'],
      baseKcal: 720,
      proteinG: 56,
      carbsG: 78,
      fatG: 18,
      items: [
        { name: '鸡胸肉（生重）', amount: 200, unit: 'g' },
        { name: '糙米杂粮饭（熟重）', amount: 220, unit: 'g' },
        { name: '白灼西兰花', amount: 180, unit: 'g' },
        { name: '橄榄油（烹调用）', amount: 8, unit: 'ml' }
      ],
      prepTip: '鸡胸切薄片加少量淀粉/生抽黑椒腌制 10 分钟，小火煎制不柴。'
    },
    {
      id: 'ln_2',
      name: '番茄焖瘦牛肉 + 荞麦面',
      tag: '增肌充能',
      dayTypes: ['training'],
      baseKcal: 750,
      proteinG: 54,
      carbsG: 82,
      fatG: 20,
      items: [
        { name: '瘦牛腱/牛里脊（生重）', amount: 190, unit: 'g' },
        { name: '纯荞麦面（干重）', amount: 90, unit: 'g' },
        { name: '番茄 + 娃娃菜', amount: 220, unit: 'g' },
        { name: '橄榄油', amount: 8, unit: 'ml' }
      ],
      prepTip: '牛肉富含肌酸与铁，训练日中午吃可显著提升傍晚力量表现。'
    },
    {
      id: 'ln_3',
      name: '清蒸龙利鱼/虾仁 + 藜麦时蔬碗',
      tag: '清爽高蛋白',
      dayTypes: ['rest', 'training'],
      baseKcal: 680,
      proteinG: 52,
      carbsG: 66,
      fatG: 18,
      items: [
        { name: '去骨龙利鱼/基围虾仁', amount: 220, unit: 'g' },
        { name: '三色藜麦饭（熟重）', amount: 180, unit: 'g' },
        { name: '清炒芦笋/菠菜', amount: 200, unit: 'g' },
        { name: '牛油果/坚果碎', amount: 30, unit: 'g' }
      ],
      prepTip: '白肉海鲜极低脂易消化，搭配蒸煮方式最大化保留薄肌线条。'
    }
  ],

  snack: [
    {
      id: 'sn_1',
      name: '香蕉 + 乳清蛋白粉（或高蛋白奶）',
      tag: '黄金练前/后补给',
      dayTypes: ['training'],
      baseKcal: 310,
      proteinG: 28,
      carbsG: 36,
      fatG: 5,
      items: [
        { name: '乳清蛋白粉（1勺）', amount: 30, unit: 'g' },
        { name: '香蕉（中等大小）', amount: 1, unit: '根' },
        { name: '凉白开/脱脂奶', amount: 250, unit: 'ml' }
      ],
      prepTip: '练前 30 分钟吃半根香蕉供能，练后 30 分钟内喝蛋白粉促肌肉合成。'
    },
    {
      id: 'sn_2',
      name: '无糖酸奶 + 坚果莓果杯',
      tag: '休息日控糖',
      dayTypes: ['rest', 'training'],
      baseKcal: 280,
      proteinG: 22,
      carbsG: 20,
      fatG: 12,
      items: [
        { name: '无糖脱脂希腊酸奶', amount: 180, unit: 'g' },
        { name: '混合原味坚果', amount: 18, unit: 'g' },
        { name: '草莓/蓝莓', amount: 60, unit: 'g' }
      ],
      prepTip: '休息日降低碳水比例，用优质蛋白与好脂肪稳住血糖不嘴馋。'
    },
    {
      id: 'sn_3',
      name: '卤牛肉切片 + 苹果',
      tag: '天然食物补给',
      dayTypes: ['training', 'rest'],
      baseKcal: 300,
      proteinG: 26,
      carbsG: 28,
      fatG: 8,
      items: [
        { name: '低钠酱牛肉', amount: 80, unit: 'g' },
        { name: '中等苹果', amount: 1, unit: '个' }
      ],
      prepTip: '不喝蛋白粉时的绝佳替代方案，方便随身携带。'
    }
  ],

  dinner: [
    {
      id: 'dn_1',
      name: '香煎三文鱼/巴沙鱼 + 蒸南瓜时蔬',
      tag: '优质脂肪修复',
      dayTypes: ['training', 'rest'],
      baseKcal: 530,
      proteinG: 42,
      carbsG: 42,
      fatG: 19,
      items: [
        { name: '三文鱼/巴沙鱼排', amount: 170, unit: 'g' },
        { name: '贝贝南瓜（蒸）', amount: 160, unit: 'g' },
        { name: '白灼油麦菜/生菜', amount: 200, unit: 'g' }
      ],
      prepTip: 'Omega-3 脂肪酸可降低训练后炎症反应，助力夜间肌纤维修复。'
    },
    {
      id: 'dn_2',
      name: '白灼虾仁豆腐煲 + 少量玉米',
      tag: '低脂高饱腹',
      dayTypes: ['rest', 'training'],
      baseKcal: 490,
      proteinG: 44,
      carbsG: 40,
      fatG: 14,
      items: [
        { name: '鲜虾仁', amount: 180, unit: 'g' },
        { name: '嫩豆腐', amount: 150, unit: 'g' },
        { name: '甜玉米', amount: 120, unit: 'g' },
        { name: '菌菇青菜', amount: 200, unit: 'g' }
      ],
      prepTip: '晚间清淡少油少盐，避免次日晨起水肿，保持腹肌清晰度。'
    },
    {
      id: 'dn_3',
      name: '蒜香瘦牛排 + 凉拌黄瓜木耳',
      tag: '力量日夜间修复',
      dayTypes: ['training'],
      baseKcal: 540,
      proteinG: 46,
      carbsG: 44,
      fatG: 18,
      items: [
        { name: '菲力/西冷瘦牛排（去肥边）', amount: 170, unit: 'g' },
        { name: '蒸土豆/全麦馒头', amount: 150, unit: 'g' },
        { name: '拍黄瓜 + 焯水木耳', amount: 200, unit: 'g' }
      ],
      prepTip: '力量训练日晚餐保留适量慢碳，补充肌糖原但不堆积腹部脂肪。'
    }
  ]
};

module.exports = {
  MEAL_SLOTS,
  MEAL_TEMPLATES
};
