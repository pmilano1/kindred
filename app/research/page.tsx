import Hero from '@/components/Hero';
import ResearchQueueClient from '@/components/ResearchQueueClient';
import { query } from '@/lib/graphql/server';
import { GET_RESEARCH_QUEUE } from '@/lib/graphql/queries';

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

export default async function ResearchQueuePage() {
  const { researchQueue } = await query<{ researchQueue: ResearchPerson[] }>(GET_RESEARCH_QUEUE, { limit: 100 });

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

