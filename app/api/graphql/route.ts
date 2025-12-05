import { ApolloServer } from '@apollo/server';
import { startServerAndCreateNextHandler } from '@as-integrations/next';
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { typeDefs } from '@/lib/graphql/schema';
import { resolvers } from '@/lib/graphql/resolvers';

// Create Apollo Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true, // Enable GraphQL Playground in development
});

// Create handler with context from NextAuth session
const handler = startServerAndCreateNextHandler<NextRequest>(server, {
  context: async (req) => {
    // Get session from NextAuth
    const session = await auth();
    
    // Return context with user info if authenticated
    if (session?.user) {
      return {
        user: {
          id: (session.user as { id?: string }).id || '',
          email: session.user.email || '',
          role: (session.user as { role?: string }).role || 'viewer',
        },
      };
    }
    
    // No authentication - queries still work, mutations will fail
    return {};
  },
});

// Export handlers for Next.js App Router
export async function GET(request: NextRequest) {
  return handler(request);
}

export async function POST(request: NextRequest) {
  return handler(request);
}

