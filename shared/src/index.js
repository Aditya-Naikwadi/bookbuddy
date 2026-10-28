const common = require('./schemas/common');
const moderation = require('./schemas/moderation');
const auth = require('./schemas/auth');
const joinRequests = require('./schemas/joinRequests');
const facilities = require('./schemas/facilities');
const payments = require('./schemas/payments');
const admin = require('./schemas/admin');
const library = require('./schemas/library');
const personalization = require('./schemas/personalization');
const featureFlagSchemas = require('./schemas/featureFlags');
const roles = require('./constants/roles');
const featureFlags = require('./constants/featureFlags');
const normalization = require('./utils/normalization');
const url = require('./utils/url');

module.exports = {
  ...common,
  ...moderation,
  ...auth,
  ...joinRequests,
  ...facilities,
  ...payments,
  ...admin,
  ...library,
  ...personalization,
  ...featureFlagSchemas,
  ...roles,
  ...featureFlags,
  ...normalization,
  ...url,
};
