const mongoose = require('mongoose');
const Book = require('../models/Book');

describe('Book Model Schema - Rating Aggregates', () => {
  test('defaults avgRating and ratingCount to 0 for new documents', () => {
    const book = new Book({
      collegeId: new mongoose.Types.ObjectId(),
      isbn: '978-0123456789',
      title: 'Test Rating Book',
      author: 'Test Author',
      category: 'Science',
    });

    expect(book.avgRating).toBe(0);
    expect(book.ratingCount).toBe(0);
  });

  test('existing documents without rating fields load correctly defaulting to 0', () => {
    const rawDoc = {
      _id: new mongoose.Types.ObjectId(),
      collegeId: new mongoose.Types.ObjectId(),
      isbn: '978-9876543210',
      title: 'Legacy Book',
      author: 'Legacy Author',
      category: 'Fiction',
    };

    const book = Book.hydrate(rawDoc);

    expect(book.avgRating).toBe(0);
    expect(book.ratingCount).toBe(0);
  });
});
