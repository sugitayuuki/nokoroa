# Nokoroa Backend - Claude Instructions

## Project Overview
This is the backend service for Nokoroa, a social platform for sharing travel experiences and recommendations.

## Tech Stack
- **Framework**: NestJS
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT
- **Container**: Docker
- **Deployment**: AWS ECS Fargate

## Development Commands

### Start Development Server
```bash
docker-compose up -d
npm run start:dev
```

### Database Management
```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Open Prisma Studio
npx prisma studio
```

### Testing & Linting
```bash
# Run tests
npm run test

# Run e2e tests
npm run test:e2e

# Run linter
npm run lint

# Fix lint errors
npm run lint -- --fix
```

## API Endpoints

### Authentication
- POST `/auth/register` - User registration
- POST `/auth/login` - User login

### Posts
- GET `/posts` - Get all posts (with pagination)
- GET `/posts/:id` - Get post by ID
- POST `/posts` - Create new post (requires auth)
- PUT `/posts/:id` - Update post (requires auth, owner only)
- DELETE `/posts/:id` - Delete post (requires auth, owner only)

### Users
- GET `/users/profile` - Get current user profile (requires auth)
- GET `/users/:id` - Get user by ID
- PUT `/users/profile` - Update profile (requires auth)

### Follows
- POST `/follows/:userId` - Follow a user (requires auth)
- DELETE `/follows/:userId` - Unfollow a user (requires auth)
- GET `/follows/:userId/status` - Check follow status
- GET `/users/:userId/followers` - Get user's followers
- GET `/users/:userId/following` - Get users that user follows

### Favorites (Bookmarks)
- POST `/favorites/:postId` - Bookmark a post (requires auth)
- DELETE `/favorites/:postId` - Remove bookmark (requires auth)
- GET `/favorites` - Get user's bookmarks (requires auth)

### Search
- GET `/search` - Search posts by tags, location, or keyword

## Environment Variables
```env
DATABASE_URL="postgresql://user:password@localhost:5432/nokoroa"
JWT_SECRET="your-jwt-secret"
AWS_REGION="ap-northeast-1"
AWS_ACCESS_KEY_ID="your-aws-access-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret-key"
S3_BUCKET_NAME="your-s3-bucket"
```

## Database Schema
- **User**: User accounts with profile information
- **Post**: Travel posts with images, location, and tags
- **Follow**: User following relationships
- **Favorite**: Bookmarked posts
- **Comment**: Comments on posts (if implemented)

## Important Notes
- Always run migrations after schema changes
- Use DTOs for request/response validation
- Implement proper error handling with NestJS exception filters
- Keep authentication guards on protected routes
- Use Prisma's include feature for related data
- Follow RESTful API conventions

## Common Issues & Solutions

### Port Already in Use
```bash
# Check what's using port 4000
lsof -i :4000
# Kill the process if needed
kill -9 <PID>
```

### Docker Issues
```bash
# Rebuild containers
docker-compose down
docker-compose up -d --build
```

### Prisma Client Out of Sync
```bash
npx prisma generate
npm run start:dev
```

## Deployment
The application is configured for AWS ECS deployment with:
- ECS Fargate for container hosting
- RDS for PostgreSQL database
- S3 for image storage
- ALB for load balancing
- CloudWatch for logging

Deployment is managed through Terraform (see `/terraform` directory).