const storage = require('./utils/storage');

/**
 * 微信云开发环境 ID
 * 留空时小程序自动以本地存储模式运行（开箱即可预览全部功能）；
 * 在微信开发者工具中开通云开发后，填入您的环境 ID（如 'leanfit-prod-xxxxx'）即可启用云端多端同步。
 */
const CLOUD_ENV_ID = '';

App({
  globalData: {
    cloudReady: false,
    cloudEnvId: CLOUD_ENV_ID,
    openid: '',
    userProfile: null
  },

  onLaunch() {
    this.initCloud();
    this.bootstrapUser();
  },

  initCloud() {
    if (!wx.cloud) {
      console.warn('[LeanFit] 当前基础库不支持云开发，自动使用本地存储模式');
      return;
    }
    if (!CLOUD_ENV_ID) {
      console.info('[LeanFit] 未配置 CLOUD_ENV_ID，运行于本地离线模式');
      return;
    }
    try {
      wx.cloud.init({
        env: CLOUD_ENV_ID,
        traceUser: true
      });
      this.globalData.cloudReady = true;
      storage.setCloudReady(true);
      this.fetchOpenId();
    } catch (err) {
      console.warn('[LeanFit] 云开发初始化失败，降级为本地存储模式', err);
    }
  },

  async fetchOpenId() {
    if (!this.globalData.cloudReady) return;
    try {
      const res = await wx.cloud.callFunction({ name: 'login' });
      if (res && res.result && res.result.openid) {
        this.globalData.openid = res.result.openid;
        // 登录后尝试静默拉取云端档案
        const cloudProfile = await storage.pullFromCloud();
        if (cloudProfile) {
          this.globalData.userProfile = cloudProfile;
        }
      }
    } catch (err) {
      console.warn('[LeanFit] 云端登录失败，继续使用本地数据', err);
    }
  },

  bootstrapUser() {
    const profile = storage.getUserProfile();
    this.globalData.userProfile = profile;
  }
});
