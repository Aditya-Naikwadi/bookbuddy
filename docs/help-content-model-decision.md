# Help Center Content Model Architecture Decision (F9.1)

**Date:** August 20, 2026  
**Status:** Approved & Implemented for v1  

## Decision Summary
For Version 1.0 of the BookBuddy Platform, the Help Center content model uses **static build-time bundled articles** stored in `client/src/content/help/` rather than a dynamic database-backed `HelpArticle` Mongoose schema.

## Technical Rationale
1. **Performance & Zero Latency**: Bundling static structured markdown/JSON articles at build time ensures instantaneous client-side search rendering without round-trip database queries or network latency.
2. **Zero Operating Overhead**: Eliminates API endpoint overhead, database connection pooling impact, and caching invalidation logic for help documentation.
3. **Simplicity & Safety**: Help articles cannot be corrupted or accidentally deleted via unauthorized DB queries.

## Future Trigger for Re-evaluation
A dynamic DB-backed `HelpArticle` Mongoose schema with administrative CRUD endpoints will be introduced **only if** library administrators specifically request real-time CMS content editing without standard frontend deployments.
