import { merge } from 'lodash';
import { adminResolvers } from './admin';
import { commentResolvers } from './comment';
import { crestResolvers } from './crest';
import { dashboardResolvers } from './dashboard';
import { factResolvers } from './fact';
import { familyResolvers } from './family';
import { gedcomResolvers } from './gedcom';
import { life_eventResolvers } from './life_event';
import { mediaResolvers } from './media';
import { personResolvers } from './person';
import { searchResolvers } from './search';
import { sourceResolvers } from './source';
import { treeResolvers } from './tree';

export { clearQueryCache } from './helpers';

// Merge all domain-specific resolvers into a single resolvers object
export const resolvers = merge(
  {},
  personResolvers,
  searchResolvers,
  familyResolvers,
  treeResolvers,
  sourceResolvers,
  factResolvers,
  life_eventResolvers,
  mediaResolvers,
  commentResolvers,
  crestResolvers,
  adminResolvers,
  dashboardResolvers,
  gedcomResolvers,
);
