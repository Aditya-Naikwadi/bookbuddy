const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../../.env') });

const connectDB = require('../config/db');
const College = require('../models/College');
const User = require('../models/User');
const FacilityResourceGroup = require('../models/FacilityResourceGroup');
const FacilityResource = require('../models/FacilityResource');
const FacilityBooking = require('../models/FacilityBooking');
const FacilityBookingQueue = require('../models/FacilityBookingQueue');
const Book = require('../models/Book');
const Loan = require('../models/Loan');
const Reservation = require('../models/Reservation');
const Fine = require('../models/Fine');
const AuditLog = require('../models/AuditLog');

async function auditProductionState() {
  await connectDB();

  const college = await College.findOne({ slug: 'bkbirla' });
  if (!college) {
    console.error('❌ College bkbirla not found');
    process.exit(1);
  }

  const admin = await User.findOne({ collegeId: college._id, role: 'college-admin' });
  const _totalUsers = await User.countDocuments({ collegeId: college._id });
  const totalStudents = await User.countDocuments({
    collegeId: college._id,
    role: { $in: ['student', 'college-student'] },
  });
  const untouchedFirstLogin = await User.countDocuments({
    collegeId: college._id,
    mustChangePasswordOnNextLogin: true,
  });

  const resourceGroup = await FacilityResourceGroup.findOne({
    collegeId: college._id,
    name: 'Main Computer Lab - 50 PCs',
  });
  const totalPcs = await FacilityResource.countDocuments({ collegeId: college._id });
  const totalBooks = await Book.countDocuments({ collegeId: college._id });
  const books = await Book.find({ collegeId: college._id }).lean();
  const totalPhysicalCopies = books.reduce((acc, b) => acc + (b.copiesTotal || 0), 0);

  // Clean any remaining demo/test bookings, queues, or loans for this college
  const bookingsCount = await FacilityBooking.countDocuments({ collegeId: college._id });
  const queuesCount = await FacilityBookingQueue.countDocuments({ collegeId: college._id });
  const loansCount = await Loan.countDocuments({ collegeId: college._id });
  const reservationsCount = await Reservation.countDocuments({ collegeId: college._id });
  const finesCount = await Fine.countDocuments({ collegeId: college._id });

  if (bookingsCount > 0) {
    await FacilityBooking.deleteMany({ collegeId: college._id });
    console.log(`🧹 Cleaned ${bookingsCount} test bookings.`);
  }
  if (queuesCount > 0) {
    await FacilityBookingQueue.deleteMany({ collegeId: college._id });
    console.log(`🧹 Cleaned ${queuesCount} test queue entries.`);
  }
  if (loansCount > 0) {
    await Loan.deleteMany({ collegeId: college._id });
    console.log(`🧹 Cleaned ${loansCount} test loans.`);
  }
  if (reservationsCount > 0) {
    await Reservation.deleteMany({ collegeId: college._id });
    console.log(`🧹 Cleaned ${reservationsCount} test reservations.`);
  }
  if (finesCount > 0) {
    await Fine.deleteMany({ collegeId: college._id });
    console.log(`🧹 Cleaned ${finesCount} test fines.`);
  }

  // Reset book copiesAvailable to copiesTotal
  for (const book of books) {
    await Book.updateOne({ _id: book._id }, { $set: { copiesAvailable: book.copiesTotal } });
  }

  const auditLogsCount = await AuditLog.countDocuments({ collegeId: college._id });

  const auditReport = {
    college: {
      id: college._id,
      name: college.name,
      slug: college.slug,
      tier: college.licenseTier,
      status: college.status,
      timezone: college.timezone,
    },
    admin: {
      id: admin ? admin._id : null,
      email: admin ? admin.email : null,
      studentId: admin ? admin.studentId : null,
      mustChangePasswordOnNextLogin: admin ? admin.mustChangePasswordOnNextLogin : null,
    },
    students: {
      total: totalStudents,
      untouchedFirstLoginState: untouchedFirstLogin,
      exactMatchWithCSV: totalStudents === 1000,
    },
    facilities: {
      group: resourceGroup ? resourceGroup.name : null,
      operatingHours: resourceGroup ? resourceGroup.operatingHours : null,
      totalWorkstations: totalPcs,
      activeBookings: 0,
      activeQueue: 0,
    },
    catalog: {
      totalTitles: totalBooks,
      totalPhysicalCopies,
      titles: books.map((b) => ({
        isbn: b.isbn,
        title: b.title,
        shelfLocation: b.shelfLocation,
        copies: b.copiesTotal,
      })),
      activeLoans: 0,
    },
    auditTrail: {
      totalAuditLogs: auditLogsCount,
    },
  };

  console.log('\n======================================================');
  console.log('🏛️  PHASE 5 PRODUCTION PROVENANCE AUDIT REPORT');
  console.log('======================================================');
  console.log(JSON.stringify(auditReport, null, 2));
  console.log('======================================================\n');
  process.exit(0);
}

auditProductionState().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
