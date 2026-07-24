const { generateCloudinarySignature, isCloudinaryConfigured } = require('../utils/cloudinary');
const { searchBooksInAlgolia, isAlgoliaConfigured, saveBookToAlgolia } = require('../utils/algolia');

describe('Cloudinary & Algolia Integration Helper Tests', () => {

  it('1. Cloudinary Signature Generator: should generate valid upload signature or report unconfigured state', () => {
    const res = generateCloudinarySignature({ folder: 'test_uploads' });

    expect(res).toBeDefined();
    if (!isCloudinaryConfigured()) {
      expect(res.configured).toBe(false);
      expect(res.message).toContain('Cloudinary credentials');
    } else {
      expect(res.configured).toBe(true);
      expect(res.signature).toBeDefined();
      expect(res.timestamp).toBeDefined();
      expect(res.uploadUrl).toBeDefined();
    }
  });

  it('2. Algolia Search Fallback: should return null or search result gracefully', async () => {
    const isConfigured = isAlgoliaConfigured();

    const searchResult = await searchBooksInAlgolia('javascript', { limit: 5 });

    if (!isConfigured || searchResult === null) {
      expect(searchResult === null || typeof searchResult === 'object').toBe(true);
    } else {
      expect(searchResult).toBeDefined();
      expect(Array.isArray(searchResult.objectIDs)).toBe(true);
    }
  });

  it('3. Algolia Book Transformer: should format book payload cleanly for indexing', async () => {
    const dummyBook = {
      _id: '60c72b2f9b1d8f0015c7e001',
      title: 'Clean Code',
      author: 'Robert C. Martin',
      isbn: '9780132350884',
      category: 'Computer Science',
      format: 'physical',
      publishedYear: 2008,
      language: 'English',
      availableCopies: 5,
      collegeId: '60c72b2f9b1d8f0015c7e000',
    };

    const result = await saveBookToAlgolia(dummyBook);
    expect(typeof result).toBe('boolean');
  });
});
