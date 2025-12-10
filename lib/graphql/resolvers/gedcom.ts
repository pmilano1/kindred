import crypto from 'node:crypto';
import {
  type GedcomFamily,
  type GedcomPerson,
  type GedcomSource,
  generateGedcom,
  parseGedcom,
} from '../../gedcom';
import { pool } from '../../pool';
import { type Context, requireAuth } from './helpers';

export const gedcomResolvers = {
  Query: {
    exportGedcom: async (
      _: unknown,
      {
        includeLiving,
        includeSources,
      }: { includeLiving?: boolean; includeSources?: boolean },
      context: Context,
    ) => {
      requireAuth(context);

      // Fetch all people with sources
      const peopleResult = await pool.query(`
        SELECT p.id, p.name_given, p.name_surname, p.name_full, p.sex,
               p.birth_date, p.birth_place, p.death_date, p.death_place,
               p.burial_date, p.burial_place, p.christening_date, p.christening_place, p.living
        FROM people p ORDER BY p.name_full
      `);

      // Fetch sources for all people
      const sourcesResult = await pool.query(`
        SELECT id, person_id, source_name, source_url, content FROM sources
      `);
      const sourcesByPerson = new Map<string, GedcomSource[]>();
      for (const src of sourcesResult.rows) {
        if (!sourcesByPerson.has(src.person_id))
          sourcesByPerson.set(src.person_id, []);
        sourcesByPerson.get(src.person_id)?.push(src);
      }

      const people: GedcomPerson[] = peopleResult.rows.map((p) => ({
        ...p,
        sources: sourcesByPerson.get(p.id) || [],
      }));

      // Fetch all families with children
      const familiesResult = await pool.query(`
        SELECT f.id, f.husband_id, f.wife_id, f.marriage_date, f.marriage_place
        FROM families f
      `);
      const childrenResult = await pool.query(`
        SELECT family_id, person_id FROM children
      `);
      const childrenByFamily = new Map<string, string[]>();
      for (const c of childrenResult.rows) {
        if (!childrenByFamily.has(c.family_id))
          childrenByFamily.set(c.family_id, []);
        childrenByFamily.get(c.family_id)?.push(c.person_id);
      }

      const families: GedcomFamily[] = familiesResult.rows.map((f) => ({
        ...f,
        children_ids: childrenByFamily.get(f.id) || [],
      }));

      return generateGedcom(people, families, {
        includeLiving: includeLiving ?? false,
        includeSources: includeSources ?? true,
        submitterName: 'Kindred Family Tree',
      });
    },
  },
  Mutation: {
    importGedcom: async (
      _: unknown,
      { content }: { content: string },
      context: Context,
    ) => {
      requireAuth(context, 'admin');

      const result = parseGedcom(content);
      const errors: string[] = [...result.errors];
      const warnings: string[] = [...result.warnings];

      // Map GEDCOM xrefs to new database IDs
      const xrefToId = new Map<string, string>();

      // Import people
      let peopleImported = 0;
      for (const person of result.people) {
        try {
          const id = crypto
            .randomBytes(9)
            .toString('base64')
            .replace(/[+/=]/g, '')
            .substring(0, 12);
          xrefToId.set(person.xref, id);

          await pool.query(
            `
            INSERT INTO people (id, name_full, name_given, name_surname, sex, birth_date, birth_place, death_date, death_place, burial_date, burial_place, christening_date, christening_place)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          `,
            [
              id,
              person.name_full,
              person.name_given,
              person.name_surname,
              person.sex,
              person.birth_date,
              person.birth_place,
              person.death_date,
              person.death_place,
              person.burial_date,
              person.burial_place,
              person.christening_date,
              person.christening_place,
            ],
          );
          peopleImported++;
        } catch (err) {
          errors.push(
            `Failed to import person ${person.name_full}: ${(err as Error).message}`,
          );
        }
      }

      // Import families
      let familiesImported = 0;
      for (const family of result.families) {
        try {
          const id = crypto
            .randomBytes(9)
            .toString('base64')
            .replace(/[+/=]/g, '')
            .substring(0, 12);
          const husbandId = family.husband_xref
            ? xrefToId.get(family.husband_xref)
            : null;
          const wifeId = family.wife_xref
            ? xrefToId.get(family.wife_xref)
            : null;

          await pool.query(
            `
            INSERT INTO families (id, husband_id, wife_id, marriage_date, marriage_place)
            VALUES ($1, $2, $3, $4, $5)
          `,
            [
              id,
              husbandId,
              wifeId,
              family.marriage_date,
              family.marriage_place,
            ],
          );

          // Add children
          for (const childXref of family.children_xrefs) {
            const childId = xrefToId.get(childXref);
            if (childId) {
              await pool.query(
                'INSERT INTO children (family_id, person_id) VALUES ($1, $2)',
                [id, childId],
              );
            } else {
              warnings.push(`Child ${childXref} not found for family`);
            }
          }
          familiesImported++;
        } catch (err) {
          errors.push(`Failed to import family: ${(err as Error).message}`);
        }
      }

      return { peopleImported, familiesImported, errors, warnings };
    },

    // Media mutations,
  },
};
