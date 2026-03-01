/**
 * M12 Search Engine -- Module entry point
 * Exports routes, action registration, and public service interface.
 */

export { searchRoutes } from './search.routes.js';
export { registerSearchActions } from './search.actions.js';

// Public service surface for cross-module consumption
export { SearchService } from './search.service.js';
export type { ISearchService } from './search.interface.js';
export type { SearchQuery, SearchResult, SearchIndexEntry } from './search.types.js';
