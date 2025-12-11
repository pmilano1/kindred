'use client';

import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client/core';
import { ApolloProvider } from '@apollo/client/react';
import { SessionProvider } from 'next-auth/react';
import { useMemo } from 'react';
import { ServiceWorkerRegistration } from './ServiceWorkerRegistration';
import { SettingsProvider, type SiteSettings } from './SettingsProvider';
import { SidebarProvider } from './SidebarContext';

// Dev-only: Mock session when SKIP_AUTH=true (only works in development)
const SKIP_AUTH =
  process.env.NEXT_PUBLIC_SKIP_AUTH === 'true' &&
  process.env.NODE_ENV === 'development';

const mockSession = SKIP_AUTH
  ? {
      user: {
        id: 'dev-admin',
        email: 'dev@localhost',
        name: 'Dev Admin',
        role: 'admin',
      },
      expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    }
  : undefined;

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
    <SessionProvider
      session={mockSession}
      refetchOnWindowFocus={false}
      refetchInterval={0}
    >
      <ApolloWrapper>
        <SettingsProvider settings={settings}>
          <SidebarProvider>
            {children}
            <ServiceWorkerRegistration />
          </SidebarProvider>
        </SettingsProvider>
      </ApolloWrapper>
    </SessionProvider>
  );
}
