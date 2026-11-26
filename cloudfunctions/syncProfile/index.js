const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const action = (event && event.action) || 'pull';

  if (action === 'save') {
    const now = Date.now();
    const { profile, weekSplit } = event;

    if (profile) {
      const existingUser = await db.collection('users').where({ _openid: OPENID }).get();
      if (existingUser.data.length > 0) {
        await db.collection('users').doc(existingUser.data[0]._id).update({
          data: {
            ...profile,
            updatedAt: now
          }
        });
      } else {
        await db.collection('users').add({
          data: {
            _openid: OPENID,
            ...profile,
            createdAt: now,
            updatedAt: now
          }
        });
      }
    }

    if (Array.isArray(weekSplit)) {
      const existingPlan = await db.collection('plans').where({ _openid: OPENID }).get();
      if (existingPlan.data.length > 0) {
        await db.collection('plans').doc(existingPlan.data[0]._id).update({
          data: {
            weekSplit,
            updatedAt: now
          }
        });
      } else {
        await db.collection('plans').add({
          data: {
            _openid: OPENID,
            weekSplit,
            updatedAt: now
          }
        });
      }
    }

    return { ok: true };
  }

  // pull: 拉取档案、周计划及近 200 条打卡记录（驱动 26 周热力图）
  const [userRes, planRes, checkinsRes] = await Promise.all([
    db.collection('users').where({ _openid: OPENID }).limit(1).get(),
    db.collection('plans').where({ _openid: OPENID }).limit(1).get(),
    db.collection('checkins').where({ _openid: OPENID }).orderBy('date', 'desc').limit(200).get()
  ]);

  return {
    ok: true,
    profile: userRes.data[0] || null,
    weekSplit: planRes.data[0] ? planRes.data[0].weekSplit : null,
    checkins: checkinsRes.data || []
  };
};
