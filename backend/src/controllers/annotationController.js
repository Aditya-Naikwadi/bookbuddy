const Annotation = require('../models/Annotation');
const AppError = require('../utils/AppError');
const domainEvents = require('../utils/domainEvents');
const { emitAnnotationUpsert, emitAnnotationDelete } = require('../sockets');

/**
 * @desc    Create a new annotation / bookmark / highlight / note
 * @route   POST /api/v1/books/:bookId/annotations (and legacy POST /api/v1/annotations)
 * @access  Private (Student)
 */
const createAnnotation = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const collegeId = req.user.collegeId || null;

    const rawBookId = req.params.bookId || req.body.bookId || req.body.resourceId;
    if (!rawBookId) {
      throw new AppError('bookId (or resourceId) is required.', 400);
    }

    const {
      type = 'highlight',
      cfiRange,
      page,
      rects,
      textRange,
      textOffset,
      highlightText,
      noteText,
      label,
      color = 'yellow',
      tags,
      clientId,
    } = req.body;

    // Check offline idempotency via clientId
    if (clientId) {
      const existing = await Annotation.findOne({ clientId, userId });
      if (existing) {
        return res.status(200).json({
          success: true,
          data: existing,
          isDuplicate: true,
        });
      }
    }

    // Soft cap check: 500 annotations per user per book
    const currentCount = await Annotation.countDocuments({
      userId,
      bookId: rawBookId,
    });

    if (currentCount >= 500) {
      const limitError = new AppError('Annotation count limit of 500 per book reached.', 400);
      limitError.code = 'ANNOTATION_COUNT_LIMIT_REACHED';
      throw limitError;
    }

    // Validate noteText length cap (5000 chars)
    if (noteText && noteText.length > 5000) {
      throw new AppError('Note text cannot exceed 5000 characters.', 400);
    }

    // Validate type enum
    if (!['bookmark', 'highlight', 'note'].includes(type)) {
      throw new AppError('Invalid annotation type. Must be bookmark, highlight, or note.', 400);
    }

    // Process snapshot text length cap (2000 chars)
    const truncatedHighlight = highlightText ? highlightText.substring(0, 2000) : undefined;

    // Check for existing bookmark at this exact location to prevent duplicates
    if (type === 'bookmark') {
      const duplicateQuery = { userId, bookId: rawBookId, type: 'bookmark' };
      if (cfiRange) duplicateQuery.cfiRange = cfiRange;
      else if (page !== undefined) duplicateQuery.page = page;

      const existingBookmark = await Annotation.findOne(duplicateQuery);
      if (existingBookmark) {
        return res.status(200).json({
          success: true,
          data: existingBookmark,
          isDuplicate: true,
        });
      }
    }

    const annotation = await Annotation.create({
      userId,
      collegeId,
      bookId: rawBookId,
      clientId: clientId || undefined,
      type,
      cfiRange,
      page,
      rects: rects || textRange,
      textRange: textRange || rects,
      textOffset,
      highlightText: truncatedHighlight,
      noteText,
      label,
      color,
      tags: Array.isArray(tags) ? tags : tags ? [tags] : [],
    });

    // Emit domain event
    domainEvents.emit('annotation.created', annotation);

    // Real-time socket broadcast
    emitAnnotationUpsert(userId, annotation);

    res.status(201).json({
      success: true,
      data: annotation,
    });
  } catch (error) {
    if (error.code === 11000) {
      const query = { userId: req.user.id || req.user._id };
      if (req.body.clientId) query.clientId = req.body.clientId;
      const existing = await Annotation.findOne(query);
      if (existing) {
        return res.status(200).json({ success: true, data: existing, isDuplicate: true });
      }
    }
    next(error);
  }
};

/**
 * @desc    Get user's annotations for a book or all books
 * @route   GET /api/v1/books/:bookId/annotations (and GET /api/v1/annotations)
 * @access  Private (Student)
 */
const getAnnotations = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;

    const rawBookId = req.params.bookId || req.query.bookId || req.query.resourceId;
    const { type } = req.query;

    const query = { userId };
    if (req.user.collegeId) {
      query.collegeId = req.user.collegeId;
    }
    if (rawBookId) {
      query.bookId = rawBookId;
    }
    if (type && ['bookmark', 'highlight', 'note'].includes(type)) {
      query.type = type;
    }

    const annotations = await Annotation.find(query).sort({ createdAt: -1 }).lean();

    res.json({
      success: true,
      count: annotations.length,
      data: annotations,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update an annotation (note, color, tags, label) with IDOR protection
 * @route   PATCH /api/v1/annotations/:id (and PUT /api/v1/annotations/:id)
 * @access  Private (Student)
 */
const updateAnnotation = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const { id } = req.params;
    const { noteText, color, tags, highlightText, label } = req.body;

    if (noteText && noteText.length > 5000) {
      throw new AppError('Note text cannot exceed 5000 characters.', 400);
    }

    const annotation = await Annotation.findById(id);
    if (!annotation) {
      throw new AppError('Annotation not found.', 404);
    }

    // IDOR Protection: Confirm caller owns this annotation
    if (String(annotation.userId) !== String(userId)) {
      throw new AppError('Forbidden: You do not have permission to modify this annotation.', 403);
    }

    if (noteText !== undefined) annotation.noteText = noteText;
    if (color !== undefined) annotation.color = color;
    if (label !== undefined) annotation.label = label;
    if (highlightText !== undefined) {
      annotation.highlightText = highlightText ? highlightText.substring(0, 2000) : '';
    }
    if (tags !== undefined) annotation.tags = Array.isArray(tags) ? tags : [tags];

    await annotation.save();

    // Emit domain event
    domainEvents.emit('annotation.updated', annotation);

    // Real-time socket broadcast
    emitAnnotationUpsert(userId, annotation);

    res.json({
      success: true,
      data: annotation,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete an annotation with IDOR protection
 * @route   DELETE /api/v1/annotations/:id
 * @access  Private (Student)
 */
const deleteAnnotation = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const { id } = req.params;

    const annotation = await Annotation.findById(id);
    if (!annotation) {
      throw new AppError('Annotation not found.', 404);
    }

    // IDOR Protection: Confirm caller owns this annotation
    if (String(annotation.userId) !== String(userId)) {
      throw new AppError('Forbidden: You do not have permission to delete this annotation.', 403);
    }

    await annotation.deleteOne();

    // Emit domain event
    domainEvents.emit('annotation.deleted', { id, bookId: annotation.bookId });

    // Real-time socket broadcast
    emitAnnotationDelete(userId, id, annotation.bookId);

    res.json({
      success: true,
      message: 'Annotation deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Idempotent offline queue sync endpoint
 * @route   POST /api/v1/books/:bookId/annotations/sync
 * @access  Private (Student)
 */
const syncAnnotations = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const collegeId = req.user.collegeId || null;
    const rawBookId = req.params.bookId || req.body.bookId;

    const items = req.body.items || (Array.isArray(req.body) ? req.body : []);

    if (!Array.isArray(items)) {
      throw new AppError('items must be an array of annotations to sync.', 400);
    }

    const synced = [];

    for (const item of items) {
      const itemBookId = item.bookId || item.resourceId || rawBookId;
      if (!itemBookId) continue;

      if (item.clientId) {
        const existing = await Annotation.findOne({ clientId: item.clientId, userId });
        if (existing) {
          synced.push(existing);
          continue;
        }
      }

      const count = await Annotation.countDocuments({ userId, bookId: itemBookId });
      if (count >= 500) {
        continue; // Skip items exceeding count cap during bulk sync
      }

      const created = await Annotation.create({
        userId,
        collegeId,
        bookId: itemBookId,
        clientId: item.clientId || undefined,
        type: item.type || 'highlight',
        cfiRange: item.cfiRange,
        page: item.page,
        rects: item.rects || item.textRange,
        textRange: item.textRange || item.rects,
        textOffset: item.textOffset,
        highlightText: item.highlightText ? item.highlightText.substring(0, 2000) : undefined,
        noteText: item.noteText ? item.noteText.substring(0, 5000) : undefined,
        label: item.label,
        color: item.color || 'yellow',
        tags: Array.isArray(item.tags) ? item.tags : [],
      });

      synced.push(created);
      domainEvents.emit('annotation.created', created);
      emitAnnotationUpsert(userId, created);
    }

    res.json({
      success: true,
      data: {
        syncedCount: synced.length,
        synced,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Export student annotations for a book in a stable JSON payload
 * @route   GET /api/v1/books/:bookId/annotations/export
 * @access  Private (Student)
 */
const exportAnnotations = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const { bookId } = req.params;

    const query = { userId, bookId };
    if (req.user.collegeId) {
      query.collegeId = req.user.collegeId;
    }

    const annotations = await Annotation.find(query).sort({ page: 1, createdAt: 1 }).lean();

    res.json({
      success: true,
      data: {
        bookId,
        exportedAt: new Date().toISOString(),
        totalAnnotations: annotations.length,
        annotations: annotations.map((a) => ({
          id: a._id,
          clientId: a.clientId,
          type: a.type,
          cfiRange: a.cfiRange,
          page: a.page,
          rects: a.rects,
          highlightText: a.highlightText,
          noteText: a.noteText,
          label: a.label,
          color: a.color,
          createdAt: a.createdAt,
          updatedAt: a.updatedAt,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Full-text search across student's notes, highlights, and labels
 * @route   GET /api/v1/annotations/search
 * @access  Private (Student)
 */
const searchAnnotations = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const { q } = req.query;

    const baseQuery = { userId };
    if (req.user.collegeId) {
      baseQuery.collegeId = req.user.collegeId;
    }

    if (!q || q.trim() === '') {
      const all = await Annotation.find(baseQuery).sort({ createdAt: -1 }).lean();
      return res.json({ success: true, data: all });
    }

    const escapeRegExp = (str) => (str ? String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '');
    const searchRegex = new RegExp(escapeRegExp(q.trim()), 'i');

    const results = await Annotation.find({
      ...baseQuery,
      $or: [
        { noteText: searchRegex },
        { highlightText: searchRegex },
        { label: searchRegex },
        { tags: searchRegex },
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
  syncAnnotations,
  exportAnnotations,
  searchAnnotations,
};
