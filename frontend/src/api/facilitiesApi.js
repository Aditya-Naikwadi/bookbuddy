import apiClient from "./client";

export const facilitiesApi = {
  getAvailability: async (labName, date) => {
    const { data } = await apiClient.get("/lab/availability", {
      params: { labName, date },
    });
    return data.data;
  },
  createBooking: async (seatId, startTime, endTime) => {
    const { data } = await apiClient.post("/lab/bookings", {
      seatId,
      startTime,
      endTime,
    });
    return data.data;
  },
  getMyBookings: async () => {
    const { data } = await apiClient.get("/lab/bookings/me");
    return data.data;
  },
  cancelBooking: async (id) => {
    const { data } = await apiClient.delete(`/lab/bookings/${id}`);
    return data;
  },
};

export default facilitiesApi;
