export const useRouter = jest.fn(() => ({
  push: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn(),
  back: jest.fn(),
}));

export const useSearchParams = jest.fn(() => new URLSearchParams());
export const usePathname = jest.fn(() => '/');
export const useParams = jest.fn(() => ({}));
export const redirect = jest.fn();
export const notFound = jest.fn();

