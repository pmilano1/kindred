import { ApolloServer, BaseContext } from '@apollo/server';
import { startServerAndCreateNextHandler } from '@as-integrations/next';
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { pool } from '@/lib/db';
import { typeDefs } from '@/lib/graphql/schema';
import { resolvers } from '@/lib/graphql/resolvers';
import { createLoaders, Loaders } from '@/lib/graphql/dataloaders';
import depthLimit from 'graphql-depth-limit';
import { GraphQLError } from 'graphql';

// Context type for Apollo Server
interface Context extends BaseContext {
  user: { id: string; email: string; role: string };
  loaders: Loaders;
}

// Query limits
const MAX_DEPTH = 7;           // Max nesting (person -> children -> children -> ...)
const MAX_QUERY_SIZE = 10000;  // Max query string length

// Create Apollo Server with security plugins
const server = new ApolloServer<Context>({
  typeDefs,
  resolvers,
  introspection: process.env.NODE_ENV !== 'production',
  validationRules: [depthLimit(MAX_DEPTH)],
  plugins: [
    // Query logging and metrics
    {
      async requestDidStart() {
        const start = Date.now();
        return {
          async willSendResponse({ response, contextValue }) {
            const duration = Date.now() - start;
            const user = (contextValue as { user?: { email: string } }).user?.email || 'anonymous';
            console.log(`[GraphQL] ${user} - ${duration}ms - ${response.body.kind === 'single' ? (response.body.singleResult.errors ? 'ERROR' : 'OK') : 'BATCH'}`);
          },
          async didEncounterErrors({ errors }) {
            for (const err of errors) {
              console.error('[GraphQL Error]', err.message);
            }
          },
        };
      },
    },
    // Query complexity limiting
    {
      async requestDidStart() {
        return {
          async didResolveOperation({ request }) {
            // Simple complexity estimation based on query size
            const querySize = request.query?.length || 0;
            if (querySize > MAX_QUERY_SIZE) {
              throw new GraphQLError(`Query too complex: ${querySize} chars exceeds limit`, {
                extensions: { code: 'QUERY_TOO_COMPLEX' },
              });
            }
          },
        };
      },
    },
  ],
});

// Validate API key and return user info
async function validateApiKey(apiKey: string) {
  const result = await pool.query(
    'SELECT id, email, role FROM users WHERE api_key = $1',
    [apiKey]
  );
  return result.rows[0] || null;
}

// Create handler with context from NextAuth session or API key
const handler = startServerAndCreateNextHandler<NextRequest, Context>(server, {
  context: async (req) => {
    // Create fresh DataLoaders per request for batching
    const loaders = createLoaders();

    // Check for API key in header first
    const apiKey = req.headers.get('x-api-key');
    if (apiKey) {
      const user = await validateApiKey(apiKey);
      if (user) {
        return {
          user: { id: user.id, email: user.email, role: user.role },
          loaders,
        };
      }
      throw new Error('Invalid API key');
    }

    // Fall back to NextAuth session
    const session = await auth();
    if (!session?.user) {
      throw new Error('Authentication required');
    }

    return {
      user: {
        id: (session.user as { id?: string }).id || '',
        email: session.user.email || '',
        role: (session.user as { role?: string }).role || 'viewer',
      },
      loaders,
    };
  },
});

// Export handlers for Next.js App Router
export async function GET(request: NextRequest) {
  return handler(request);
}

export async function POST(request: NextRequest) {
  return handler(request);
}

