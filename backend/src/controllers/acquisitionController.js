// Acquisition orders controller for library procurement and serials management.
const AcquisitionOrder = require('../models/AcquisitionOrder');
const AppError = require('../utils/AppError');
const { emitAcquisitionUpdated } = require('../sockets');

/**
 * GET /api/v1/acquisitions
 * Fetch acquisition orders with pagination and filtering
 */
const getAcquisitions = async (req, res, next) => {
  try {
    const { status, search, priority, page = 1, limit = 20 } = req.query;
    const filter = { collegeId: req.user.collegeId };

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (priority && priority !== 'all') {
      filter.priority = priority;
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { vendorName: searchRegex },
        { budgetCode: searchRegex },
        { 'items.title': searchRegex },
        { 'items.isbn': searchRegex },
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const parsedLimit = parseInt(limit, 10);

    const [orders, total] = await Promise.all([
      AcquisitionOrder.find(filter)
        .populate('requestedBy', 'name email')
        .populate('approvedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit),
      AcquisitionOrder.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: orders,
      pagination: {
        page: parseInt(page, 10),
        limit: parsedLimit,
        total,
        pages: Math.ceil(total / parsedLimit) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/acquisitions/stats
 * Aggregate acquisition key metrics
 */
const getAcquisitionStats = async (req, res, next) => {
  try {
    const collegeId = req.user.collegeId;

    const [statusCounts, expenditureResult, vendorCount] = await Promise.all([
      AcquisitionOrder.aggregate([
        { $match: { collegeId } },
        { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$totalAmount' } } },
      ]),
      AcquisitionOrder.aggregate([
        { $match: { collegeId, status: { $in: ['approved', 'ordered', 'received'] } } },
        { $group: { _id: null, totalSpent: { $sum: '$totalAmount' } } },
      ]),
      AcquisitionOrder.distinct('vendorName', { collegeId }),
    ]);

    const stats = {
      totalOrders: 0,
      totalSpent: expenditureResult[0]?.totalSpent || 0,
      activeVendorsCount: vendorCount.length,
      byStatus: {
        draft: 0,
        submitted: 0,
        approved: 0,
        ordered: 0,
        received: 0,
        cancelled: 0,
      },
    };

    statusCounts.forEach((s) => {
      stats.totalOrders += s.count;
      if (stats.byStatus[s._id] !== undefined) {
        stats.byStatus[s._id] = s.count;
      }
    });

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/acquisitions/:id
 * Get single acquisition order
 */
const getAcquisitionById = async (req, res, next) => {
  try {
    const order = await AcquisitionOrder.findOne({
      _id: req.params.id,
      collegeId: req.user.collegeId,
    })
      .populate('requestedBy', 'name email studentId')
      .populate('approvedBy', 'name email');

    if (!order) {
      return next(new AppError('Acquisition order not found.', 404));
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/acquisitions
 * Create a new acquisition order
 */
const createAcquisitionOrder = async (req, res, next) => {
  try {
    const {
      vendorName,
      items,
      budgetCode,
      notes,
      priority = 'medium',
      status = 'draft',
    } = req.body;

    if (!vendorName || !vendorName.trim()) {
      return next(new AppError('Vendor name is required.', 400));
    }

    if (!Array.isArray(items) || items.length === 0) {
      return next(new AppError('Order must contain at least one item.', 400));
    }

    // Calculate total amount
    let totalAmount = 0;
    const validatedItems = items.map((item) => {
      const qty = parseInt(item.quantity, 10) || 1;
      const price = parseFloat(item.unitPrice) || 0;
      totalAmount += qty * price;
      return {
        title: item.title?.trim(),
        isbn: item.isbn?.trim() || '',
        author: item.author?.trim() || '',
        quantity: qty,
        unitPrice: price,
      };
    });

    const newOrder = await AcquisitionOrder.create({
      collegeId: req.user.collegeId,
      vendorName: vendorName.trim(),
      items: validatedItems,
      totalAmount: Math.round(totalAmount * 100) / 100,
      budgetCode: budgetCode ? budgetCode.trim() : 'LIBRARY-GEN-2026',
      notes: notes ? notes.trim() : '',
      priority,
      status: ['draft', 'submitted'].includes(status) ? status : 'draft',
      requestedBy: req.user.id || req.user._id,
      orderDate: status === 'submitted' ? new Date() : null,
    });

    emitAcquisitionUpdated(req.user.collegeId, {
      orderId: newOrder._id,
      status: newOrder.status,
      vendorName: newOrder.vendorName,
    });

    res.status(201).json({
      success: true,
      data: newOrder,
      message: 'Acquisition order created successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/acquisitions/:id/status
 * Transition acquisition order status
 */
const updateOrderStatus = async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    const allowedStatuses = ['draft', 'submitted', 'approved', 'ordered', 'received', 'cancelled'];

    if (!allowedStatuses.includes(status)) {
      return next(new AppError(`Invalid status. Allowed: ${allowedStatuses.join(', ')}`, 400));
    }

    const order = await AcquisitionOrder.findOne({
      _id: req.params.id,
      collegeId: req.user.collegeId,
    });

    if (!order) {
      return next(new AppError('Acquisition order not found.', 404));
    }

    order.status = status;
    if (notes) {
      order.notes = notes;
    }

    if (status === 'approved') {
      order.approvedBy = req.user.id || req.user._id;
    } else if (status === 'ordered' && !order.orderDate) {
      order.orderDate = new Date();
    } else if (status === 'received' && !order.receivedDate) {
      order.receivedDate = new Date();
    }

    await order.save();

    emitAcquisitionUpdated(req.user.collegeId, {
      orderId: order._id,
      status: order.status,
      vendorName: order.vendorName,
    });

    res.json({
      success: true,
      data: order,
      message: `Order marked as ${status}.`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/acquisitions/:id
 * Delete order (drafts or cancelled only)
 */
const deleteAcquisitionOrder = async (req, res, next) => {
  try {
    const order = await AcquisitionOrder.findOne({
      _id: req.params.id,
      collegeId: req.user.collegeId,
    });

    if (!order) {
      return next(new AppError('Acquisition order not found.', 404));
    }

    if (!['draft', 'cancelled'].includes(order.status)) {
      return next(new AppError('Only draft or cancelled acquisition orders can be deleted.', 400));
    }

    await AcquisitionOrder.deleteOne({ _id: order._id });

    res.json({
      success: true,
      message: 'Acquisition order successfully deleted.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAcquisitions,
  getAcquisitionStats,
  getAcquisitionById,
  createAcquisitionOrder,
  updateOrderStatus,
  deleteAcquisitionOrder,
};
