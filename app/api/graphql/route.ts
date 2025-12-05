import { ApolloServer } from '@apollo/server';
import { startServerAndCreateNextHandler } from '@as-integrations/next';
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { pool } from '@/lib/db';
import { typeDefs } from '@/lib/graphql/schema';
import { resolvers } from '@/lib/graphql/resolvers';

// Create Apollo Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true, // Enable GraphQL Playground in development
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
const handler = startServerAndCreateNextHandler<NextRequest>(server, {
  context: async (req) => {
    // Check for API key in header first
    const apiKey = req.headers.get('x-api-key');
    if (apiKey) {
      const user = await validateApiKey(apiKey);
      if (user) {
        return {
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
          },
        };
      }
      throw new Error('Invalid API key');
    }

    // Fall back to NextAuth session
    const session = await auth();

    // Require authentication for all operations
    if (!session?.user) {
      throw new Error('Authentication required');
    }

    return {
      user: {
        id: (session.user as { id?: string }).id || '',
        email: session.user.email || '',
        role: (session.user as { role?: string }).role || 'viewer',
      },
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

