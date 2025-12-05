import {
  getPeople,
  getPerson,
  searchPeople,
  getFamilies,
  getChildren,
  getPersonFamilies,
  getSiblings,
  getPersonResidences,
  getPersonOccupations,
  getPersonEvents,
  getPersonFacts,
  getResearchLog,
  addResearchLog,
  updateResearchStatus,
  updateResearchPriority,
  getStats,
  getResearchQueue,
  pool
} from '../db';

interface Context {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

// Helper to check auth for mutations
function requireAuth(context: Context, requiredRole: 'viewer' | 'editor' | 'admin' = 'viewer') {
  if (!context.user) {
    throw new Error('Authentication required');
  }
  if (requiredRole === 'admin' && context.user.role !== 'admin') {
    throw new Error('Admin access required');
  }
  if (requiredRole === 'editor' && !['admin', 'editor'].includes(context.user.role)) {
    throw new Error('Editor access required');
  }
  return context.user;
}

export const resolvers = {
  Query: {
    person: async (_: unknown, { id }: { id: string }) => {
      return getPerson(id);
    },
    
    people: async (_: unknown, { limit = 100, offset = 0 }: { limit?: number; offset?: number }) => {
      const people = await getPeople();
      return people.slice(offset, offset + limit);
    },
    
    search: async (_: unknown, { query }: { query: string }) => {
      return searchPeople(query);
    },
    
    family: async (_: unknown, { id }: { id: string }) => {
      const families = await getFamilies();
      return families.find(f => f.id === id) || null;
    },
    
    families: async () => {
      return getFamilies();
    },
    
    stats: async () => {
      return getStats();
    },
    
    researchQueue: async (_: unknown, { limit = 50 }: { limit?: number }) => {
      const queue = await getResearchQueue();
      return queue.slice(0, limit);
    },
  },

  Mutation: {
    updatePerson: async (_: unknown, { id, input }: { id: string; input: Record<string, unknown> }, context: Context) => {
      requireAuth(context, 'editor');
      
      const fields = Object.keys(input).filter(k => input[k] !== undefined);
      if (fields.length === 0) return getPerson(id);
      
      const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
      const values = fields.map(f => input[f]);
      
      await pool.query(
        `UPDATE people SET ${setClause} WHERE id = $1`,
        [id, ...values]
      );
      
      return getPerson(id);
    },
    
    addResearchLog: async (_: unknown, { personId, input }: { personId: string; input: { action_type: string; content: string; source_checked?: string; confidence?: string; external_url?: string } }, context: Context) => {
      requireAuth(context, 'editor');
      
      return addResearchLog(
        personId,
        input.action_type,
        input.content,
        input.source_checked,
        input.confidence,
        input.external_url
      );
    },
    
    updateResearchStatus: async (_: unknown, { personId, status }: { personId: string; status: string }, context: Context) => {
      requireAuth(context, 'editor');
      await updateResearchStatus(personId, status);
      return getPerson(personId);
    },
    
    updateResearchPriority: async (_: unknown, { personId, priority }: { personId: string; priority: number }, context: Context) => {
      requireAuth(context, 'editor');
      await updateResearchPriority(personId, priority);
      return getPerson(personId);
    },
  },

  // Field resolvers for Person type
  Person: {
    parents: async (person: { id: string }) => {
      const { asChild } = await getPersonFamilies(person.id);
      if (asChild.length === 0) return [];
      return asChild[0].parents;
    },
    
    siblings: async (person: { id: string }) => {
      return getSiblings(person.id);
    },
    
    spouses: async (person: { id: string }) => {
      const { asSpouse } = await getPersonFamilies(person.id);
      const spouseIds = asSpouse.map(f => 
        f.husband_id === person.id ? f.wife_id : f.husband_id
      ).filter(Boolean);
      
      const spouses = await Promise.all(spouseIds.map(id => getPerson(id!)));
      return spouses.filter(Boolean);
    },
    
    children: async (person: { id: string }) => {
      const { asSpouse } = await getPersonFamilies(person.id);
      const childIds: string[] = [];
      for (const family of asSpouse) {
        const kids = await getChildren(family.id);
        childIds.push(...kids);
      }
      const children = await Promise.all(childIds.map(id => getPerson(id)));
      return children.filter(Boolean);
    },
    
    families: async (person: { id: string }) => {
      const { asSpouse } = await getPersonFamilies(person.id);
      return asSpouse;
    },
    
    residences: (person: { id: string }) => getPersonResidences(person.id),
    occupations: (person: { id: string }) => getPersonOccupations(person.id),
    events: (person: { id: string }) => getPersonEvents(person.id),
    facts: (person: { id: string }) => getPersonFacts(person.id),
    researchLog: (person: { id: string }) => getResearchLog(person.id),
  },

  // Field resolvers for Family type
  Family: {
    husband: async (family: { husband_id: string | null }) => {
      if (!family.husband_id) return null;
      return getPerson(family.husband_id);
    },

    wife: async (family: { wife_id: string | null }) => {
      if (!family.wife_id) return null;
      return getPerson(family.wife_id);
    },

    children: async (family: { id: string }) => {
      const childIds = await getChildren(family.id);
      const children = await Promise.all(childIds.map(id => getPerson(id)));
      return children.filter(Boolean);
    },
  },
};

