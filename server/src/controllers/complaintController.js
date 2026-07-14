const asyncHandler = require('express-async-handler');
const Complaint = require('../models/Complaint');

// @desc    Submit a complaint
// @route   POST /api/complaints
// @access  Private
const submitComplaint = asyncHandler(async (req, res) => {
  const { subject, description } = req.body;

  const complaint = await Complaint.create({
    collegeId: req.user.collegeId,
    submittedBy: req.user._id,
    subject,
    description,
  });

  res.status(201).json({ success: true, data: complaint });
});

// @desc    Get my complaints
// @route   GET /api/complaints
// @access  Private
const getMyComplaints = asyncHandler(async (req, res) => {
  const complaints = await Complaint.find({ submittedBy: req.user._id, ...req.tenantFilter }).sort({ createdAt: -1 });
  res.json({ success: true, data: complaints });
});

module.exports = { submitComplaint, getMyComplaints };
