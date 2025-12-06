import Hero from '@/components/Hero';
import ResearchQueueClient from '@/components/ResearchQueueClient';
import { pool } from '@/lib/pool';

export const dynamic = 'force-dynamic';

interface ResearchPerson {
  id: string;
  name_full: string;
  birth_year: number | null;
  death_year: number | null;
  research_status: string | null;
  research_priority: number | null;
  research_notes_count?: number;
  last_researched?: string | null;
}

async function getResearchQueue(): Promise<ResearchPerson[]> {
  try {
    const { rows } = await pool.query(`
      SELECT id, name_full, birth_year, death_year, research_status, research_priority, last_researched
      FROM people
      WHERE research_status != 'verified' OR research_status IS NULL
      ORDER BY
        research_priority DESC NULLS LAST,
        (research_status = 'brick_wall') DESC,
        (research_status = 'in_progress') DESC,
        last_researched NULLS FIRST
      LIMIT 100
    `);
    return rows;
  } catch (error) {
    console.error('[Research] Failed to fetch queue:', error);
    return [];
  }
}

export default async function ResearchQueuePage() {
  const researchQueue = await getResearchQueue();

  return (
    <>
      <Hero
        title="Research Queue"
        subtitle={`${researchQueue.length} people prioritized for research`}
      />
      <div className="content-wrapper">
        <ResearchQueueClient initialQueue={researchQueue} />
      </div>
    </>
  );
}

