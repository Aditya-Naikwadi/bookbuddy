import apiClient from './client';

export const streakApi = {
  getMyStreak: async () => {
    const { data } = await apiClient.get('/streak/me');
    return data.data;
  },
  checkIn: async () => {
    const { data } = await apiClient.post('/streak/check-in');
    return data.data;
  },
  repairStreak: async () => {
    const { data } = await apiClient.post('/streak/repair');
    return data.data;
  },
  getStickerCatalog: async () => {
    const { data } = await apiClient.get('/stickers');
    return data.data;
  },
  getMyStickers: async () => {
    const { data } = await apiClient.get('/stickers/me');
    return data.data;
  },
  getRewardsLadder: async () => {
    const { data } = await apiClient.get('/streak/rewards');
    return data.data;
  }
};

export default streakApi;
