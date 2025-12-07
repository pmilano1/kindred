/**
 * Sidebar Component Tests
 */
import { render, screen } from '@testing-library/react';
import Sidebar from '@/components/Sidebar';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}));

// Mock next-auth/react
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
  signOut: jest.fn(),
}));

// Mock next/link
jest.mock('next/link', () => {
  return function MockLink({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) {
    return <a href={href} className={className}>{children}</a>;
  };
});

// Mock SettingsProvider
jest.mock('@/components/SettingsProvider', () => ({
  useSettings: jest.fn(() => ({
    site_name: 'Test Family Tree',
    family_name: 'Test Family',
    site_tagline: 'Preserving our heritage',
    theme_color: '#4F46E5',
    logo_url: null,
  })),
}));

// Mock SidebarContext
jest.mock('@/components/SidebarContext', () => ({
  useSidebar: jest.fn(() => ({
    isCollapsed: false,
    toggleCollapse: jest.fn(),
    setCollapsed: jest.fn(),
  })),
}));

import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useSettings } from '@/components/SettingsProvider';

const mockedUsePathname = usePathname as jest.Mock;
const mockedUseSession = useSession as jest.Mock;
const mockedUseSettings = useSettings as jest.Mock;

describe('Sidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseSettings.mockReturnValue({
      site_name: 'Test Family Tree',
      family_name: 'Test Family',
      site_tagline: 'Preserving our heritage',
      theme_color: '#4F46E5',
      logo_url: null,
    });
  });

  describe('when unauthenticated', () => {
    it('returns null', () => {
      mockedUsePathname.mockReturnValue('/');
      mockedUseSession.mockReturnValue({ data: null, status: 'unauthenticated' });

      const { container } = render(<Sidebar />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('when on login page', () => {
    it('returns null', () => {
      mockedUsePathname.mockReturnValue('/login');
      mockedUseSession.mockReturnValue({ 
        data: { user: { name: 'Test', email: 'test@test.com', role: 'viewer' } }, 
        status: 'authenticated' 
      });

      const { container } = render(<Sidebar />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('when authenticated', () => {
    beforeEach(() => {
      mockedUsePathname.mockReturnValue('/');
      mockedUseSession.mockReturnValue({
        data: { user: { name: 'Test User', email: 'test@test.com', role: 'viewer' } },
        status: 'authenticated',
      });
    });

    it('renders sidebar with family name from settings', () => {
      render(<Sidebar />);
      expect(screen.getByText('Test Family')).toBeInTheDocument();
    });

    it('renders sidebar with tagline from settings', () => {
      render(<Sidebar />);
      expect(screen.getByText('Preserving our heritage')).toBeInTheDocument();
    });

    it('renders all navigation items', () => {
      render(<Sidebar />);

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Family Tree')).toBeInTheDocument();
      expect(screen.getByText('People')).toBeInTheDocument();
      expect(screen.getByText('Research Queue')).toBeInTheDocument();
      expect(screen.getByText('Timeline')).toBeInTheDocument();
      expect(screen.getByText('Coats of Arms')).toBeInTheDocument();
      // Search moved to PageHeader global search bar
    });

    it('marks active nav item based on pathname', () => {
      mockedUsePathname.mockReturnValue('/tree');
      render(<Sidebar />);
      
      const treeLink = screen.getByRole('link', { name: /Family Tree/i });
      expect(treeLink).toHaveClass('active');
    });

    it('shows user name and email', () => {
      render(<Sidebar />);
      
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('test@test.com')).toBeInTheDocument();
    });

    it('shows Sign Out button', () => {
      render(<Sidebar />);
      expect(screen.getByText('Sign Out')).toBeInTheDocument();
    });

    it('does not show Admin link for non-admin users', () => {
      render(<Sidebar />);
      expect(screen.queryByText('Admin')).not.toBeInTheDocument();
    });
  });

  describe('when authenticated as admin', () => {
    beforeEach(() => {
      mockedUsePathname.mockReturnValue('/');
      mockedUseSession.mockReturnValue({
        data: { user: { name: 'Admin User', email: 'admin@test.com', role: 'admin' } },
        status: 'authenticated',
      });
    });

    it('shows Admin link for admin users', () => {
      render(<Sidebar />);
      expect(screen.getByText('Admin')).toBeInTheDocument();
    });

    it('Admin link has correct href', () => {
      render(<Sidebar />);
      const adminLink = screen.getByRole('link', { name: /Admin/i });
      expect(adminLink).toHaveAttribute('href', '/admin');
    });
  });

  describe('when loading', () => {
    it('shows loading state while session is loading', () => {
      mockedUsePathname.mockReturnValue('/');
      mockedUseSession.mockReturnValue({ data: null, status: 'loading' });

      render(<Sidebar />);
      
      // Should show loading skeleton (animate-pulse div)
      const loadingDiv = document.querySelector('.animate-pulse');
      expect(loadingDiv).toBeInTheDocument();
    });
  });

  describe('with custom logo', () => {
    it('renders logo image when logo_url is set', () => {
      mockedUsePathname.mockReturnValue('/');
      mockedUseSession.mockReturnValue({
        data: { user: { name: 'Test', email: 'test@test.com', role: 'viewer' } },
        status: 'authenticated',
      });
      mockedUseSettings.mockReturnValue({
        site_name: 'Test',
        family_name: 'Test Family',
        site_tagline: 'Test',
        theme_color: '#000',
        logo_url: 'https://example.com/logo.png',
      });

      render(<Sidebar />);
      
      const logo = screen.getByAltText('Logo');
      expect(logo).toHaveAttribute('src', 'https://example.com/logo.png');
    });
  });
});

