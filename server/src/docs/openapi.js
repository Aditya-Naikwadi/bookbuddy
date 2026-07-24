/**
 * OpenAPI 3.0.0 Specification Generator
 */
const getOpenApiSpec = () => {
  return {
    openapi: '3.0.0',
    info: {
      title: 'BookBuddy Multi-Tenant API',
      version: '1.0.0',
      description:
        'Production REST API for BookBuddy educational catalog aggregation, multi-tenant library circulation, and student engagement.',
    },
    servers: [
      {
        url: '/api/v1',
        description: 'Canonical API Version 1',
      },
    ],
    paths: {
      '/auth/login': {
        post: {
          summary: 'User Login',
          description: 'Authenticates user credentials and sets HTTP-only refresh cookie.',
          responses: {
            200: { description: 'Successful authentication' },
            401: { description: 'Invalid credentials' },
          },
        },
      },
      '/auth/register': {
        post: {
          summary: 'User Registration',
          description: 'Registers a new student or public user.',
          responses: {
            201: { description: 'User account created successfully' },
            400: { description: 'User already exists or validation error' },
          },
        },
      },
      '/books': {
        get: {
          summary: 'Search Book Catalog',
          description: 'Fetches paginated catalog items.',
          responses: {
            200: { description: 'Paginated list of books' },
          },
        },
      },
      '/payments/checkout-session': {
        post: {
          summary: 'Create Payment Checkout Session',
          description: 'Enforces Idempotency-Key header for duplicate payment protection.',
          responses: {
            200: { description: 'Checkout session payload' },
            400: { description: 'Missing Idempotency-Key header' },
          },
        },
      },
    },
  };
};

module.exports = { getOpenApiSpec };
