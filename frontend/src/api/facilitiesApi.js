import apiClient from "./client";
import {
  getLabAvailabilityQuerySchema,
  createBookingBodySchema,
} from "@shared/schemas/facilities";

export const facilitiesApi = {
  getAvailability: async (labName, date) => {
    const validated = getLabAvailabilityQuerySchema.parse({ labName, date });
    const { data } = await apiClient.get("/lab/availability", {
      params: validated,
    });
    return data.data;
  },
  createBooking: async (seatId, startTime, endTime) => {
    const validated = createBookingBodySchema.parse({
      seatId,
      startTime,
      endTime,
    });
    const { data } = await apiClient.post("/lab/bookings", validated);
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
  checkInBooking: async (id) => {
    const { data } = await apiClient.post(
      `/dashboards/student/lab-bookings/${id}/check-in`,
    );
    return data;
  },
  joinQueue: async ({
    resourceGroupId,
    resourceId,
    date,
    slotStart,
    slotEnd,
  }) => {
    const { data } = await apiClient.post("/lab/queue/join", {
      resourceGroupId,
      resourceId,
      date,
      slotStart,
      slotEnd,
    });
    return data.data;
  },
  leaveQueue: async (queueId) => {
    const { data } = await apiClient.delete(`/lab/queue/${queueId}`);
    return data;
  },
  getMyQueue: async () => {
    const { data } = await apiClient.get("/lab/queue/me");
    return data.data;
  },
  claimQueueSpot: async (queueId) => {
    const { data } = await apiClient.post(`/lab/queue/${queueId}/claim`);
    return data.data;
  },
};

export default facilitiesApi;
