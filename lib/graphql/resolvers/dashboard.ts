import { pool } from '../../pool';
import { getSettings } from '../../settings';

export const dashboardResolvers = {
  Query: {
    stats: async () => {
      const { rows } = await pool.query(`
        WITH completeness AS (
          SELECT
            p.id,
            (
              CASE WHEN p.name_full IS NOT NULL THEN 10 ELSE 0 END +
              CASE WHEN p.birth_date IS NOT NULL THEN 15
                   WHEN p.birth_year IS NOT NULL THEN 10 ELSE 0 END +
              CASE WHEN p.birth_place IS NOT NULL THEN 10 ELSE 0 END +
              CASE WHEN p.living = true THEN 15
                   WHEN p.death_date IS NOT NULL THEN 15
                   WHEN p.death_year IS NOT NULL THEN 10 ELSE 0 END +
              CASE WHEN p.living = true THEN 10
                   WHEN p.death_place IS NOT NULL THEN 10 ELSE 0 END +
              CASE WHEN EXISTS (SELECT 1 FROM children c JOIN families f ON c.family_id = f.id WHERE c.person_id = p.id) THEN 15 ELSE 0 END +
              CASE WHEN COALESCE(p.source_count, 0) > 0 THEN 15 ELSE 0 END +
              CASE WHEN EXISTS (SELECT 1 FROM media m WHERE m.person_id = p.id) THEN 10 ELSE 0 END
            ) as score
          FROM people p
        )
        SELECT
          (SELECT COUNT(*) FROM people) as total_people,
          (SELECT COUNT(*) FROM families) as total_families,
          (SELECT COUNT(*) FROM people WHERE sex = 'M') as male_count,
          (SELECT COUNT(*) FROM people WHERE sex = 'F') as female_count,
          (SELECT COUNT(*) FROM people WHERE living = true) as living_count,
          (SELECT MIN(birth_year) FROM people WHERE birth_year IS NOT NULL) as earliest_birth,
          (SELECT MAX(birth_year) FROM people WHERE birth_year IS NOT NULL) as latest_birth,
          (SELECT COUNT(*) FROM people WHERE familysearch_id IS NOT NULL) as with_familysearch_id,
          (SELECT COALESCE(AVG(score)::int, 0) FROM completeness) as average_completeness,
          (SELECT COUNT(*) FROM completeness WHERE score >= 80) as complete_count,
          (SELECT COUNT(*) FROM completeness WHERE score >= 50 AND score < 80) as partial_count,
          (SELECT COUNT(*) FROM completeness WHERE score < 50) as incomplete_count
      `);
      return rows[0];
    },
    dashboardStats: async () => {
      const { rows } = await pool.query(`
        WITH completeness AS (
          SELECT
            p.id,
            (
              CASE WHEN p.name_full IS NOT NULL THEN 10 ELSE 0 END +
              CASE WHEN p.birth_date IS NOT NULL THEN 15
                   WHEN p.birth_year IS NOT NULL THEN 10 ELSE 0 END +
              CASE WHEN p.birth_place IS NOT NULL THEN 10 ELSE 0 END +
              CASE WHEN p.living = true THEN 15
                   WHEN p.death_date IS NOT NULL THEN 15
                   WHEN p.death_year IS NOT NULL THEN 10 ELSE 0 END +
              CASE WHEN p.living = true THEN 10
                   WHEN p.death_place IS NOT NULL THEN 10 ELSE 0 END +
              CASE WHEN EXISTS (SELECT 1 FROM children c JOIN families f ON c.family_id = f.id WHERE c.person_id = p.id) THEN 15 ELSE 0 END +
              CASE WHEN COALESCE(p.source_count, 0) > 0 THEN 15 ELSE 0 END +
              CASE WHEN EXISTS (SELECT 1 FROM media m WHERE m.person_id = p.id) THEN 10 ELSE 0 END
            ) as score
          FROM people p
        )
        SELECT
          (SELECT COUNT(*) FROM people) as total_people,
          (SELECT COUNT(*) FROM families) as total_families,
          (SELECT COUNT(*) FROM sources) as total_sources,
          (SELECT COUNT(*) FROM media) as total_media,
          (SELECT MIN(birth_year) FROM people WHERE birth_year IS NOT NULL) as earliest_birth,
          (SELECT MAX(birth_year) FROM people WHERE birth_year IS NOT NULL) as latest_birth,
          (SELECT COUNT(*) FROM people WHERE living = true) as living_count,
          (SELECT COUNT(*) FROM people WHERE birth_year IS NULL OR birth_place IS NULL) as incomplete_count,
          (SELECT COALESCE(AVG(score)::int, 0) FROM completeness) as average_completeness,
          (SELECT COUNT(*) FROM completeness WHERE score >= 80) as complete_count,
          (SELECT COUNT(*) FROM completeness WHERE score >= 50 AND score < 80) as partial_count
      `);
      return rows[0];
    },
    recentActivity: async (_: unknown, { limit = 10 }: { limit?: number }) => {
      const { rows } = await pool.query(
        `
        SELECT
          al.id,
          al.action,
          al.details::text as details,
          u.name as user_name,
          u.email as user_email,
          al.created_at,
          al.details->>'person_id' as person_id,
          al.details->>'person_name' as person_name
        FROM audit_log al
        LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.created_at DESC
        LIMIT $1
        `,
        [Math.min(limit, 50)],
      );
      return rows;
    },
    incompleteProfiles: async (
      _: unknown,
      { limit = 10 }: { limit?: number },
    ) => {
      const { rows } = await pool.query(
        `
        SELECT
          p.*,
          COALESCE(p.notes, p.description) as description,
          CASE
            WHEN p.birth_year IS NULL THEN 'birth_year'
            WHEN p.birth_place IS NULL THEN 'birth_place'
            WHEN p.death_year IS NULL AND p.living = false THEN 'death_year'
            WHEN p.death_place IS NULL AND p.living = false THEN 'death_place'
            ELSE 'parents'
          END as primary_missing
        FROM people p
        WHERE
          p.birth_year IS NULL
          OR p.birth_place IS NULL
          OR (p.living = false AND p.death_year IS NULL)
          OR NOT EXISTS (
            SELECT 1 FROM children c
            JOIN families f ON c.family_id = f.id
            WHERE c.person_id = p.id
          )
        ORDER BY p.research_priority DESC NULLS LAST, p.name_full
        LIMIT $1
        `,
        [Math.min(limit, 20)],
      );

      return rows.map(
        (row: {
          primary_missing: string;
          birth_year: number | null;
          birth_place: string | null;
          death_year: number | null;
          death_place: string | null;
          living: boolean;
        }) => {
          const missingFields: string[] = [];
          if (!row.birth_year) missingFields.push('birth_year');
          if (!row.birth_place) missingFields.push('birth_place');
          if (!row.living && !row.death_year) missingFields.push('death_year');
          if (!row.living && !row.death_place)
            missingFields.push('death_place');

          const suggestions: Record<string, string> = {
            birth_year: 'Add birth year from records',
            birth_place: 'Research birth location',
            death_year: 'Find death records',
            death_place: 'Research death location',
            parents: 'Research and add parents',
          };

          return {
            person: row,
            missing_fields: missingFields,
            suggestion: suggestions[row.primary_missing] || 'Complete profile',
          };
        },
      );
    },
    researchQueue: async (
      _: unknown,
      { first = 50, after }: { first?: number; after?: string },
    ) => {
      const limit = Math.min(first, 100);

      // Get configurable weights from settings
      const settings = await getSettings();
      const wMissingDates = settings.research_weight_missing_core_dates;
      const wMissingPlaces = settings.research_weight_missing_places;
      const wEstimatedDates = settings.research_weight_estimated_dates;
      const wPlaceholderParent = settings.research_weight_placeholder_parent;
      const wLowSources = settings.research_weight_low_sources;
      const wManualPriority = settings.research_weight_manual_priority;

      // Decode cursor: format is "score:id" where score is the auto_score
      let afterScore: number | null = null;
      let afterId: string | null = null;
      if (after) {
        try {
          const decoded = Buffer.from(after, 'base64').toString('utf8');
          const [scoreStr, id] = decoded.split(':');
          afterScore = parseFloat(scoreStr);
          afterId = id;
        } catch {
          // Invalid cursor, ignore
        }
      }

      // Get total count of research queue items
      const countResult = await pool.query(
        `SELECT COUNT(*) FROM people
         WHERE (research_status != 'verified' OR research_status IS NULL)
           AND (is_placeholder = false OR is_placeholder IS NULL)`,
      );
      const totalCount = parseInt(countResult.rows[0].count, 10);

      // Build cursor condition
      const cursorCondition =
        afterScore !== null && afterId
          ? `AND (auto_score < $8 OR (auto_score = $8 AND p.id > $9))`
          : '';

      const params: (number | string)[] = [
        limit + 1, // Fetch one extra to check if there's more
        wMissingDates,
        wMissingPlaces,
        wEstimatedDates,
        wPlaceholderParent,
        wLowSources,
        wManualPriority,
      ];

      if (afterScore !== null && afterId) {
        params.push(afterScore, afterId);
      }

      const { rows } = await pool.query(
        `
        WITH placeholder_parents AS (
          SELECT DISTINCT c.person_id
          FROM children c
          JOIN families f ON c.family_id = f.id
          JOIN people parent ON (parent.id = f.husband_id OR parent.id = f.wife_id)
          WHERE parent.is_placeholder = true
        ),
        scored_people AS (
          SELECT p.*,
            (
              CASE WHEN p.birth_year IS NULL THEN $2 ELSE 0 END +
              CASE WHEN NOT p.living AND p.death_year IS NULL THEN $2 ELSE 0 END +
              CASE WHEN p.birth_place IS NULL OR p.birth_place = '' THEN $3 ELSE 0 END +
              CASE WHEN NOT p.living AND (p.death_place IS NULL OR p.death_place = '') THEN $3 ELSE 0 END +
              CASE WHEN p.birth_date_accuracy IN ('ESTIMATED', 'RANGE') THEN $4 ELSE 0 END +
              CASE WHEN p.death_date_accuracy IN ('ESTIMATED', 'RANGE') THEN $4 ELSE 0 END +
              CASE WHEN pp.person_id IS NOT NULL THEN $5 ELSE 0 END +
              CASE WHEN COALESCE(p.source_count, 0) = 0 THEN $6 ELSE 0 END +
              COALESCE(p.research_priority, 0) * $7
            ) AS auto_score
          FROM people p
          LEFT JOIN placeholder_parents pp ON pp.person_id = p.id
          WHERE (p.research_status != 'verified' OR p.research_status IS NULL)
            AND (p.is_placeholder = false OR p.is_placeholder IS NULL)
        )
        SELECT * FROM scored_people
        WHERE 1=1 ${cursorCondition}
        ORDER BY
          auto_score DESC,
          id ASC
        LIMIT $1
      `,
        params,
      );

      const hasMore = rows.length > limit;
      const people = hasMore ? rows.slice(0, limit) : rows;

      type ScoredPerson = Record<string, unknown> & {
        auto_score: number;
        id: string;
      };

      // Create cursor encoding score and id
      const makeCursor = (row: ScoredPerson) =>
        Buffer.from(`${row.auto_score}:${row.id}`).toString('base64');

      // Convert Date objects to ISO strings for serialization
      const nodes: ScoredPerson[] = people.map((row: ScoredPerson) => ({
        ...row,
        last_researched:
          row.last_researched instanceof Date
            ? row.last_researched.toISOString()
            : row.last_researched,
        created_at:
          row.created_at instanceof Date
            ? row.created_at.toISOString()
            : row.created_at,
        updated_at:
          row.updated_at instanceof Date
            ? row.updated_at.toISOString()
            : row.updated_at,
      }));

      return {
        edges: nodes.map((node) => ({
          node,
          cursor: makeCursor(node),
        })),
        pageInfo: {
          hasNextPage: hasMore,
          hasPreviousPage: !!after,
          startCursor: nodes.length ? makeCursor(nodes[0]) : null,
          endCursor: nodes.length ? makeCursor(nodes[nodes.length - 1]) : null,
          totalCount,
        },
      };
    },

    // Build nested pedigree tree structure for ancestor view,
  },
};
