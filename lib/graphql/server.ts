/**
 * Server-side GraphQL execution for Next.js Server Components
 * This allows server components to query GraphQL without HTTP overhead
 * When USE_LIVE_API=true, queries are proxied to the production API
 */

import { makeExecutableSchema } from '@graphql-tools/schema';
import { type DocumentNode, type GraphQLSchema, graphql, print } from 'graphql';
import { createLoaders } from './dataloaders';
import { resolvers } from './resolvers';
import { typeDefs } from './schema';

const USE_LIVE_API = process.env.USE_LIVE_API === 'true';
const GRAPHQL_PROXY_URL = process.env.GRAPHQL_PROXY_URL;
const GRAPHQL_PROXY_API_KEY = process.env.GRAPHQL_PROXY_API_KEY;

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
 * Execute a GraphQL query via proxy to production API
 */
async function executeViaProxy<T>(
  queryString: string,
  variables?: Record<string, unknown>,
): Promise<GraphQLResult<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (GRAPHQL_PROXY_API_KEY) {
    headers['X-API-Key'] = GRAPHQL_PROXY_API_KEY;
  }

  const response = await fetch(GRAPHQL_PROXY_URL ?? '', {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: queryString, variables }),
  });

  return response.json();
}

/**
 * Execute a GraphQL query on the server side (no HTTP)
 * For use in Server Components
 * When USE_LIVE_API=true, proxies to production API instead
 */
export async function executeQuery<T = Record<string, unknown>>(
  query: DocumentNode | string,
  variables?: Record<string, unknown>,
  user?: { id: string; email: string; role: string },
): Promise<GraphQLResult<T>> {
  const queryString = typeof query === 'string' ? query : print(query);

  // Use proxy for live API testing
  if (USE_LIVE_API && GRAPHQL_PROXY_URL) {
    return executeViaProxy<T>(queryString, variables);
  }

  const schema = getSchema();
  const loaders = createLoaders();

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
  user?: { id: string; email: string; role: string },
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
