# Nokoroa Frontend - Claude Instructions

## Project Overview
This is the frontend application for Nokoroa, a social platform for sharing travel experiences and recommendations.

## Tech Stack
- **Framework**: Next.js 15.3.1 with App Router
- **Language**: TypeScript
- **UI Library**: Material-UI (MUI) v7
- **React**: Version 19
- **State Management**: React Context API
- **Styling**: Material-UI's sx prop and theme system
- **HTTP Client**: Fetch API
- **Date Formatting**: date-fns

## Development Commands

### Start Development Server
```bash
npm run dev
# Server runs on http://localhost:3000
```

### Build & Production
```bash
# Build for production
npm run build

# Start production server
npm run start
```

### Testing & Linting
```bash
# Run linter
npm run lint

# Fix lint errors automatically
npm run lint -- --fix

# Type checking
npm run typecheck
```

## Project Structure
```
src/
├── app/                    # Next.js app router pages
│   ├── page.tsx           # Home page
│   ├── posts/             # Post-related pages
│   ├── users/             # User profile pages
│   ├── profile/           # Current user profile
│   ├── search/            # Search page
│   ├── bookmarks/         # Bookmarks page
│   └── my-posts/          # User's own posts
├── components/            # Reusable components
│   ├── post/             # Post-related components
│   ├── search/           # Search components
│   └── bookmarks/        # Bookmark components
├── hooks/                # Custom React hooks
├── lib/                  # Utility functions and API clients
├── providers/            # React Context providers
├── types/                # TypeScript type definitions
└── utils/                # Helper functions
```

## Key Features & Pages

### Authentication
- Login page (`/login`)
- Signup page (`/signup`)
- JWT is stored in an httpOnly cookie (`nokoroa_token`) issued by the backend.
  The frontend never reads or stores the token.
- Auth context provider for global auth state (`providers/AuthProvider.tsx`)
- Logout calls `POST /api/auth/logout` (only the server can clear an httpOnly cookie)

### Posts
- Home feed (`/`) - Shows all public posts
- Post detail (`/posts/[id]`) - Individual post view
- Create post (`/posts/create`) - New post form
- Edit post (`/posts/[id]/edit`) - Edit existing post
- My posts (`/my-posts`) - User's own posts

### User Features
- User profile (`/users/[id]`) - View other users' profiles
- Profile edit (`/profile/edit`) - Edit own profile
- Following/Followers lists
- Follow/Unfollow functionality

### Search & Discovery
- Search page (`/search`) - Search by tags, location, or keywords
- Tag-based filtering
- Location-based search

### Bookmarks
- Bookmarks page (`/bookmarks`) - Saved posts
- Bookmark button on all posts

## Component Patterns

### API Calls
Always go through `createApiRequest` (or spread `API_FETCH_OPTIONS`) so the
auth cookie is sent. A plain `fetch` without `credentials: 'include'` is treated
as unauthenticated, and that failure shows up as a 401 or as "only public data
is returned" — never as an obvious missing-header error.

```typescript
import { API_CONFIG, createApiRequest } from '@/lib/apiConfig';

const response = await createApiRequest(API_CONFIG.endpoints.posts, {
  method: 'POST',
  body: JSON.stringify(payload),
});
```

When a raw `fetch` is unavoidable (e.g. an SWR fetcher that receives a full URL):

```typescript
import { API_FETCH_OPTIONS } from '@/lib/apiConfig';

const response = await fetch(url, API_FETCH_OPTIONS);
```

Never read the token from `localStorage` — it is not there (and must not be put
there). To branch on login state, use `useAuth()` inside React, or handle the
API's 401 outside React.

### Error Handling
- Always check response.ok before parsing
- Show user-friendly error messages with toast
- Handle 401 errors by redirecting to login

### Tag Colors
- Use `getTagColor` from `utils/tagColors` for consistent tag coloring
- Tags always display the same color across the app

## Environment Variables
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## Styling Guidelines
- Use Material-UI components and sx prop
- Follow Material Design principles
- Responsive design with breakpoints (xs, sm, md, lg, xl)
- Consistent spacing using theme.spacing()
- Color palette from theme

## Common Patterns

### Protected Routes
```typescript
const { isAuthenticated, loading } = useAuth();
if (!loading && !isAuthenticated) {
  router.push('/login');
}
```

### Infinite Scroll
Use the `useInfiniteScroll` hook for paginated lists

### Form Handling
- Use controlled components with useState
- Validate on submit
- Show loading states during submission
- Display success/error messages

## Important Notes
- Always handle onClick for Chip components (even if just preventing default)
- Use router.push() for navigation, not window.location
- Implement proper loading states for better UX
- Use React.useCallback for expensive computations
- Memoize components when necessary with React.memo
- Follow Next.js best practices for performance

## Common Issues & Solutions

### onClick is not a function
- All Chip components need an onClick handler, even if empty:
```tsx
onClick={(e) => {
  e.preventDefault();
  e.stopPropagation();
}}
```

### Authentication Errors
- Check that the request went through `createApiRequest` / `API_FETCH_OPTIONS`
  (a missing `credentials: 'include'` looks exactly like "not logged in")
- Check the `nokoroa_token` cookie in DevTools > Application > Cookies.
  It is httpOnly, so `document.cookie` will not show it
- In development, `NODE_ENV` must be `development`; otherwise the backend sets
  `Secure` and the browser silently drops the cookie over http
- Verify API_URL is correct
- Handle 401 errors gracefully

### CORS Issues
- Ensure backend allows frontend origin
- Check API_URL doesn't have trailing slash

## Deployment
- Build optimized production bundle with `npm run build`
- Deploy to Vercel, Netlify, or AWS Amplify
- Set environment variables in deployment platform
- Use proper domain and HTTPS in production