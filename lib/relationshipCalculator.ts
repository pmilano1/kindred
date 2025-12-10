/**
 * Relationship Calculator
 *
 * Calculates the genealogical relationship between two people using
 * bidirectional BFS to find the shortest path through the family tree.
 */

export interface Person {
  id: string;
  name_full: string;
  parents: { id: string }[];
  children: { id: string }[];
  spouses: { id: string }[];
}

export interface RelationshipPath {
  personA: Person;
  personB: Person;
  relationship: string;
  path: PathStep[];
  commonAncestor?: Person;
  distance: number;
}

export interface PathStep {
  person: Person;
  relationship: string; // 'parent', 'child', 'spouse', 'sibling'
}

/**
 * Calculate relationship between two people
 */
export function calculateRelationship(
  personA: Person,
  personB: Person,
  allPeople: Map<string, Person>,
): RelationshipPath | null {
  if (personA.id === personB.id) {
    return {
      personA,
      personB,
      relationship: 'Same person',
      path: [],
      distance: 0,
    };
  }

  // Use bidirectional BFS to find shortest path
  const path = findShortestPath(personA, personB, allPeople);
  if (!path) return null;

  // Calculate relationship name from path
  const relationship = describeRelationship(path, personA, personB);

  return {
    personA,
    personB,
    relationship,
    path,
    distance: path.length,
  };
}

/**
 * Find shortest path between two people using BFS
 */
function findShortestPath(
  start: Person,
  end: Person,
  allPeople: Map<string, Person>,
): PathStep[] | null {
  const queue: { person: Person; path: PathStep[] }[] = [
    { person: start, path: [] },
  ];
  const visited = new Set<string>([start.id]);

  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) break;
    const { person, path } = item;

    // Check all connections
    const connections = getConnections(person, allPeople);

    for (const { connectedPerson, relationshipType } of connections) {
      if (connectedPerson.id === end.id) {
        // Found the target!
        return [
          ...path,
          { person: connectedPerson, relationship: relationshipType },
        ];
      }

      if (!visited.has(connectedPerson.id)) {
        visited.add(connectedPerson.id);
        queue.push({
          person: connectedPerson,
          path: [
            ...path,
            { person: connectedPerson, relationship: relationshipType },
          ],
        });
      }
    }
  }

  return null; // No path found
}

/**
 * Get all connections (parents, children, spouses, siblings) for a person
 */
function getConnections(
  person: Person,
  allPeople: Map<string, Person>,
): { connectedPerson: Person; relationshipType: string }[] {
  const connections: { connectedPerson: Person; relationshipType: string }[] =
    [];

  // Parents
  for (const parent of person.parents) {
    const p = allPeople.get(parent.id);
    if (p) connections.push({ connectedPerson: p, relationshipType: 'parent' });
  }

  // Children
  for (const child of person.children) {
    const c = allPeople.get(child.id);
    if (c) connections.push({ connectedPerson: c, relationshipType: 'child' });
  }

  // Spouses
  for (const spouse of person.spouses) {
    const s = allPeople.get(spouse.id);
    if (s) connections.push({ connectedPerson: s, relationshipType: 'spouse' });
  }

  // Siblings (people who share at least one parent)
  const siblings = getSiblings(person, allPeople);
  for (const sibling of siblings) {
    connections.push({ connectedPerson: sibling, relationshipType: 'sibling' });
  }

  return connections;
}

/**
 * Get siblings (people who share at least one parent)
 */
function getSiblings(person: Person, allPeople: Map<string, Person>): Person[] {
  const siblings = new Set<string>();

  for (const parent of person.parents) {
    const p = allPeople.get(parent.id);
    if (!p) continue;

    for (const child of p.children) {
      if (child.id !== person.id) {
        siblings.add(child.id);
      }
    }
  }

  return Array.from(siblings)
    .map((id) => allPeople.get(id))
    .filter((p): p is Person => p !== undefined);
}

/**
 * Describe the relationship based on the path
 */
function describeRelationship(
  path: PathStep[],
  _personA: Person,
  _personB: Person,
): string {
  if (path.length === 0) return 'Same person';
  if (path.length === 1) {
    // Direct relationship
    const rel = path[0].relationship;
    if (rel === 'parent') return 'Parent';
    if (rel === 'child') return 'Child';
    if (rel === 'spouse') return 'Spouse';
    if (rel === 'sibling') return 'Sibling';
  }

  // Analyze path to determine relationship
  const upSteps = path.filter((s) => s.relationship === 'parent').length;
  const downSteps = path.filter((s) => s.relationship === 'child').length;
  const hasSpouse = path.some((s) => s.relationship === 'spouse');

  // Handle in-law relationships (spouse in path)
  if (hasSpouse) {
    // Find where the spouse connection is
    const spouseIndex = path.findIndex((s) => s.relationship === 'spouse');

    // Count steps before and after spouse
    const beforeSpouse = path.slice(0, spouseIndex);
    const afterSpouse = path.slice(spouseIndex + 1);

    const upBeforeSpouse = beforeSpouse.filter(
      (s) => s.relationship === 'parent',
    ).length;
    const downBeforeSpouse = beforeSpouse.filter(
      (s) => s.relationship === 'child',
    ).length;
    const upAfterSpouse = afterSpouse.filter(
      (s) => s.relationship === 'parent',
    ).length;
    const downAfterSpouse = afterSpouse.filter(
      (s) => s.relationship === 'child',
    ).length;

    // Spouse's parent = parent-in-law
    if (
      upBeforeSpouse === 0 &&
      downBeforeSpouse === 0 &&
      upAfterSpouse === 1 &&
      downAfterSpouse === 0
    ) {
      return 'Parent-in-law';
    }

    // Spouse's grandparent = grandparent-in-law
    if (
      upBeforeSpouse === 0 &&
      downBeforeSpouse === 0 &&
      upAfterSpouse === 2 &&
      downAfterSpouse === 0
    ) {
      return 'Grandparent-in-law';
    }

    // Spouse's child = step-child
    if (
      upBeforeSpouse === 0 &&
      downBeforeSpouse === 0 &&
      upAfterSpouse === 0 &&
      downAfterSpouse === 1
    ) {
      return 'Step-child';
    }

    // Spouse's sibling = sibling-in-law
    if (
      upBeforeSpouse === 0 &&
      downBeforeSpouse === 0 &&
      upAfterSpouse === 1 &&
      downAfterSpouse === 1
    ) {
      return 'Sibling-in-law';
    }

    // Child's spouse = child-in-law
    if (
      upBeforeSpouse === 0 &&
      downBeforeSpouse === 1 &&
      upAfterSpouse === 0 &&
      downAfterSpouse === 0
    ) {
      return 'Child-in-law';
    }

    // Sibling's spouse = sibling-in-law
    if (
      upBeforeSpouse === 1 &&
      downBeforeSpouse === 1 &&
      upAfterSpouse === 0 &&
      downAfterSpouse === 0
    ) {
      return 'Sibling-in-law';
    }

    // Fallback for other in-law relationships
    return 'Related by marriage';
  }

  // Direct ancestor/descendant
  if (downSteps === 0 && upSteps > 0) {
    if (upSteps === 1) return 'Parent';
    if (upSteps === 2) return 'Grandparent';
    if (upSteps === 3) return 'Great-grandparent';
    return `${getGreatPrefix(upSteps - 2)}grandparent`;
  }

  if (upSteps === 0 && downSteps > 0) {
    if (downSteps === 1) return 'Child';
    if (downSteps === 2) return 'Grandchild';
    if (downSteps === 3) return 'Great-grandchild';
    return `${getGreatPrefix(downSteps - 2)}grandchild`;
  }

  // Siblings
  if (upSteps === 1 && downSteps === 1 && path.length === 2) {
    return 'Sibling';
  }

  // Aunt/Uncle/Niece/Nephew
  if (upSteps === 2 && downSteps === 1) {
    return 'Aunt/Uncle';
  }
  if (upSteps === 1 && downSteps === 2) {
    return 'Niece/Nephew';
  }

  // Cousins
  if (upSteps === downSteps && upSteps >= 2) {
    const cousinDegree = upSteps - 1;
    if (cousinDegree === 1) return '1st Cousin';
    if (cousinDegree === 2) return '2nd Cousin';
    if (cousinDegree === 3) return '3rd Cousin';
    return `${cousinDegree}th Cousin`;
  }

  // Cousins once/twice removed
  if (upSteps > 1 && downSteps > 1) {
    const minGen = Math.min(upSteps, downSteps) - 1;
    const removed = Math.abs(upSteps - downSteps);
    const cousinType =
      minGen === 1 ? '1st' : minGen === 2 ? '2nd' : `${minGen}th`;
    const removedText =
      removed === 1 ? 'once removed' : `${removed} times removed`;
    return `${cousinType} Cousin ${removedText}`;
  }

  // Fallback
  return `${upSteps} generations up, ${downSteps} generations down`;
}

function getGreatPrefix(count: number): string {
  if (count === 1) return 'Great-';
  return 'Great-'.repeat(count);
}
