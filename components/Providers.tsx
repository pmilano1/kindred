'use client';

import { SessionProvider } from 'next-auth/react';
import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client/core';
import { ApolloProvider } from '@apollo/client/react';
import { useMemo } from 'react';

function ApolloWrapper({ children }: { children: React.ReactNode }) {
  const client = useMemo(() => {
    const httpLink = new HttpLink({
      uri: '/api/graphql',
      credentials: 'same-origin', // Send cookies with requests for auth
      fetchOptions: { cache: 'no-store' },
    });

    return new ApolloClient({
      link: httpLink,
      cache: new InMemoryCache({
        typePolicies: {
          Person: {
            keyFields: ['id'],
          },
          Source: {
            keyFields: ['id'],
          },
        },
      }),
      defaultOptions: {
        watchQuery: {
          fetchPolicy: 'cache-and-network',
        },
      },
    });
  }, []);

  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ApolloWrapper>{children}</ApolloWrapper>
    </SessionProvider>
  );
}

