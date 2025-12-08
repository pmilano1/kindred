'use client';

import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client/core';
import { ApolloProvider } from '@apollo/client/react';
import { SessionProvider } from 'next-auth/react';
import { useMemo } from 'react';
import { SettingsProvider, type SiteSettings } from './SettingsProvider';
import { SidebarProvider } from './SidebarContext';

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

interface ProvidersProps {
  children: React.ReactNode;
  settings?: SiteSettings;
}

export function Providers({ children, settings }: ProvidersProps) {
  return (
    <SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
      <ApolloWrapper>
        <SettingsProvider settings={settings}>
          <SidebarProvider>{children}</SidebarProvider>
        </SettingsProvider>
      </ApolloWrapper>
    </SessionProvider>
  );
}
