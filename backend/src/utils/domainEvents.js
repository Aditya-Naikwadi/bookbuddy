const EventEmitter = require('events');
const logger = require('./logger');

class DomainEventEmitter extends EventEmitter {}

const domainEventEmitter = new DomainEventEmitter();

// Log domain events for monitoring/debugging
['annotation.created', 'annotation.updated', 'annotation.deleted'].forEach((eventName) => {
  domainEventEmitter.on(eventName, (data) => {
    if (process.env.NODE_ENV !== 'test') {
      logger.info(`[Domain Event] ${eventName}:`, { id: data?.id || data?._id || data });
    }
  });
});

module.exports = domainEventEmitter;
