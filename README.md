# OMMA Frontend - Consultation Room Rental System

Angular frontend application for the OMMA consultation room rental system. This application provides interfaces for administrators and professionals to manage spaces, reservations, credits, and user accounts.

## Features

### Admin Features
- **User Management**: Create professional accounts and manage user data
- **Space Management**: Create consultation spaces and manage schedules
- **Credits Management**: Assign credits to professionals and track usage
- **Reservation Management**: Approve/reject pending reservations
- **Dashboard**: Overview of system statistics and quick access to management tools

### Professional Features
- **Dashboard**: View credits, upcoming reservations, and profile information
- **Space Booking**: Reserve consultation spaces with credit validation
- **Reservation Management**: View and cancel reservations (with penalty system)
- **Profile Management**: Update professional information and specialty

### Public Features
- **Professional Directory**: Browse available professionals by specialty with search and filter

## System Requirements

- Node.js 18+ 
- Angular CLI 19+
- Backend API running on configured endpoint

## Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
   - Update `src/environments/environment.ts` for development
   - Update `src/environments/environment.prod.ts` for production
   - Set the correct `apiUrl` pointing to your backend server

## Development

Start the development server:
```bash
ng serve
```

Navigate to `http://localhost:4200/` to access the application.

## Building

Build for production:
```bash
ng build --configuration production
```

## Authentication

The application uses JWT token-based authentication:
- Tokens are stored in localStorage
- HTTP interceptor automatically adds Authorization headers
- Route guards protect admin and professional areas

## User Roles

- **Admin**: Full system access, can manage users, spaces, credits, and reservations
- **Professional**: Can book spaces, manage reservations, and view credits

## Credit System

- Credits are used to reserve consultation spaces
- 6 credits = 1 hour of consultation time
- Cancellations within 24 hours incur a 2-credit penalty
- Only professionals with active credits appear in the public directory

## API Integration

The frontend integrates with the OMMA backend API with endpoints for:
- Authentication (`/auth/login`)
- Admin operations (`/admin/*`)
- Professional operations (`/reservations`, `/credits`, `/spaces`)
- Public directory (`/professionals`)

## Deployment

For production deployment:
1. Update `environment.prod.ts` with your production API URL
2. Build the application: `ng build --configuration production`
3. Deploy the `dist/` folder to your web server
4. Ensure your backend API is accessible from the production domain

## Technology Stack

- **Angular 20**: Frontend framework with standalone components
- **Tailwind CSS**: Utility-first CSS framework for styling
- **TypeScript**: Type-safe JavaScript development
- **RxJS**: Reactive programming for HTTP requests and state management
