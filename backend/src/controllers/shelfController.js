const Shelf = require('../models/Shelf');

// GET /api/v1/shelves - Get student's custom shelves
const getUserShelves = async (req, res, next) => {
  try {
    const shelves = await Shelf.find({
      collegeId: req.user.collegeId,
      userId: req.user._id,
    })
      .populate('books', 'title author coverImage isbn genre availabilityStatus')
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      count: shelves.length,
      data: shelves,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/shelves - Create a new shelf
const createShelf = async (req, res, next) => {
  try {
    const { name, description, isPublic } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Shelf name is required.' });
    }

    const existing = await Shelf.findOne({
      collegeId: req.user.collegeId,
      userId: req.user._id,
      name: name.trim(),
    });

    if (existing) {
      return res
        .status(400)
        .json({ success: false, message: 'A shelf with this name already exists.' });
    }

    const shelf = await Shelf.create({
      collegeId: req.user.collegeId,
      userId: req.user._id,
      name: name.trim(),
      description: description || '',
      isPublic: Boolean(isPublic),
      books: [],
    });

    res.status(201).json({
      success: true,
      data: shelf,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/shelves/:id - Get shelf by ID
const getShelfById = async (req, res, next) => {
  try {
    const shelf = await Shelf.findOne({
      _id: req.params.id,
      collegeId: req.user.collegeId,
      $or: [{ userId: req.user._id }, { isPublic: true }],
    }).populate('books');

    if (!shelf) {
      return res.status(404).json({ success: false, message: 'Shelf not found or private.' });
    }

    res.status(200).json({
      success: true,
      data: shelf,
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/v1/shelves/:id - Update shelf
const updateShelf = async (req, res, next) => {
  try {
    const { name, description, isPublic } = req.body;
    const shelf = await Shelf.findOne({
      _id: req.params.id,
      userId: req.user._id,
      collegeId: req.user.collegeId,
    });

    if (!shelf) {
      return res.status(404).json({ success: false, message: 'Shelf not found.' });
    }

    if (name) shelf.name = name.trim();
    if (description !== undefined) shelf.description = description;
    if (isPublic !== undefined) shelf.isPublic = Boolean(isPublic);

    await shelf.save();

    res.status(200).json({
      success: true,
      data: shelf,
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/v1/shelves/:id - Delete shelf
const deleteShelf = async (req, res, next) => {
  try {
    const shelf = await Shelf.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
      collegeId: req.user.collegeId,
    });

    if (!shelf) {
      return res.status(404).json({ success: false, message: 'Shelf not found.' });
    }

    res.status(200).json({
      success: true,
      message: 'Shelf deleted successfully.',
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/shelves/:id/books - Add book to shelf
const addBookToShelf = async (req, res, next) => {
  try {
    const { bookId } = req.body;
    if (!bookId) {
      return res.status(400).json({ success: false, message: 'bookId is required.' });
    }

    const shelf = await Shelf.findOne({
      _id: req.params.id,
      userId: req.user._id,
      collegeId: req.user.collegeId,
    });

    if (!shelf) {
      return res.status(404).json({ success: false, message: 'Shelf not found.' });
    }

    if (!shelf.books.includes(bookId)) {
      shelf.books.push(bookId);
      await shelf.save();
    }

    await shelf.populate('books', 'title author coverImage isbn genre availabilityStatus');

    res.status(200).json({
      success: true,
      data: shelf,
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/v1/shelves/:id/books/:bookId - Remove book from shelf
const removeBookFromShelf = async (req, res, next) => {
  try {
    const { id, bookId } = req.params;

    const shelf = await Shelf.findOne({
      _id: id,
      userId: req.user._id,
      collegeId: req.user.collegeId,
    });

    if (!shelf) {
      return res.status(404).json({ success: false, message: 'Shelf not found.' });
    }

    shelf.books = shelf.books.filter((b) => b.toString() !== bookId);
    await shelf.save();

    await shelf.populate('books', 'title author coverImage isbn genre availabilityStatus');

    res.status(200).json({
      success: true,
      data: shelf,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getUserShelves,
  createShelf,
  getShelfById,
  updateShelf,
  deleteShelf,
  addBookToShelf,
  removeBookFromShelf,
};
