const common = require('./schemas/common');
const moderation = require('./schemas/moderation');
const auth = require('./schemas/auth');
const joinRequests = require('./schemas/joinRequests');
const facilities = require('./schemas/facilities');
const payments = require('./schemas/payments');
const admin = require('./schemas/admin');
const library = require('./schemas/library');
const personalization = require('./schemas/personalization');
const roles = require('./constants/roles');
const normalization = require('./utils/normalization');

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
  ...roles,
  ...normalization,
};
