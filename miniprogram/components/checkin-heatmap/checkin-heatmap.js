const calculator = require('../../utils/calculator');

const LEVEL_DESCRIPTIONS = {
  0: '未打卡',
  1: '轻度打卡（饮食或部分训练）',
  2: '完成 ≥50% 训练 / 主动恢复',
  3: '完成当日全部训练任务',
  4: '完美薄肌日（全套训练 + 饮食达标）'
};

Component({
  properties: {
    checkinsMap: {
      type: Object,
      value: {},
      observer() {
        this.rebuildMatrix();
      }
    },
    weeksCount: {
      type: Number,
      value: 26
    }
  },

  data: {
    weeks: [],
    totalActiveDays: 0,
    totalPerfectDays: 0,
    selectedDay: null,
    selectedLevelText: '',
    scrollIntoId: ''
  },

  lifetimes: {
    attached() {
      this.rebuildMatrix();
    }
  },

  methods: {
    rebuildMatrix() {
      const result = calculator.buildHeatmapMatrix(this.data.checkinsMap || {}, {
        weeks: this.data.weeksCount || 26
      });
      const lastWeekId = result.weeks.length > 0 ? `week-${result.weeks.length - 1}` : '';

      // 默认选中今天
      let todayCell = null;
      for (let i = result.weeks.length - 1; i >= 0; i--) {
        const found = result.weeks[i].days.find((d) => d.isToday);
        if (found) {
          todayCell = found;
          break;
        }
      }

      this.setData({
        weeks: result.weeks,
        totalActiveDays: result.totalActiveDays,
        totalPerfectDays: result.totalPerfectDays,
        scrollIntoId: lastWeekId,
        selectedDay: todayCell,
        selectedLevelText: todayCell ? (LEVEL_DESCRIPTIONS[todayCell.level] || '') : ''
      });
    },

    onSelectCell(e) {
      const { weekIdx, dayIdx } = e.currentTarget.dataset;
      const week = this.data.weeks[weekIdx];
      if (!week) return;
      const cell = week.days[dayIdx];
      if (!cell || cell.isFuture) return;

      this.setData({
        selectedDay: cell,
        selectedLevelText: LEVEL_DESCRIPTIONS[cell.level] || '未打卡'
      });
      this.triggerEvent('select', { day: cell });
    }
  }
});
