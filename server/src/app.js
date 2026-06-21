const express = require('express');
const cors = require('cors');
const { errorHandler, notFound } = require('./middlewares/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple healthcheck
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/books', require('./routes/bookRoutes'));
app.use('/api/loans', require('./routes/loanRoutes'));
app.use('/api/fines', require('./routes/fineRoutes'));
app.use('/api/patron-card', require('./routes/patronCardRoutes'));
app.use('/api/reservations', require('./routes/reservationRoutes'));
app.use('/api/reading-lists', require('./routes/readingListRoutes'));
app.use('/api/bookmarks', require('./routes/bookmarkRoutes'));
app.use('/api/saved-searches', require('./routes/savedSearchRoutes'));
app.use('/api/recommendations', require('./routes/recommendationRoutes'));
app.use('/api/eresources', require('./routes/eresourceRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));

// Dashboard Routes
app.use('/api/dashboards/admin-portal', require('./routes/dashboards/adminPortalRoutes'));
app.use('/api/dashboards/college-admin', require('./routes/dashboards/collegeAdminRoutes'));
app.use('/api/dashboards/student', require('./routes/dashboards/studentDashboardRoutes'));
app.use('/api/dashboards/general', require('./routes/dashboards/generalDashboardRoutes'));

// Feature Routes
app.use('/api/lab', require('./routes/labRoutes'));
app.use('/api/feedback', require('./routes/feedbackRoutes'));
app.use('/api/complaints', require('./routes/complaintRoutes'));
app.use('/api/book-suggestions', require('./routes/bookSuggestionRoutes'));
app.use('/api/eresources/external', require('./routes/eresourceExternalRoutes'));
app.use('/api/streak', require('./routes/streakRoutes'));
app.use('/api/stickers', require('./routes/stickerRoutes'));

// Error Handlers
app.use(notFound);
app.use(errorHandler);

module.exports = app;
