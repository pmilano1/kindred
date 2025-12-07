import { ClipboardList } from 'lucide-react';
import { PageHeader } from '@/components/ui';
import ResearchQueueClient from '@/components/ResearchQueueClient';
import { query } from '@/lib/graphql/server';
import { GET_RESEARCH_QUEUE } from '@/lib/graphql/queries';
import type { Person } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface ResearchPerson extends Pick<Person, 'id' | 'name_full' | 'birth_year' | 'death_year' | 'research_status' | 'research_priority' | 'last_researched'> {}

export default async function ResearchQueuePage() {
  let researchQueue: ResearchPerson[] = [];

  try {
    const result = await query<{ researchQueue: ResearchPerson[] }>(GET_RESEARCH_QUEUE, { limit: 100 });
    researchQueue = result.researchQueue;
  } catch (error) {
    console.error('[Research] Failed to fetch queue:', error);
  }

  return (
    <>
      <PageHeader
        title="Research Queue"
        subtitle={`${researchQueue.length} people prioritized for research`}
        icon={ClipboardList}
      />
      <div className="content-wrapper">
        <ResearchQueueClient initialQueue={researchQueue} />
      </div>
    </>
  );
}

