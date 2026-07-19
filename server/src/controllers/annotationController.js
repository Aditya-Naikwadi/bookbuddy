const Annotation = require('../models/Annotation');
const EResource = require('../models/EResource');
const AppError = require('../utils/AppError');

/**
 * @desc    Create a new annotation / highlight
 * @route   POST /api/annotations
 * @access  Private (Student)
 */
const createAnnotation = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const collegeId = req.user.collegeId;
    const {
      resourceId,
      bookTitle,
      cfiRange,
      page,
      textRange,
      highlightText,
      noteText,
      color,
      tags,
    } = req.body;

    if (!resourceId) {
      throw new AppError('resourceId is required.', 400);
    }

    const resource = await EResource.findById(resourceId);
    if (!resource) {
      throw new AppError('E-resource not found.', 404);
    }

    const isPdf =
      resource.type === 'pdf' ||
      resource.fileType === 'pdf' ||
      resource.fileUrl?.toLowerCase().endsWith('.pdf');

    // Shape validation based on fileType
    if (isPdf) {
      if (page === undefined || page === null || typeof page !== 'number') {
        throw new AppError(
          'Invalid annotation payload: "page" (number) is required for PDF documents.',
          400
        );
      }
    } else {
      if (!cfiRange && !textRange && !highlightText) {
        throw new AppError(
          'Invalid annotation payload: "cfiRange" or text highlight is required for EPUB documents.',
          400
        );
      }
    }

    const annotation = await Annotation.create({
      collegeId,
      userId,
      resourceId,
      bookTitle: bookTitle || resource.title,
      cfiRange,
      page: isPdf ? page : undefined,
      textRange,
      highlightText,
      noteText,
      color: color || 'yellow',
      tags: Array.isArray(tags) ? tags : tags ? [tags] : [],
    });

    res.status(201).json({
      success: true,
      data: annotation,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user's annotations
 * @route   GET /api/annotations
 * @access  Private (Student)
 */
const getAnnotations = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const { resourceId } = req.query;

    const query = { userId };
    if (resourceId) {
      query.resourceId = resourceId;
    }

    const annotations = await Annotation.find(query).sort({ createdAt: -1 }).lean();

    res.json({
      success: true,
      data: annotations,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update an annotation
 * @route   PUT /api/annotations/:id
 * @access  Private (Student)
 */
const updateAnnotation = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const { id } = req.params;
    const { noteText, color, tags, highlightText } = req.body;

    const annotation = await Annotation.findOne({ _id: id, userId });
    if (!annotation) {
      throw new AppError('Annotation not found or unauthorized access.', 404);
    }

    if (noteText !== undefined) annotation.noteText = noteText;
    if (color !== undefined) annotation.color = color;
    if (highlightText !== undefined) annotation.highlightText = highlightText;
    if (tags !== undefined) annotation.tags = Array.isArray(tags) ? tags : [tags];

    await annotation.save();

    res.json({
      success: true,
      data: annotation,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete an annotation
 * @route   DELETE /api/annotations/:id
 * @access  Private (Student)
 */
const deleteAnnotation = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const { id } = req.params;

    const annotation = await Annotation.findOneAndDelete({ _id: id, userId });
    if (!annotation) {
      throw new AppError('Annotation not found or unauthorized access.', 404);
    }

    res.json({
      success: true,
      message: 'Annotation deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Full-text search across student's notes and tags
 * @route   GET /api/annotations/search
 * @access  Private (Student)
 */
const searchAnnotations = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const { q } = req.query;

    if (!q || q.trim() === '') {
      const all = await Annotation.find({ userId }).sort({ createdAt: -1 }).lean();
      return res.json({ success: true, data: all });
    }

    const searchRegex = new RegExp(q.trim(), 'i');

    const results = await Annotation.find({
      userId,
      $or: [
        { noteText: searchRegex },
        { highlightText: searchRegex },
        { tags: searchRegex },
        { bookTitle: searchRegex },
      ],
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createAnnotation,
  getAnnotations,
  updateAnnotation,
  deleteAnnotation,
  searchAnnotations,
};
