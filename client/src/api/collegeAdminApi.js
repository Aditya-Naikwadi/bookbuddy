import apiClient from "./client";

export const getCirculationQueue = async () => {
  const { data } = await apiClient.get("/dashboards/college-admin/circulation/queue");
  return data;
};

export const checkoutBook = async (payload) => {
  const { data } = await apiClient.post("/dashboards/college-admin/circulation/checkout", payload);
  return data;
};

export const returnBook = async (payload) => {
  const { data } = await apiClient.post("/dashboards/college-admin/circulation/return", payload);
  return data;
};

export const getAllPatrons = async () => {
  const { data } = await apiClient.get("/dashboards/college-admin/patrons");
  return data;
};

export const createStudentPatron = async (payload) => {
  const { data } = await apiClient.post("/dashboards/college-admin/patrons", payload);
  return data;
};

export const addCatalogBook = async (payload) => {
  const { data } = await apiClient.post("/dashboards/college-admin/catalog", payload);
  return data;
};

export const getCollegeFines = async () => {
  const { data } = await apiClient.get("/dashboards/college-admin/fines");
  return data;
};

export const payCollegeFine = async (fineId, payload) => {
  const { data } = await apiClient.post(`/dashboards/college-admin/fines/${fineId}/pay`, payload);
  return data;
};

export const getPendingEResources = async () => {
  const { data } = await apiClient.get("/dashboards/college-admin/eresources/pending");
  return data;
};

export const moderateEResource = async (id, payload) => {
  const { data } = await apiClient.put(`/dashboards/college-admin/eresources/${id}/moderate`, payload);
  return data;
};

export const getLabSeats = async () => {
  const { data } = await apiClient.get("/dashboards/college-admin/lab-seats");
  return data;
};

export const getLabBookings = async () => {
  const { data } = await apiClient.get("/dashboards/college-admin/lab-bookings");
  return data;
};

export const getHelpdeskTickets = async () => {
  const { data } = await apiClient.get("/dashboards/college-admin/helpdesk");
  return data;
};

export const resolveHelpdeskTicket = async (id, payload) => {
  const { data } = await apiClient.put(`/dashboards/college-admin/helpdesk/${id}/resolve`, payload);
  return data;
};

export const getAnalyticsSummary = async () => {
  const { data } = await apiClient.get("/dashboards/college-admin/analytics/summary");
  return data;
};

const collegeAdminApi = {
  getCirculationQueue,
  checkoutBook,
  returnBook,
  getAllPatrons,
  createStudentPatron,
  addCatalogBook,
  getCollegeFines,
  payCollegeFine,
  getPendingEResources,
  moderateEResource,
  getLabSeats,
  getLabBookings,
  getHelpdeskTickets,
  resolveHelpdeskTicket,
  getAnalyticsSummary,
};

export default collegeAdminApi;
