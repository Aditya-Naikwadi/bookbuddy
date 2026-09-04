// Schema representing library acquisition purchase orders.
const mongoose = require('mongoose');

const acquisitionItemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    isbn: { type: String, trim: true },
    author: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const acquisitionOrderSchema = new mongoose.Schema(
  {
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: [true, 'CRITICAL TENANT ERROR: Cannot save document without tenant collegeId'],
      index: true,
    },
    vendorName: {
      type: String,
      required: true,
      trim: true,
    },
    items: {
      type: [acquisitionItemSchema],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'At least one item is required in an acquisition order.',
      },
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'approved', 'ordered', 'received', 'cancelled'],
      default: 'draft',
      index: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    orderDate: {
      type: Date,
      default: null,
    },
    expectedDeliveryDate: {
      type: Date,
      default: null,
    },
    receivedDate: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    budgetCode: {
      type: String,
      trim: true,
      default: '',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for dashboard queries
acquisitionOrderSchema.index({ collegeId: 1, status: 1 });
acquisitionOrderSchema.index({ collegeId: 1, createdAt: -1 });
acquisitionOrderSchema.index({ collegeId: 1, requestedBy: 1, status: 1 });

module.exports = mongoose.model('AcquisitionOrder', acquisitionOrderSchema);
