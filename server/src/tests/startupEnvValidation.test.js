describe('Production Environment Validation Unit Tests', () => {
  const setFullProdEnv = () => {
    process.env.NODE_ENV = 'production';
    process.env.PORT = '5000';
    process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/prod_test';
    process.env.JWT_SECRET = 'a_very_strong_prod_jwt_secret_key_12345';
    process.env.JWT_REFRESH_SECRET = 'a_very_strong_prod_refresh_secret_key_12345';
    process.env.JWT_ACCESS_EXPIRY = '15m';
    process.env.JWT_REFRESH_EXPIRY = '7d';
    process.env.CLIENT_ORIGIN = 'https://app.bookbuddy.edu';
    process.env.GOOGLE_BOOKS_API_KEY = 'AIza_test_key_12345';
    process.env.RAZORPAY_KEY_ID = 'rzp_live_testkey123';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'webhook_secret_prod_123';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
  };

  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('1. Fails startup in production if GOOGLE_BOOKS_API_KEY is missing', () => {
    jest.isolateModules(() => {
      setFullProdEnv();
      delete process.env.GOOGLE_BOOKS_API_KEY;
      jest.spyOn(require('dotenv'), 'config').mockImplementation(() => {});

      expect(() => {
        require('../config');
      }).toThrow(/GOOGLE_BOOKS_API_KEY/i);
    });
  });

  test('2. Fails startup in production if RAZORPAY_KEY_ID is missing', () => {
    jest.isolateModules(() => {
      setFullProdEnv();
      delete process.env.RAZORPAY_KEY_ID;
      jest.spyOn(require('dotenv'), 'config').mockImplementation(() => {});

      expect(() => {
        require('../config');
      }).toThrow(/RAZORPAY_KEY_ID/i);
    });
  });

  test('3. Fails startup in production if REDIS_URL is missing', () => {
    jest.isolateModules(() => {
      setFullProdEnv();
      delete process.env.REDIS_URL;
      jest.spyOn(require('dotenv'), 'config').mockImplementation(() => {});

      expect(() => {
        require('../config');
      }).toThrow(/REDIS_URL/i);
    });
  });
});
