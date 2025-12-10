import { pool } from '../../pool';
import { decodeCursor, encodeCursor } from './helpers';

export const searchResolvers = {
  Query: {
    people: async (
      _: unknown,
      {
        first = 50,
        after,
        last,
        before,
      }: { first?: number; after?: string; last?: number; before?: string },
    ) => {
      const limit = Math.min(first || last || 50, 100);
      const afterId = after ? decodeCursor(after) : null;
      const beforeId = before ? decodeCursor(before) : null;

      // Get total count
      const countResult = await pool.query('SELECT COUNT(*) FROM people');
      const totalCount = parseInt(countResult.rows[0].count, 10);

      // Build query with cursor
      let query = `SELECT *, COALESCE(notes, description) as description FROM people`;
      const params: (string | number)[] = [];

      if (afterId) {
        query += ` WHERE id > $1`;
        params.push(afterId);
      } else if (beforeId) {
        query += ` WHERE id < $1`;
        params.push(beforeId);
      }

      query += ` ORDER BY id ${beforeId ? 'DESC' : 'ASC'} LIMIT $${params.length + 1}`;
      params.push(limit + 1); // Fetch one extra to check if there's more

      const { rows } = await pool.query(query, params);
      const hasMore = rows.length > limit;
      const people = hasMore ? rows.slice(0, limit) : rows;
      if (beforeId) people.reverse();

      return {
        edges: people.map((p: { id: string }) => ({
          node: p,
          cursor: encodeCursor(p.id),
        })),
        pageInfo: {
          hasNextPage: hasMore,
          hasPreviousPage: !!afterId,
          startCursor: people.length ? encodeCursor(people[0].id) : null,
          endCursor: people.length
            ? encodeCursor(people[people.length - 1].id)
            : null,
          totalCount,
        },
      };
    },

    // Legacy offset-based (for backwards compatibility)
    // Tree component needs all people - allow up to 10000 for tree view,
    search: async (
      _: unknown,
      {
        query,
        first = 50,
        after,
      }: { query: string; first?: number; after?: string },
    ) => {
      const limit = Math.min(first, 100);
      const afterId = after ? decodeCursor(after) : null;

      // Prepare search query for PostgreSQL full-text search
      // Split into words and add prefix matching for partial word search
      const searchTerms = query
        .trim()
        .split(/\s+/)
        .filter((t) => t.length > 0);
      const tsQuery = searchTerms.map((term) => `${term}:*`).join(' & ');

      // Build the query with full-text search and trigram fallback
      let sql: string;
      let params: (string | number)[];

      if (searchTerms.length > 0) {
        // Use full-text search with relevance ranking
        // Combines tsvector search with trigram similarity for fuzzy matching
        sql = `
          WITH search_results AS (
            SELECT *,
              COALESCE(notes, description) as description,
              ts_rank(search_vector, to_tsquery('simple', immutable_unaccent($1))) as fts_rank,
              similarity(immutable_unaccent(name_full), immutable_unaccent($2)) as trgm_rank
            FROM people
            WHERE search_vector @@ to_tsquery('simple', immutable_unaccent($1))
               OR similarity(immutable_unaccent(name_full), immutable_unaccent($2)) > 0.2
          )
          SELECT *, (fts_rank * 2 + trgm_rank) as relevance_score
          FROM search_results
          ORDER BY relevance_score DESC, name_full
        `;
        params = [tsQuery, query];
      } else {
        sql = `SELECT *, COALESCE(notes, description) as description, 0 as relevance_score FROM people ORDER BY name_full`;
        params = [];
      }

      const { rows: allResults } = await pool.query(sql, params);

      // Get total count
      const totalCount = allResults.length;

      // Apply cursor-based pagination
      let startIdx = 0;
      if (afterId) {
        const afterIdx = allResults.findIndex(
          (p: { id: string }) => p.id === afterId,
        );
        if (afterIdx >= 0) startIdx = afterIdx + 1;
      }

      const paginatedPeople = allResults.slice(startIdx, startIdx + limit + 1);
      const hasMore = paginatedPeople.length > limit;
      const people = hasMore
        ? paginatedPeople.slice(0, limit)
        : paginatedPeople;

      return {
        edges: people.map((p: { id: string }) => ({
          node: p,
          cursor: encodeCursor(p.id),
        })),
        pageInfo: {
          hasNextPage: hasMore,
          hasPreviousPage: startIdx > 0,
          startCursor: people.length ? encodeCursor(people[0].id) : null,
          endCursor: people.length
            ? encodeCursor(people[people.length - 1].id)
            : null,
          totalCount,
        },
      };
    },
  },
};
