/**
 * GEDCOM 5.5.1 Export Utility
 * Generates valid GEDCOM format for genealogy data export
 */

export interface GedcomPerson {
  id: string;
  name_given: string | null;
  name_surname: string | null;
  name_full: string;
  sex: string | null;
  birth_date: string | null;
  birth_place: string | null;
  death_date: string | null;
  death_place: string | null;
  burial_date: string | null;
  burial_place: string | null;
  christening_date: string | null;
  christening_place: string | null;
  living: boolean;
  sources?: GedcomSource[];
}

export interface GedcomFamily {
  id: string;
  husband_id: string | null;
  wife_id: string | null;
  marriage_date: string | null;
  marriage_place: string | null;
  children_ids: string[];
}

export interface GedcomSource {
  id: string;
  source_name: string | null;
  source_url: string | null;
  content: string | null;
}

export interface GedcomExportOptions {
  includeLiving?: boolean;
  includeSources?: boolean;
  submitterName?: string;
}

function escapeGedcom(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/\n/g, ' ').replace(/@/g, '@@');
}

function formatGedcomDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return escapeGedcom(dateStr);
  const months = [
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC',
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function generateXref(type: 'I' | 'F' | 'S', id: string): string {
  const cleanId = id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
  return `@${type}${cleanId}@`;
}

export function generateGedcom(
  people: GedcomPerson[],
  families: GedcomFamily[],
  options: GedcomExportOptions = {},
): string {
  const lines: string[] = [];
  const {
    includeLiving = false,
    includeSources = true,
    submitterName = 'Kindred Family Tree',
  } = options;
  const filteredPeople = includeLiving
    ? people
    : people.filter((p) => !p.living);
  const filteredPeopleIds = new Set(filteredPeople.map((p) => p.id));

  // Header
  lines.push(
    '0 HEAD',
    '1 SOUR Kindred',
    '2 VERS 1.0',
    '2 NAME Kindred Family Tree',
    '1 DEST ANY',
  );
  lines.push(`1 DATE ${formatGedcomDate(new Date().toISOString())}`);
  lines.push(
    '1 GEDC',
    '2 VERS 5.5.1',
    '2 FORM LINEAGE-LINKED',
    '1 CHAR UTF-8',
    '1 SUBM @SUBM@',
  );
  lines.push('0 @SUBM@ SUBM', `1 NAME ${escapeGedcom(submitterName)}`);

  // Individual records
  for (const person of filteredPeople) {
    const xref = generateXref('I', person.id);
    lines.push(`0 ${xref} INDI`);
    const surname = person.name_surname || '';
    const given =
      person.name_given || person.name_full.replace(surname, '').trim();
    lines.push(`1 NAME ${escapeGedcom(given)} /${escapeGedcom(surname)}/`);
    if (given) lines.push(`2 GIVN ${escapeGedcom(given)}`);
    if (surname) lines.push(`2 SURN ${escapeGedcom(surname)}`);
    if (person.sex) {
      const sex = person.sex.toUpperCase().charAt(0);
      if (sex === 'M' || sex === 'F') lines.push(`1 SEX ${sex}`);
    }
    if (person.birth_date || person.birth_place) {
      lines.push('1 BIRT');
      if (person.birth_date)
        lines.push(`2 DATE ${formatGedcomDate(person.birth_date)}`);
      if (person.birth_place)
        lines.push(`2 PLAC ${escapeGedcom(person.birth_place)}`);
    }
    if (person.christening_date || person.christening_place) {
      lines.push('1 CHR');
      if (person.christening_date)
        lines.push(`2 DATE ${formatGedcomDate(person.christening_date)}`);
      if (person.christening_place)
        lines.push(`2 PLAC ${escapeGedcom(person.christening_place)}`);
    }
    if (person.death_date || person.death_place) {
      lines.push('1 DEAT');
      if (person.death_date)
        lines.push(`2 DATE ${formatGedcomDate(person.death_date)}`);
      if (person.death_place)
        lines.push(`2 PLAC ${escapeGedcom(person.death_place)}`);
    }
    if (person.burial_date || person.burial_place) {
      lines.push('1 BURI');
      if (person.burial_date)
        lines.push(`2 DATE ${formatGedcomDate(person.burial_date)}`);
      if (person.burial_place)
        lines.push(`2 PLAC ${escapeGedcom(person.burial_place)}`);
    }
    if (includeSources && person.sources) {
      for (const source of person.sources) {
        lines.push(`1 SOUR ${generateXref('S', source.id)}`);
      }
    }
  }

  // Family records
  for (const family of families) {
    const hasHusband =
      family.husband_id && filteredPeopleIds.has(family.husband_id);
    const hasWife = family.wife_id && filteredPeopleIds.has(family.wife_id);
    const hasChildren = family.children_ids.some((id) =>
      filteredPeopleIds.has(id),
    );
    if (!hasHusband && !hasWife && !hasChildren) continue;
    const xref = generateXref('F', family.id);
    lines.push(`0 ${xref} FAM`);
    if (hasHusband && family.husband_id)
      lines.push(`1 HUSB ${generateXref('I', family.husband_id)}`);
    if (hasWife && family.wife_id)
      lines.push(`1 WIFE ${generateXref('I', family.wife_id)}`);
    for (const childId of family.children_ids) {
      if (filteredPeopleIds.has(childId))
        lines.push(`1 CHIL ${generateXref('I', childId)}`);
    }
    if (family.marriage_date || family.marriage_place) {
      lines.push('1 MARR');
      if (family.marriage_date)
        lines.push(`2 DATE ${formatGedcomDate(family.marriage_date)}`);
      if (family.marriage_place)
        lines.push(`2 PLAC ${escapeGedcom(family.marriage_place)}`);
    }
  }

  // Source records
  if (includeSources) {
    const allSources = new Map<string, GedcomSource>();
    for (const person of filteredPeople) {
      if (person.sources) {
        for (const source of person.sources) allSources.set(source.id, source);
      }
    }
    for (const source of allSources.values()) {
      lines.push(`0 ${generateXref('S', source.id)} SOUR`);
      if (source.source_name)
        lines.push(`1 TITL ${escapeGedcom(source.source_name)}`);
      if (source.source_url)
        lines.push(`1 NOTE URL: ${escapeGedcom(source.source_url)}`);
      if (source.content) lines.push(`1 TEXT ${escapeGedcom(source.content)}`);
    }
  }

  lines.push('0 TRLR');
  return lines.join('\r\n');
}

// ===========================================
// GEDCOM PARSER (Import)
// ===========================================

export interface ParsedPerson {
  xref: string;
  name_full: string;
  name_given: string | null;
  name_surname: string | null;
  sex: string | null;
  birth_date: string | null;
  birth_place: string | null;
  death_date: string | null;
  death_place: string | null;
  burial_date: string | null;
  burial_place: string | null;
  christening_date: string | null;
  christening_place: string | null;
}

export interface ParsedFamily {
  xref: string;
  husband_xref: string | null;
  wife_xref: string | null;
  children_xrefs: string[];
  marriage_date: string | null;
  marriage_place: string | null;
}

export interface GedcomParseResult {
  people: ParsedPerson[];
  families: ParsedFamily[];
  errors: string[];
  warnings: string[];
}

interface GedcomLine {
  level: number;
  xref: string | null;
  tag: string;
  value: string;
}

function parseLine(line: string): GedcomLine | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  // GEDCOM line format: LEVEL [XREF] TAG [VALUE]
  const match = trimmed.match(/^(\d+)\s+(@[^@]+@)?\s*(\S+)\s*(.*)?$/);
  if (!match) return null;
  return {
    level: parseInt(match[1], 10),
    xref: match[2] || null,
    tag: match[3].toUpperCase(),
    value: (match[4] || '').trim(),
  };
}

export function parseGedcom(content: string): GedcomParseResult {
  const lines = content.split(/\r?\n/);
  const people: ParsedPerson[] = [];
  const families: ParsedFamily[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  let currentPerson: Partial<ParsedPerson> | null = null;
  let currentFamily: Partial<ParsedFamily> | null = null;
  let currentEvent: { type: string; date?: string; place?: string } | null =
    null;

  for (const line of lines) {
    const parsed = parseLine(line);
    if (!parsed) continue;

    const { level, xref, tag, value } = parsed;

    // Level 0 starts new records
    if (level === 0) {
      // Save previous records
      if (currentPerson?.xref) people.push(currentPerson as ParsedPerson);
      if (currentFamily?.xref) families.push(currentFamily as ParsedFamily);
      currentPerson = null;
      currentFamily = null;
      currentEvent = null;

      if (tag === 'INDI' && xref) {
        currentPerson = {
          xref,
          name_full: '',
          name_given: null,
          name_surname: null,
          sex: null,
          birth_date: null,
          birth_place: null,
          death_date: null,
          death_place: null,
          burial_date: null,
          burial_place: null,
          christening_date: null,
          christening_place: null,
        };
      } else if (tag === 'FAM' && xref) {
        currentFamily = {
          xref,
          husband_xref: null,
          wife_xref: null,
          children_xrefs: [],
          marriage_date: null,
          marriage_place: null,
        };
      }
      continue;
    }

    // Level 1 tags for individuals
    if (currentPerson && level === 1) {
      currentEvent = null;
      if (tag === 'NAME') {
        // Parse name: "Given /Surname/"
        const nameMatch = value.match(/^([^/]*)\s*\/([^/]*)\//);
        if (nameMatch) {
          currentPerson.name_given = nameMatch[1].trim() || null;
          currentPerson.name_surname = nameMatch[2].trim() || null;
          currentPerson.name_full =
            `${nameMatch[1].trim()} ${nameMatch[2].trim()}`.trim();
        } else {
          currentPerson.name_full = value.replace(/\//g, '').trim();
        }
      } else if (tag === 'SEX') {
        currentPerson.sex =
          value === 'M' ? 'male' : value === 'F' ? 'female' : null;
      } else if (tag === 'BIRT') {
        currentEvent = { type: 'birth' };
      } else if (tag === 'DEAT') {
        currentEvent = { type: 'death' };
      } else if (tag === 'BURI') {
        currentEvent = { type: 'burial' };
      } else if (tag === 'CHR') {
        currentEvent = { type: 'christening' };
      }
    }

    // Level 2 tags for event details
    if (currentPerson && currentEvent && level === 2) {
      if (tag === 'DATE') currentEvent.date = value;
      if (tag === 'PLAC') currentEvent.place = value;
      // Apply to person
      if (currentEvent.type === 'birth') {
        if (currentEvent.date) currentPerson.birth_date = currentEvent.date;
        if (currentEvent.place) currentPerson.birth_place = currentEvent.place;
      } else if (currentEvent.type === 'death') {
        if (currentEvent.date) currentPerson.death_date = currentEvent.date;
        if (currentEvent.place) currentPerson.death_place = currentEvent.place;
      } else if (currentEvent.type === 'burial') {
        if (currentEvent.date) currentPerson.burial_date = currentEvent.date;
        if (currentEvent.place) currentPerson.burial_place = currentEvent.place;
      } else if (currentEvent.type === 'christening') {
        if (currentEvent.date)
          currentPerson.christening_date = currentEvent.date;
        if (currentEvent.place)
          currentPerson.christening_place = currentEvent.place;
      }
    }

    // Level 1 tags for families
    if (currentFamily && level === 1) {
      currentEvent = null;
      if (tag === 'HUSB') currentFamily.husband_xref = value;
      else if (tag === 'WIFE') currentFamily.wife_xref = value;
      else if (tag === 'CHIL') currentFamily.children_xrefs?.push(value);
      else if (tag === 'MARR') currentEvent = { type: 'marriage' };
    }

    // Level 2 for family events
    if (currentFamily && currentEvent && level === 2) {
      if (tag === 'DATE') currentEvent.date = value;
      if (tag === 'PLAC') currentEvent.place = value;
      if (currentEvent.type === 'marriage') {
        if (currentEvent.date) currentFamily.marriage_date = currentEvent.date;
        if (currentEvent.place)
          currentFamily.marriage_place = currentEvent.place;
      }
    }
  }

  // Save last records
  if (currentPerson?.xref) people.push(currentPerson as ParsedPerson);
  if (currentFamily?.xref) families.push(currentFamily as ParsedFamily);

  return { people, families, errors, warnings };
}
