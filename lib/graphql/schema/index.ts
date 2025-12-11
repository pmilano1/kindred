// =====================================================
// GraphQL Schema - Modular Type Definitions
// =====================================================
// This file combines all modular type definitions into a single schema.

import { mutationTypes } from './mutations';
import { queryTypes } from './queries';
import { adminTypes } from './types/admin';
import { commentTypes } from './types/comment';
import { commonTypes } from './types/common';
import { crestTypes } from './types/crest';
import { familyTypes } from './types/family';
import { mediaTypes } from './types/media';
import { personTypes } from './types/person';
import { settingsTypes } from './types/settings';
import { sourceTypes } from './types/source';

// Combine all type definitions into a single schema
// Order matters: types must be defined before they are referenced
export const typeDefs = `#graphql
  ${personTypes}
  ${familyTypes}
  ${sourceTypes}
  ${mediaTypes}
  ${commentTypes}
  ${crestTypes}
  ${adminTypes}
  ${settingsTypes}
  ${commonTypes}
  ${queryTypes}
  ${mutationTypes}
`;

// Re-export individual type modules for direct access if needed
export {
  adminTypes,
  commentTypes,
  commonTypes,
  crestTypes,
  familyTypes,
  mediaTypes,
  mutationTypes,
  personTypes,
  queryTypes,
  settingsTypes,
  sourceTypes,
};
