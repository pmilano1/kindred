import { pool } from '../../pool';
import type { Person } from '../../types';
import { getCached, setCache } from './helpers';

export const treeResolvers = {
  Query: {
    ancestors: async (
      _: unknown,
      { personId, generations = 3 }: { personId: string; generations?: number },
    ) => {
      interface PedigreeNode {
        id: string;
        person: Person;
        father: PedigreeNode | null;
        mother: PedigreeNode | null;
        generation: number;
        hasMoreAncestors: boolean;
      }

      const cacheKey = `pedigree:${personId}:${generations}`;
      const cached = getCached<PedigreeNode>(cacheKey);
      if (cached) return cached;

      // Recursive function to build pedigree node
      const buildPedigreeNode = async (
        pid: string,
        currentGen: number,
        maxGen: number,
      ): Promise<PedigreeNode | null> => {
        if (currentGen > maxGen) return null;

        // Get person data
        const personResult = await pool.query(
          'SELECT * FROM people WHERE id = $1',
          [pid],
        );
        if (personResult.rows.length === 0) return null;

        const person = personResult.rows[0];

        // Get parents
        const parentsResult = await pool.query(
          `SELECT f.husband_id, f.wife_id
           FROM children c
           JOIN families f ON c.family_id = f.id
           WHERE c.person_id = $1
           LIMIT 1`,
          [pid],
        );

        let father = null;
        let mother = null;
        let hasMoreAncestors = false;

        if (parentsResult.rows.length > 0) {
          const { husband_id, wife_id } = parentsResult.rows[0];

          if (currentGen < maxGen) {
            // Recursively build parent nodes
            if (husband_id) {
              father = await buildPedigreeNode(
                husband_id,
                currentGen + 1,
                maxGen,
              );
            }
            if (wife_id) {
              mother = await buildPedigreeNode(wife_id, currentGen + 1, maxGen);
            }
            // Check if either parent has more ancestors
            hasMoreAncestors = !!(
              father?.hasMoreAncestors || mother?.hasMoreAncestors
            );
          } else {
            // At max generation - check if there are more ancestors
            hasMoreAncestors = !!(husband_id || wife_id);
          }
        }

        return {
          id: pid,
          person,
          father,
          mother,
          generation: currentGen,
          hasMoreAncestors,
        };
      };

      const result = await buildPedigreeNode(personId, 0, generations);
      setCache(cacheKey, result);
      return result;
    },

    // Build nested descendant tree structure,
    descendants: async (
      _: unknown,
      { personId, generations = 3 }: { personId: string; generations?: number },
    ) => {
      interface DescendantNode {
        id: string;
        person: Person;
        spouse: Person | null;
        marriageYear: number | null;
        children: DescendantNode[];
        generation: number;
        hasMoreDescendants: boolean;
      }

      const cacheKey = `descendants:${personId}:${generations}`;
      const cached = getCached<DescendantNode>(cacheKey);
      if (cached) return cached;

      // Recursive function to build descendant node
      const buildDescendantNode = async (
        pid: string,
        currentGen: number,
        maxGen: number,
      ): Promise<DescendantNode | null> => {
        if (currentGen > maxGen) return null;

        // Get person data
        const personResult = await pool.query(
          'SELECT * FROM people WHERE id = $1',
          [pid],
        );
        if (personResult.rows.length === 0) return null;

        const person = personResult.rows[0];

        // Get families where this person is a parent
        const familiesResult = await pool.query(
          `SELECT f.id, f.husband_id, f.wife_id, f.marriage_year
           FROM families f
           WHERE f.husband_id = $1 OR f.wife_id = $1`,
          [pid],
        );

        // For simplicity, use first family (could be extended to handle multiple marriages)
        let spouse = null;
        let marriageYear = null;
        const children: DescendantNode[] = [];
        let hasMoreDescendants = false;

        if (familiesResult.rows.length > 0) {
          const family = familiesResult.rows[0];
          marriageYear = family.marriage_year;

          // Get spouse
          const spouseId =
            family.husband_id === pid ? family.wife_id : family.husband_id;
          if (spouseId) {
            const spouseResult = await pool.query(
              'SELECT * FROM people WHERE id = $1',
              [spouseId],
            );
            if (spouseResult.rows.length > 0) {
              spouse = spouseResult.rows[0];
            }
          }

          // Get children
          const childrenResult = await pool.query(
            `SELECT p.id FROM children c
             JOIN people p ON c.person_id = p.id
             WHERE c.family_id = $1
             ORDER BY c.birth_order`,
            [family.id],
          );

          if (currentGen < maxGen) {
            // Recursively build child nodes
            for (const child of childrenResult.rows) {
              const childNode = await buildDescendantNode(
                child.id,
                currentGen + 1,
                maxGen,
              );
              if (childNode) children.push(childNode);
            }
            // Check if any child has more descendants
            hasMoreDescendants = children.some(
              (child) => child.hasMoreDescendants,
            );
          } else {
            // At max generation - check if there are more descendants
            hasMoreDescendants = childrenResult.rows.length > 0;
          }
        }

        return {
          id: pid,
          person,
          spouse,
          marriageYear,
          children,
          generation: currentGen,
          hasMoreDescendants,
        };
      };

      const result = await buildDescendantNode(personId, 0, generations);
      setCache(cacheKey, result);
      return result;
    },

    // Timeline - grouped by year,
    timeline: async () => {
      const { rows } = await pool.query(`
        SELECT * FROM people WHERE birth_year IS NOT NULL OR death_year IS NOT NULL
      `);

      const events: Map<
        number,
        Array<{ type: string; person: Person }>
      > = new Map();

      for (const person of rows) {
        if (person.birth_year) {
          if (!events.has(person.birth_year)) events.set(person.birth_year, []);
          events.get(person.birth_year)?.push({ type: 'birth', person });
        }
        if (person.death_year && !person.living) {
          if (!events.has(person.death_year)) events.set(person.death_year, []);
          events.get(person.death_year)?.push({ type: 'death', person });
        }
      }

      return Array.from(events.entries())
        .map(([year, evts]) => ({ year, events: evts }))
        .sort((a, b) => b.year - a.year);
    },

    // Current user query,
  },
};
