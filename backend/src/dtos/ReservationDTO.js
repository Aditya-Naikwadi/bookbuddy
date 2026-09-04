const BookDTO = require('./BookDTO');

/**
 * Presentation DTO for Reservation payload standardization
 */
class ReservationDTO {
  static transform(reservation) {
    if (!reservation) return null;

    const raw = typeof reservation.toObject === 'function' ? reservation.toObject() : reservation;

    return {
      id: raw._id ? raw._id.toString() : raw.id,
      userId: raw.userId ? raw.userId.toString() : null,
      bookId: raw.bookId
        ? typeof raw.bookId === 'object'
          ? BookDTO.transform(raw.bookId)
          : raw.bookId.toString()
        : null,
      collegeId: raw.collegeId ? raw.collegeId.toString() : null,
      queuePosition: raw.queuePosition || 1,
      status: raw.status || 'queued',
      createdAt: raw.createdAt || null,
      readyAt: raw.readyAt || null,
    };
  }

  static transformMany(reservations) {
    if (!Array.isArray(reservations)) return [];
    return reservations.map((r) => ReservationDTO.transform(r));
  }
}

module.exports = ReservationDTO;
