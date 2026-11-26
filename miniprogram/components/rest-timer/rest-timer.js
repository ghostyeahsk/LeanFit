Component({
  properties: {
    visible: {
      type: Boolean,
      value: false,
      observer(val) {
        if (val) {
          this.startCountdown(this.data.seconds || 60);
        } else {
          this.clearTimer();
        }
      }
    },
    seconds: {
      type: Number,
      value: 60
    },
    exerciseName: {
      type: String,
      value: ''
    }
  },

  data: {
    remaining: 60,
    total: 60,
    formattedTime: '01:00',
    progressPercent: 100
  },

  lifetimes: {
    detached() {
      this.clearTimer();
    }
  },

  methods: {
    formatSec(sec) {
      const s = Math.max(0, Math.floor(sec));
      const m = Math.floor(s / 60);
      const r = s % 60;
      return `${m < 10 ? '0' + m : m}:${r < 10 ? '0' + r : r}`;
    },

    startCountdown(duration) {
      this.clearTimer();
      const total = Math.max(10, Number(duration) || 60);
      this.setData({
        remaining: total,
        total,
        formattedTime: this.formatSec(total),
        progressPercent: 100
      });

      this._timer = setInterval(() => {
        const next = this.data.remaining - 1;
        if (next <= 0) {
          this.clearTimer();
          this.setData({
            remaining: 0,
            formattedTime: '00:00',
            progressPercent: 0
          });
          if (wx.vibrateShort) {
            wx.vibrateShort({ type: 'heavy' });
          }
          wx.showToast({ title: '休息结束，开始下一组！', icon: 'none' });
          this.triggerEvent('finish');
          return;
        }
        const pct = Math.round((next / this.data.total) * 100);
        this.setData({
          remaining: next,
          formattedTime: this.formatSec(next),
          progressPercent: pct
        });
      }, 1000);
    },

    clearTimer() {
      if (this._timer) {
        clearInterval(this._timer);
        this._timer = null;
      }
    },

    onAddTime(e) {
      const add = Number(e.currentTarget.dataset.sec) || 15;
      const next = this.data.remaining + add;
      const total = Math.max(this.data.total, next);
      this.setData({
        remaining: next,
        total,
        formattedTime: this.formatSec(next),
        progressPercent: Math.round((next / total) * 100)
      });
    },

    onSkip() {
      this.clearTimer();
      this.triggerEvent('close');
    }
  }
});
