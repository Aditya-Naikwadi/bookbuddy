/**
 * ============================================================================
 * BOOKBUDDY ATOMIC CONDITIONAL UPDATE UTILITY
 * ============================================================================
 *
 * ARCHITECTURAL INVARIANT:
 * Check-then-act operations on shared/constrained state (capacities, quotas,
 * payment statuses, copy counts, token balances) MUST be executed as a single,
 * indivisible MongoDB command.
 *
 * Combining match filters, $expr condition predicates, and update operators
 * into findOneAndUpdate guarantees that precondition checking and state mutation
 * happen atomically at the database engine tier, eliminating race conditions.
 *
 * ❌ NEVER DO THIS (Check-then-act Race):
 * ```javascript
 * const item = await Model.findById(id);
 * if (item.count >= item.maxLimit) {
 *   throw new AppError('Limit reached', 400);
 * }
 * item.count += 1;
 * await item.save(); // BUG: Concurrent requests can interleave between read and save!
 * ```
 *
 * ✅ ALWAYS DO THIS (Atomic Conditional Update):
 * ```javascript
 * const { matched, doc } = await atomicConditionalUpdate(
 *   Model,
 *   { _id: id },
 *   { $lt: ['$count', '$maxLimit'] },
 *   { $inc: { count: 1 } }
 * );
 * if (!matched) {
 *   throw new AppError('Limit reached or item not found', 400);
 * }
 * ```
 */

/**
 * Result structure returned by atomicConditionalUpdate.
 *
 * @template T
 */
class ConditionalUpdateResult {
  /**
   * @param {boolean} matched - Whether the document matched the criteria and was updated.
   * @param {T|null} doc - The updated document (or null if condition failed/not found).
   * @param {'UPDATED'|'CONDITION_FAILED'|'NOT_FOUND'|null} [reason=null] - Optional diagnostic reason if checked.
   */
  constructor(matched, doc = null, reason = null) {
    this.matched = Boolean(matched);
    this.doc = doc;
    this.success = Boolean(matched);
    this.reason = reason || (matched ? 'UPDATED' : null);
  }
}

/**
 * Atomically evaluates preconditions and applies mutations in a single indivisible MongoDB command.
 *
 * @template T
 * @param {mongoose.Model<T>} Model - The Mongoose model to perform the operation on.
 * @param {Object} matchQuery - Base match filters (e.g. { _id, collegeId, status }).
 * @param {Object|null} [conditionExpr=null] - Optional conditional expression evaluated via $expr (e.g. { $lt: ['$count', '$maxLimit'] }).
 * @param {Object} updateOp - MongoDB update operators (e.g. { $inc: { count: 1 } }, { $set: { status: 'paid' } }).
 * @param {Object} [options={}] - Additional findOneAndUpdate options (e.g. session, returnDocument, upsert).
 * @param {boolean} [options.checkExistenceOnFailure=false] - If true and update fails, performs a secondary check to distinguish NOT_FOUND from CONDITION_FAILED.
 * @returns {Promise<ConditionalUpdateResult<T>>} Result object containing `matched`, `doc`, `success`, and `reason`.
 */
async function atomicConditionalUpdate(Model, matchQuery, conditionExpr, updateOp, options = {}) {
  if (!Model || typeof Model.findOneAndUpdate !== 'function') {
    throw new TypeError('atomicConditionalUpdate requires a valid Mongoose Model.');
  }

  const { checkExistenceOnFailure = false, ...findOptions } = options;

  // Build combined filter query
  const query = { ...(matchQuery || {}) };

  if (conditionExpr) {
    if (query.$expr) {
      query.$expr = { $and: [query.$expr, conditionExpr] };
    } else {
      query.$expr = conditionExpr;
    }
  }

  // Ensure default returnDocument: 'after' (return updated document) unless specified
  const effectiveOptions = {
    returnDocument: 'after',
    ...findOptions,
  };

  const updatedDoc = await Model.findOneAndUpdate(query, updateOp, effectiveOptions);

  if (updatedDoc) {
    return new ConditionalUpdateResult(true, updatedDoc, 'UPDATED');
  }

  // If document was not matched, determine why if requested
  let reason = null;
  if (checkExistenceOnFailure) {
    try {
      const exists = await Model.exists(matchQuery).session(effectiveOptions.session || null);
      reason = exists ? 'CONDITION_FAILED' : 'NOT_FOUND';
    } catch {
      reason = 'CONDITION_FAILED';
    }
  }

  return new ConditionalUpdateResult(false, null, reason);
}

module.exports = {
  atomicConditionalUpdate,
  ConditionalUpdateResult,
};
