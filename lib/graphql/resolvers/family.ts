import crypto from 'node:crypto';
import { pool } from '../../pool';
import { logAudit } from '../../users';
import type { Loaders } from '../dataloaders';
import { type Context, requireAuth } from './helpers';

// Levenshtein distance for fuzzy name matching
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0),
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

interface DuplicateMatch {
  id: string;
  name_full: string;
  birth_year: number | null;
  death_year: number | null;
  living: boolean;
  matchReason: string;
}

// Check for potential duplicate people
async function checkDuplicates(
  nameFull: string,
  birthYear?: number | null,
  surname?: string | null,
): Promise<DuplicateMatch[]> {
  const matches: DuplicateMatch[] = [];
  const seen = new Set<string>();
  const nameNormalized = nameFull.toLowerCase().trim();

  // 1. Exact name match (case-insensitive)
  const { rows: exactMatches } = await pool.query(
    `SELECT id, name_full, birth_year, death_year, living
     FROM people WHERE LOWER(name_full) = $1 LIMIT 10`,
    [nameNormalized],
  );
  for (const row of exactMatches) {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      matches.push({ ...row, matchReason: 'exact_name' });
    }
  }

  // 2. Same surname + birth year (±2 years)
  if (surname && birthYear) {
    const { rows: surnameYearMatches } = await pool.query(
      `SELECT id, name_full, birth_year, death_year, living
       FROM people WHERE LOWER(name_surname) = $1
       AND birth_year BETWEEN $2 AND $3 LIMIT 10`,
      [surname.toLowerCase(), birthYear - 2, birthYear + 2],
    );
    for (const row of surnameYearMatches) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        matches.push({ ...row, matchReason: 'same_surname_birth_year' });
      }
    }
  }

  // 3. Similar name (Levenshtein distance < 3)
  // Get candidates with similar surname for efficiency
  const surnameForSearch = surname || nameFull.split(' ').pop() || '';
  if (surnameForSearch.length >= 2) {
    const { rows: candidates } = await pool.query(
      `SELECT id, name_full, birth_year, death_year, living
       FROM people WHERE LOWER(name_surname) LIKE $1 LIMIT 50`,
      [`%${surnameForSearch.toLowerCase().slice(0, 3)}%`],
    );
    for (const row of candidates) {
      if (!seen.has(row.id)) {
        const dist = levenshtein(nameNormalized, row.name_full.toLowerCase());
        if (dist > 0 && dist < 3) {
          seen.add(row.id);
          matches.push({ ...row, matchReason: 'similar_name' });
        }
      }
    }
  }

  return matches;
}

export const familyResolvers = {
  Query: {
    family: async (_: unknown, { id }: { id: string }, ctx: Context) =>
      ctx.loaders.familyLoader.load(id),

    // Duplicate detection query (Issue #287)
    checkDuplicates: async (
      _: unknown,
      {
        nameFull,
        birthYear,
        surname,
      }: { nameFull: string; birthYear?: number; surname?: string },
    ) => {
      return checkDuplicates(nameFull, birthYear, surname);
    },

    // Cursor-based pagination for people,
    families: async () => {
      const { rows } = await pool.query(`SELECT * FROM families`);
      return rows;
    },
  },
  Mutation: {
    createFamily: async (
      _: unknown,
      {
        input,
      }: {
        input: {
          husband_id?: string;
          wife_id?: string;
          marriage_date?: string;
          marriage_year?: number;
          marriage_place?: string;
        };
      },
      context: Context,
    ) => {
      const user = requireAuth(context, 'editor');
      const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
      const { rows } = await pool.query(
        `INSERT INTO families (id, husband_id, wife_id, marriage_date, marriage_year, marriage_place)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          id,
          input.husband_id || null,
          input.wife_id || null,
          input.marriage_date || null,
          input.marriage_year || null,
          input.marriage_place || null,
        ],
      );

      // Audit log
      await logAudit(user.id, 'create_family', {
        familyId: id,
        husbandId: input.husband_id,
        wifeId: input.wife_id,
      });

      return rows[0];
    },
    updateFamily: async (
      _: unknown,
      {
        id,
        input,
      }: {
        id: string;
        input: {
          husband_id?: string;
          wife_id?: string;
          marriage_date?: string;
          marriage_year?: number;
          marriage_place?: string;
        };
      },
      context: Context,
    ) => {
      const user = requireAuth(context, 'editor');
      const { rows } = await pool.query(
        `UPDATE families SET husband_id = COALESCE($2, husband_id), wife_id = COALESCE($3, wife_id),
         marriage_date = COALESCE($4, marriage_date), marriage_year = COALESCE($5, marriage_year),
         marriage_place = COALESCE($6, marriage_place) WHERE id = $1 RETURNING *`,
        [
          id,
          input.husband_id,
          input.wife_id,
          input.marriage_date,
          input.marriage_year,
          input.marriage_place,
        ],
      );

      // Audit log
      await logAudit(user.id, 'update_family', {
        familyId: id,
        husbandId: input.husband_id,
        wifeId: input.wife_id,
      });

      return rows[0] || null;
    },
    deleteFamily: async (
      _: unknown,
      { id }: { id: string },
      context: Context,
    ) => {
      const user = requireAuth(context, 'admin');
      // Delete children links first
      await pool.query('DELETE FROM children WHERE family_id = $1', [id]);
      await pool.query('DELETE FROM families WHERE id = $1', [id]);

      // Audit log
      await logAudit(user.id, 'delete_family', {
        familyId: id,
      });

      return true;
    },
    addChildToFamily: async (
      _: unknown,
      { familyId, personId }: { familyId: string; personId: string },
      context: Context,
    ) => {
      const user = requireAuth(context, 'editor');
      // Check if already exists
      const { rows: existing } = await pool.query(
        'SELECT 1 FROM children WHERE family_id = $1 AND person_id = $2',
        [familyId, personId],
      );
      if (existing.length > 0) return true;
      await pool.query(
        'INSERT INTO children (family_id, person_id) VALUES ($1, $2)',
        [familyId, personId],
      );

      // Audit log
      await logAudit(user.id, 'add_child_to_family', {
        familyId,
        personId,
      });

      return true;
    },
    removeChildFromFamily: async (
      _: unknown,
      { familyId, personId }: { familyId: string; personId: string },
      context: Context,
    ) => {
      const user = requireAuth(context, 'editor');
      await pool.query(
        'DELETE FROM children WHERE family_id = $1 AND person_id = $2',
        [familyId, personId],
      );

      // Audit log
      await logAudit(user.id, 'remove_child_from_family', {
        familyId,
        personId,
      });

      return true;
    },

    // High-level family mutations (Issue #283),
    addSpouse: async (
      _: unknown,
      {
        personId,
        spouseId,
        marriageDate,
        marriageYear,
        marriagePlace,
      }: {
        personId: string;
        spouseId: string;
        marriageDate?: string;
        marriageYear?: number;
        marriagePlace?: string;
      },
      context: Context,
    ) => {
      const user = requireAuth(context, 'editor');

      // Get both people to determine sex
      const { rows: people } = await pool.query(
        'SELECT id, sex FROM people WHERE id = ANY($1)',
        [[personId, spouseId]],
      );

      const person = people.find((p) => p.id === personId);
      const spouse = people.find((p) => p.id === spouseId);

      if (!person || !spouse) {
        throw new Error('Person or spouse not found');
      }

      // Determine husband/wife based on sex
      let husbandId = null;
      let wifeId = null;

      if (person.sex === 'M' && spouse.sex === 'F') {
        husbandId = personId;
        wifeId = spouseId;
      } else if (person.sex === 'F' && spouse.sex === 'M') {
        husbandId = spouseId;
        wifeId = personId;
      } else if (person.sex === 'M') {
        husbandId = personId;
        wifeId = spouseId;
      } else {
        husbandId = spouseId;
        wifeId = personId;
      }

      // Create family record
      const familyId = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
      const { rows } = await pool.query(
        `INSERT INTO families (id, husband_id, wife_id, marriage_date, marriage_year, marriage_place)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          familyId,
          husbandId,
          wifeId,
          marriageDate || null,
          marriageYear || null,
          marriagePlace || null,
        ],
      );

      // Audit log
      await logAudit(user.id, 'add_spouse', {
        personId,
        spouseId,
        familyId,
      });

      return rows[0];
    },
    addChild: async (
      _: unknown,
      {
        personId,
        childId,
        otherParentId,
      }: {
        personId: string;
        childId: string;
        otherParentId?: string;
      },
      context: Context,
    ) => {
      const user = requireAuth(context, 'editor');

      // Get person's sex to determine if they're husband or wife
      const { rows: personRows } = await pool.query(
        'SELECT sex FROM people WHERE id = $1',
        [personId],
      );

      if (personRows.length === 0) {
        throw new Error('Person not found');
      }

      const personSex = personRows[0].sex;

      // If otherParentId provided, find or create family with both parents
      if (otherParentId) {
        // Check if family already exists with these parents
        const { rows: existingFamilies } = await pool.query(
          `SELECT * FROM families
           WHERE (husband_id = $1 AND wife_id = $2)
              OR (husband_id = $2 AND wife_id = $1)`,
          [personId, otherParentId],
        );

        let familyId: string;

        if (existingFamilies.length > 0) {
          // Use existing family
          familyId = existingFamilies[0].id;
        } else {
          // Create new family with both parents
          const { rows: otherParentRows } = await pool.query(
            'SELECT sex FROM people WHERE id = $1',
            [otherParentId],
          );

          const otherParentSex =
            otherParentRows.length > 0 ? otherParentRows[0].sex : null;

          let husbandId = null;
          let wifeId = null;

          if (personSex === 'M' && otherParentSex === 'F') {
            husbandId = personId;
            wifeId = otherParentId;
          } else if (personSex === 'F' && otherParentSex === 'M') {
            husbandId = otherParentId;
            wifeId = personId;
          } else if (personSex === 'M') {
            husbandId = personId;
            wifeId = otherParentId;
          } else {
            husbandId = otherParentId;
            wifeId = personId;
          }

          familyId = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
          await pool.query(
            `INSERT INTO families (id, husband_id, wife_id)
             VALUES ($1, $2, $3)`,
            [familyId, husbandId, wifeId],
          );
        }

        // Add child to family
        const { rows: existingChild } = await pool.query(
          'SELECT 1 FROM children WHERE family_id = $1 AND person_id = $2',
          [familyId, childId],
        );

        if (existingChild.length === 0) {
          await pool.query(
            'INSERT INTO children (family_id, person_id) VALUES ($1, $2)',
            [familyId, childId],
          );
        }

        // Audit log
        await logAudit(user.id, 'add_child', {
          personId,
          childId,
          otherParentId,
          familyId,
        });

        // Return the family
        const { rows: familyRows } = await pool.query(
          'SELECT * FROM families WHERE id = $1',
          [familyId],
        );
        return familyRows[0];
      } else {
        // Single parent - find or create family with only this parent
        const { rows: existingFamilies } = await pool.query(
          `SELECT * FROM families
           WHERE (husband_id = $1 AND wife_id IS NULL)
              OR (wife_id = $1 AND husband_id IS NULL)`,
          [personId],
        );

        let familyId: string;

        if (existingFamilies.length > 0) {
          // Use existing single-parent family
          familyId = existingFamilies[0].id;
        } else {
          // Create new single-parent family
          familyId = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
          const husbandId = personSex === 'M' ? personId : null;
          const wifeId = personSex === 'F' ? personId : null;

          await pool.query(
            `INSERT INTO families (id, husband_id, wife_id)
             VALUES ($1, $2, $3)`,
            [familyId, husbandId, wifeId],
          );
        }

        // Add child to family
        const { rows: existingChild } = await pool.query(
          'SELECT 1 FROM children WHERE family_id = $1 AND person_id = $2',
          [familyId, childId],
        );

        if (existingChild.length === 0) {
          await pool.query(
            'INSERT INTO children (family_id, person_id) VALUES ($1, $2)',
            [familyId, childId],
          );
        }

        // Audit log
        await logAudit(user.id, 'add_child', {
          personId,
          childId,
          familyId,
        });

        // Return the family
        const { rows: familyRows } = await pool.query(
          'SELECT * FROM families WHERE id = $1',
          [familyId],
        );
        return familyRows[0];
      }
    },
    removeSpouse: async (
      _: unknown,
      { personId, spouseId }: { personId: string; spouseId: string },
      context: Context,
    ) => {
      const user = requireAuth(context, 'editor');

      // Find family with these spouses
      const { rows: families } = await pool.query(
        `SELECT id FROM families
         WHERE (husband_id = $1 AND wife_id = $2)
            OR (husband_id = $2 AND wife_id = $1)`,
        [personId, spouseId],
      );

      if (families.length === 0) {
        throw new Error('Family not found');
      }

      const familyId = families[0].id;

      // Check if family has children
      const { rows: children } = await pool.query(
        'SELECT COUNT(*) as count FROM children WHERE family_id = $1',
        [familyId],
      );

      if (parseInt(children[0].count, 10) > 0) {
        throw new Error(
          'Cannot remove spouse from family with children. Remove children first.',
        );
      }

      // Delete the family
      await pool.query('DELETE FROM families WHERE id = $1', [familyId]);

      // Audit log
      await logAudit(user.id, 'remove_spouse', {
        personId,
        spouseId,
        familyId,
      });

      return true;
    },
    removeChild: async (
      _: unknown,
      { personId, childId }: { personId: string; childId: string },
      context: Context,
    ) => {
      const user = requireAuth(context, 'editor');

      // Find families where personId is a parent
      const { rows: families } = await pool.query(
        `SELECT id FROM families
         WHERE husband_id = $1 OR wife_id = $1`,
        [personId],
      );

      if (families.length === 0) {
        throw new Error('No families found for this person');
      }

      // Remove child from all matching families
      let removed = false;
      for (const family of families) {
        const { rowCount } = await pool.query(
          'DELETE FROM children WHERE family_id = $1 AND person_id = $2',
          [family.id, childId],
        );
        if (rowCount && rowCount > 0) {
          removed = true;
        }
      }

      if (!removed) {
        throw new Error('Child not found in any family');
      }

      // Audit log
      await logAudit(user.id, 'remove_child', {
        personId,
        childId,
      });

      return true;
    },

    // Create person AND add as spouse in one transaction (Issue #287)
    createAndAddSpouse: async (
      _: unknown,
      {
        personId,
        newPerson,
        marriageDate,
        marriageYear,
        marriagePlace,
        skipDuplicateCheck,
      }: {
        personId: string;
        newPerson: {
          name_full: string;
          name_given?: string;
          name_surname?: string;
          sex?: string;
          birth_year?: number;
          birth_place?: string;
          living?: boolean;
        };
        marriageDate?: string;
        marriageYear?: number;
        marriagePlace?: string;
        skipDuplicateCheck?: boolean;
      },
      context: Context,
    ) => {
      const user = requireAuth(context, 'editor');
      let duplicatesSkipped = false;

      // Check for duplicates unless skipped
      if (!skipDuplicateCheck) {
        const duplicates = await checkDuplicates(
          newPerson.name_full,
          newPerson.birth_year,
          newPerson.name_surname,
        );
        if (duplicates.length > 0) {
          // Return duplicates as error for UI to handle
          throw new Error(`DUPLICATES_FOUND:${JSON.stringify(duplicates)}`);
        }
      } else {
        duplicatesSkipped = true;
      }

      // Create the new person
      const spouseId = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
      const { rows: personRows } = await pool.query(
        `INSERT INTO people (id, name_full, name_given, name_surname, sex, birth_year, birth_place, living)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          spouseId,
          newPerson.name_full,
          newPerson.name_given || null,
          newPerson.name_surname || null,
          newPerson.sex || null,
          newPerson.birth_year || null,
          newPerson.birth_place || null,
          newPerson.living ?? false,
        ],
      );

      // Get original person's sex
      const { rows: origPerson } = await pool.query(
        'SELECT sex FROM people WHERE id = $1',
        [personId],
      );

      // Determine husband/wife based on sex
      let husbandId = null;
      let wifeId = null;
      const origSex = origPerson[0]?.sex;
      const spouseSex = newPerson.sex;

      if (origSex === 'M' && spouseSex === 'F') {
        husbandId = personId;
        wifeId = spouseId;
      } else if (origSex === 'F' && spouseSex === 'M') {
        husbandId = spouseId;
        wifeId = personId;
      } else if (origSex === 'M') {
        husbandId = personId;
        wifeId = spouseId;
      } else {
        husbandId = spouseId;
        wifeId = personId;
      }

      // Create family
      const familyId = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
      const { rows: familyRows } = await pool.query(
        `INSERT INTO families (id, husband_id, wife_id, marriage_date, marriage_year, marriage_place)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          familyId,
          husbandId,
          wifeId,
          marriageDate || null,
          marriageYear || null,
          marriagePlace || null,
        ],
      );

      // Audit log
      await logAudit(user.id, 'create_and_add_spouse', {
        personId,
        spouseId,
        familyId,
        duplicatesSkipped,
      });

      return {
        person: personRows[0],
        family: familyRows[0],
        duplicatesSkipped,
      };
    },

    // Create person AND add as child in one transaction (Issue #287)
    createAndAddChild: async (
      _: unknown,
      {
        personId,
        newPerson,
        otherParentId,
        skipDuplicateCheck,
      }: {
        personId: string;
        newPerson: {
          name_full: string;
          name_given?: string;
          name_surname?: string;
          sex?: string;
          birth_year?: number;
          birth_place?: string;
          living?: boolean;
        };
        otherParentId?: string;
        skipDuplicateCheck?: boolean;
      },
      context: Context,
    ) => {
      const user = requireAuth(context, 'editor');
      let duplicatesSkipped = false;

      // Check for duplicates unless skipped
      if (!skipDuplicateCheck) {
        const duplicates = await checkDuplicates(
          newPerson.name_full,
          newPerson.birth_year,
          newPerson.name_surname,
        );
        if (duplicates.length > 0) {
          throw new Error(`DUPLICATES_FOUND:${JSON.stringify(duplicates)}`);
        }
      } else {
        duplicatesSkipped = true;
      }

      // Create the new child
      const childId = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
      const { rows: personRows } = await pool.query(
        `INSERT INTO people (id, name_full, name_given, name_surname, sex, birth_year, birth_place, living)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          childId,
          newPerson.name_full,
          newPerson.name_given || null,
          newPerson.name_surname || null,
          newPerson.sex || null,
          newPerson.birth_year || null,
          newPerson.birth_place || null,
          newPerson.living ?? false,
        ],
      );

      // Get parent's sex
      const { rows: parentRows } = await pool.query(
        'SELECT sex FROM people WHERE id = $1',
        [personId],
      );
      const parentSex = parentRows[0]?.sex;

      let familyId: string;

      if (otherParentId) {
        // Check for existing family with both parents
        const { rows: existingFamilies } = await pool.query(
          `SELECT * FROM families
           WHERE (husband_id = $1 AND wife_id = $2)
              OR (husband_id = $2 AND wife_id = $1)`,
          [personId, otherParentId],
        );

        if (existingFamilies.length > 0) {
          familyId = existingFamilies[0].id;
        } else {
          // Create new family with both parents
          const { rows: otherParentRows } = await pool.query(
            'SELECT sex FROM people WHERE id = $1',
            [otherParentId],
          );
          const otherSex = otherParentRows[0]?.sex;

          let husbandId = null;
          let wifeId = null;
          if (parentSex === 'M' && otherSex === 'F') {
            husbandId = personId;
            wifeId = otherParentId;
          } else if (parentSex === 'F' && otherSex === 'M') {
            husbandId = otherParentId;
            wifeId = personId;
          } else if (parentSex === 'M') {
            husbandId = personId;
            wifeId = otherParentId;
          } else {
            husbandId = otherParentId;
            wifeId = personId;
          }

          familyId = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
          await pool.query(
            `INSERT INTO families (id, husband_id, wife_id) VALUES ($1, $2, $3)`,
            [familyId, husbandId, wifeId],
          );
        }
      } else {
        // Single parent family
        const { rows: existingFamilies } = await pool.query(
          `SELECT * FROM families
           WHERE (husband_id = $1 AND wife_id IS NULL)
              OR (wife_id = $1 AND husband_id IS NULL)`,
          [personId],
        );

        if (existingFamilies.length > 0) {
          familyId = existingFamilies[0].id;
        } else {
          familyId = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
          const husbandId = parentSex === 'M' ? personId : null;
          const wifeId = parentSex === 'F' ? personId : null;
          await pool.query(
            `INSERT INTO families (id, husband_id, wife_id) VALUES ($1, $2, $3)`,
            [familyId, husbandId, wifeId],
          );
        }
      }

      // Add child to family
      await pool.query(
        'INSERT INTO children (family_id, person_id) VALUES ($1, $2)',
        [familyId, childId],
      );

      // Audit log
      await logAudit(user.id, 'create_and_add_child', {
        personId,
        childId,
        familyId,
        otherParentId,
        duplicatesSkipped,
      });

      // Get family for return
      const { rows: familyRows } = await pool.query(
        'SELECT * FROM families WHERE id = $1',
        [familyId],
      );

      return {
        person: personRows[0],
        family: familyRows[0],
        duplicatesSkipped,
      };
    },
  },
  Family: {
    husband: (
      family: { husband_id: string | null },
      _: unknown,
      ctx: Context,
    ) =>
      family.husband_id
        ? ctx.loaders.personLoader.load(family.husband_id)
        : null,
    wife: (family: { wife_id: string | null }, _: unknown, ctx: Context) =>
      family.wife_id ? ctx.loaders.personLoader.load(family.wife_id) : null,
    children: async (family: { id: string }, _: unknown, ctx: Context) => {
      const childIds = await ctx.loaders.childrenByFamilyLoader.load(family.id);
      return childIds.length
        ? (await ctx.loaders.personLoader.loadMany(childIds)).filter(Boolean)
        : [];
    },
  },

  // User type resolver to properly format dates and resolve linked_person
  User: {
    created_at: (user: { created_at: Date | string | null }) =>
      user.created_at ? new Date(user.created_at).toISOString() : null,
    last_login: (user: { last_login: Date | string | null }) =>
      user.last_login ? new Date(user.last_login).toISOString() : null,
    last_accessed: (user: { last_accessed: Date | string | null }) =>
      user.last_accessed ? new Date(user.last_accessed).toISOString() : null,
    linked_person: async (
      user: { person_id: string | null },
      _: unknown,
      ctx: { loaders: Loaders },
    ) => {
      if (!user.person_id) return null;
      return ctx.loaders.personLoader.load(user.person_id);
    },
  },

  // Invitation type resolver to properly format dates
  Invitation: {
    created_at: (inv: { created_at: Date | string | null }) =>
      inv.created_at ? new Date(inv.created_at).toISOString() : null,
    expires_at: (inv: { expires_at: Date | string | null }) =>
      inv.expires_at ? new Date(inv.expires_at).toISOString() : null,
    accepted_at: (inv: { accepted_at: Date | string | null }) =>
      inv.accepted_at ? new Date(inv.accepted_at).toISOString() : null,
  },

  // Media type resolver
};
