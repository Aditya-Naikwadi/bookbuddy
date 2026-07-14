const asyncHandler = require('express-async-handler');
const Complaint = require('../models/Complaint');

// @desc    Submit a complaint
// @route   POST /api/complaints
// @access  Private
const submitComplaint = asyncHandler(async (req, res) => {
  const { subject, description } = req.body;
  const ticketId = 'TKT-' + Math.floor(100000 + Math.random() * 900000);

  const complaint = await Complaint.create({
    userId: req.user._id,
    ticketId,
    subject,
    description,
  });

  res.status(201).json({ success: true, data: complaint });
});

// @desc    Get my complaints
// @route   GET /api/complaints
// @access  Private
const getMyComplaints = asyncHandler(async (req, res) => {
  const complaints = await Complaint.find({ userId: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, data: complaints });
});

module.exports = { submitComplaint, getMyComplaints };
