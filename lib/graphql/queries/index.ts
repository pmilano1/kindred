// =====================================================
// GraphQL Queries - Modular Re-exports
// =====================================================
// This file re-exports all queries and mutations from modular files
// for backward compatibility with existing imports.

// Admin queries and mutations
export {
  CREATE_INVITATION,
  CREATE_LOCAL_USER,
  CREATE_SERVICE_ACCOUNT,
  DELETE_INVITATION,
  DELETE_USER,
  GENERATE_API_KEY,
  GET_INVITATIONS,
  GET_ME,
  GET_USERS,
  LINK_USER_TO_PERSON,
  REVOKE_API_KEY,
  REVOKE_SERVICE_ACCOUNT,
  SET_MY_PERSON,
  UPDATE_USER_ROLE,
} from './admin';
// Crest queries and mutations
export {
  GET_SURNAME_CREST,
  GET_SURNAME_CRESTS,
  REMOVE_PERSON_COAT_OF_ARMS,
  REMOVE_SURNAME_CREST,
  SET_PERSON_COAT_OF_ARMS,
  SET_SURNAME_CREST,
  UPDATE_SURNAME_CREST,
} from './crest';
// Dashboard and stats queries
export {
  GET_DASHBOARD,
  GET_RESEARCH_QUEUE,
  GET_STATS,
  GET_TIMELINE,
} from './dashboard';
// Family queries and mutations
export {
  ADD_CHILD,
  ADD_CHILD_TO_FAMILY,
  ADD_SPOUSE,
  CHECK_DUPLICATES,
  CREATE_AND_ADD_CHILD,
  CREATE_AND_ADD_SPOUSE,
  CREATE_FAMILY,
  DELETE_FAMILY,
  GET_FAMILIES,
  REMOVE_CHILD,
  REMOVE_CHILD_FROM_FAMILY,
  REMOVE_SPOUSE,
  UPDATE_FAMILY,
} from './family';
// Fragments
export {
  MEDIA_FIELDS,
  PERSON_BASIC_FIELDS,
  PERSON_CARD_FIELDS,
  PERSON_FULL_FIELDS,
  PERSON_SEARCH_FIELDS,
  SOURCE_FIELDS,
} from './fragments';
// Media mutations
export { DELETE_MEDIA, UPDATE_MEDIA, UPLOAD_MEDIA } from './media';
// Person queries and mutations
export {
  ADD_FACT,
  ADD_LIFE_EVENT,
  CREATE_PERSON,
  DELETE_FACT,
  DELETE_LIFE_EVENT,
  DELETE_PERSON,
  GET_NOTABLE_PEOPLE,
  GET_PEOPLE,
  GET_PEOPLE_LIST,
  GET_PERSON,
  GET_PERSON_SOURCES,
  GET_RECENT_PEOPLE,
  SEARCH_PEOPLE,
  UPDATE_FACT,
  UPDATE_LIFE_EVENT,
  UPDATE_NOTABLE_STATUS,
  UPDATE_PERSON,
} from './person';
// Settings and GEDCOM
export { EXPORT_GEDCOM, GET_SITE_SETTINGS, IMPORT_GEDCOM } from './settings';
// Source mutations
export {
  ADD_SOURCE,
  DELETE_SOURCE,
  UPDATE_RESEARCH_PRIORITY,
  UPDATE_RESEARCH_STATUS,
  UPDATE_SOURCE,
} from './source';
// Tree queries
export { GET_ANCESTORS, GET_DESCENDANTS } from './tree';
