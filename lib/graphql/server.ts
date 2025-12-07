/**
 * Server-side GraphQL execution for Next.js Server Components
 * This allows server components to query GraphQL without HTTP overhead
 */

import { graphql, GraphQLSchema, print, DocumentNode } from 'graphql';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { typeDefs } from './schema';
import { resolvers } from './resolvers';
import { createLoaders } from './dataloaders';

// Build the executable schema once
let executableSchema: GraphQLSchema | null = null;

function getSchema(): GraphQLSchema {
  if (!executableSchema) {
    executableSchema = makeExecutableSchema({
      typeDefs,
      resolvers,
    });
  }
  return executableSchema;
}

export interface GraphQLResult<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

/**
 * Execute a GraphQL query on the server side (no HTTP)
 * For use in Server Components
 */
export async function executeQuery<T = Record<string, unknown>>(
  query: DocumentNode | string,
  variables?: Record<string, unknown>,
  user?: { id: string; email: string; role: string }
): Promise<GraphQLResult<T>> {
  const schema = getSchema();
  const loaders = createLoaders();
  
  const queryString = typeof query === 'string' ? query : print(query);
  
  const result = await graphql({
    schema,
    source: queryString,
    variableValues: variables,
    contextValue: { user, loaders },
  });
  
  return result as GraphQLResult<T>;
}

/**
 * Execute a GraphQL query and return just the data (throws on error)
 */
export async function query<T = Record<string, unknown>>(
  queryDoc: DocumentNode | string,
  variables?: Record<string, unknown>,
  user?: { id: string; email: string; role: string }
): Promise<T> {
  const result = await executeQuery<T>(queryDoc, variables, user);
  
  if (result.errors && result.errors.length > 0) {
    throw new Error(result.errors[0].message);
  }
  
  if (!result.data) {
    throw new Error('No data returned from GraphQL query');
  }
  
  return result.data;
}

