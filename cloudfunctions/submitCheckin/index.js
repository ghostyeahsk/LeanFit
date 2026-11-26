const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const checkin = event && event.checkin;

  if (!checkin || !checkin.date) {
    return { ok: false, error: 'Missing checkin.date' };
  }

  const now = Date.now();
  const existing = await db
    .collection('checkins')
    .where({ _openid: OPENID, date: checkin.date })
    .limit(1)
    .get();

  const payload = {
    ...checkin,
    updatedAt: now
  };
  delete payload._id;
  delete payload._openid;

  if (existing.data.length > 0) {
    await db.collection('checkins').doc(existing.data[0]._id).update({
      data: payload
    });
  } else {
    await db.collection('checkins').add({
      data: {
        _openid: OPENID,
        ...payload
      }
    });
  }

  return { ok: true, date: checkin.date };
};
