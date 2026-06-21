import api from './index';

export const streakApi = {
  getMyStreak: async () => {
    const { data } = await api.get('/streak/me');
    return data.data;
  },
  repairStreak: async () => {
    const { data } = await api.post('/streak/repair');
    return data.data;
  },
  getStickerCatalog: async () => {
    const { data } = await api.get('/stickers');
    return data.data;
  },
  getMyStickers: async () => {
    const { data } = await api.get('/stickers/me');
    return data.data;
  },
  getRewardsLadder: async () => {
    const { data } = await api.get('/streak/rewards');
    return data.data;
  }
};
