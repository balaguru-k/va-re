# VA Rewamp - CownKore Application

A comprehensive full-stack audit management system built with Node.js, Express, React, and MySQL for video analytics audit processes.

## Tech Stack

- **Backend**: Node.js, Express.js, MySQL, Knex.js (Query Builder with Eloquent-like Models)
- **Frontend**: React 18, Tailwind CSS, React Router v6, Axios
- **Authentication**: JWT with role-based access control
- **File Upload**: Multer with image processing
- **Testing**: Jest (Backend), React Testing Library (Frontend), Playwright (E2E)
- **Database**: MySQL 8.0+ with migrations and seeders

## Core Features

- **Multi-Role Authentication System** (5 distinct user roles)
- **Dynamic Checklist Management** with real-time form building
- **Image Upload & Management** for audit evidence
- **Roster Assignment System** for audit scheduling
- **Dashboard Analytics** with role-based data visualization
- **Comprehensive Audit Workflow** from assignment to completion
- **Camera Count Validation** with automated calculations
- **Responsive Design** optimized for desktop and mobile devices

## Complete Project Workflow

### **Phase 1: System Setup & User Management**
1. **Super Admin Login** → Access admin roster
2. **Create Users** → Assign roles (Auditor, Supervisor, Lead-Auditor, Reviewer)
3. **Roster Assignment** → Schedule audits and assign to users

### **Phase 2: Audit Execution**
1. **User Login** → Role-based dashboard access
2. **Pending Assignments** → View assigned checklists
3. **Checklist Form** → Fill audit details with:
   - Camera count validation
   - Status selection (Yes/No/NA)
   - Category assignment for "No" items
   - Image upload for evidence
   - Additional fields (location, department, etc.)
4. **Save/Complete** → Submit audit for review

### **Phase 3: Review & Monitoring**
1. **Supervisor Review** → Access completed checklists
2. **Status Tracking** → Monitor audit progress
3. **Data Analysis** → Generate reports and insights

### **Super Admin Roster Assignment System (CRITICAL)**
**Super Admin has TWO types of roster management:**

#### **Type 1: Checklist Management (/checklists)**
- Create and manage checklist templates
- Define checklist structure and items
- Set checklist categories and validation rules
- Configure audit parameters

#### **Type 2: User Assignment (/roster)**
- **Assign Button Logic**: Dropdown-based assignment system
- **Location-Based Assignment**: Filter users by location access
- **Name/Department Assignment**: Assign based on facility and department
- **Multi-Role Assignment**: Single checklist can have multiple assigned users:
  - **Auditor** (Required): Primary person filling the checklist
  - **Supervisor** (Optional): Review and approve/reject submissions
  - **Reviewer** (Optional): Final validation and assessment
  - **Responsible Person** (Optional): Additional oversight role

#### **Assignment Model Logic:**
```sql
rosters Table:
- auditor_id (Required) → Primary checklist executor
- supervisor_id (Optional) → Review and approval authority
- reviewer_id (Optional) → Final assessment role
- responsible_person_id (Optional) → Additional oversight
- checklist_id → Links to specific checklist template
- assigned_date → When assignment was created
- location/department filters → Scope-based assignment
```

### **Supervisor User Assignment Flow (CRITICAL)**
**The Supervisor role has TWO distinct access patterns:**

#### **Pattern A: Review-Only Supervisor**
- Dashboard → "Completed Checklists" → supervisor-checklist-data
- **Purpose**: Monitor and review completed audits
- **Access**: Read-only checklist data with status tracking
- **Status Scope**: 'Awaiting for NC response', 'Accepted by Supervisor', 'Completed by Supervisor'

#### **Pattern B: Form-Filling Supervisor**
- Dashboard → "Pending Checklists" → supervisor-checklist/{id}/form
- **Purpose**: Execute audits like an Auditor
- **Access**: Full checklist form with edit capabilities
- **Status Scope**: Draft, New assignments, Rejected items

**This dual-access pattern ensures supervisors can both execute and oversee audits based on their assignment type.**

## User Roles & Workflow

### 1. **Super Admin** (Role ID: 1)
- **Primary Functions**: Complete system administration
- **Access Level**: Full system access
- **Key Responsibilities**:
  - User management (Create, Read, Update, Delete)
  - Admin roster management and assignment
  - System configuration and oversight
  - Access to all reports and analytics
- **Dashboard**: Admin roster management interface
- **Default Login**: admin@varewamp.com / admin123

### 2. **Auditor** (Role ID: 2)
- **Primary Functions**: Field audit execution
- **Access Level**: Checklist creation and completion
- **Key Responsibilities**:
  - Fill out assigned checklist forms
  - Upload audit evidence (images)
  - Complete camera count validations
  - Submit completed audits for review
- **Dashboard**: Pending and completed checklists view
- **Workflow**: Dashboard → Checklist Form → Complete Audit
- **Status Progression**:
  - **Pending**: New assignments, Draft status, Rejected by Supervisor
  - **Completed**: 'Awaiting for NC response', 'Accepted by Supervisor', 'Completed'
- **Assignment Logic**: `rosters.auditor_id = user.id`

### 3. **Supervisor** (Role ID: 3) - **DUAL ACCESS TYPE**
- **Type A - Review Access**:
  - Review completed checklists
  - Access supervisor-checklist-data page
  - Monitor audit completion status
  - **Status Scope**: 'Awaiting for NC response' (new submissions)
- **Type B - Form Access**:
  - Fill checklist forms (same as Auditor)
  - Access supervisor-checklist/form pages
  - Complete audit assignments
  - **Status Scope**: Draft, New, Rejected items
- **Dashboard**: Role-specific pending/completed views
- **Workflow**: Dashboard → Review Data OR Fill Forms
- **Status Progression**:
  - **Pending Review**: 'Awaiting for NC response' (not yet reviewed)
  - **Action Required**: 'Rejected by Supervisor' (needs re-work)
  - **Completed**: 'Accepted by Supervisor', 'Completed by Supervisor'
- **Assignment Logic**: `rosters.supervisor_id = user.id`

### 4. **Lead-Auditor** (Role ID: 5)
- **Primary Functions**: Advanced audit management
- **Access Level**: Auditor capabilities + admin management
- **Key Responsibilities**:
  - All auditor functions
  - Team oversight and coordination
  - Advanced reporting access
- **Dashboard**: Enhanced auditor dashboard with management tools
- **Status Progression**: Same as Auditor + management oversight
- **Assignment Logic**: Can be assigned as `auditor_id` or `responsible_person_id`

### 5. **Reviewer** (Role ID: 4)
- **Primary Functions**: Audit assessment and validation
- **Access Level**: Review and assessment capabilities
- **Key Responsibilities**:
  - Review completed audits
  - Validate audit findings
  - Provide feedback and recommendations
- **Dashboard**: Review-focused interface
- **Status Progression**:
  - **Pending Review**: 'Accepted by Supervisor' (ready for final review)
  - **Completed**: 'Completed', 'Completed without NCs'
- **Assignment Logic**: `rosters.reviewer_id = user.id`
- **Workflow**: Only sees checklists after supervisor approval

## Project Structure

```
va-re/
├── server/                    # Backend API (Node.js + Express)
│   ├── config/               # Database configuration
│   │   └── database.js       # MySQL connection setup
│   ├── controllers/          # Business logic controllers
│   │   ├── authController.js # Authentication & authorization
│   │   ├── userController.js # User management
│   │   ├── checklistController.js # Checklist operations
│   │   ├── rosterController.js    # Roster management
│   │   └── adminRosterController.js # Admin roster functions
│   ├── middleware/           # Custom middleware
│   │   ├── auth.js          # JWT authentication
│   │   ├── dynamicAuth.js   # Role-based access control
│   │   ├── upload.js        # File upload handling
│   │   └── validation.js    # Input validation
│   ├── models/              # Database models (Eloquent-like)
│   │   ├── BaseModel.js     # Base model with common methods
│   │   ├── User.js          # User model
│   │   ├── Role.js          # Role model
│   │   ├── Checklist.js     # Checklist model
│   │   ├── ChecklistData.js # Completed checklist data
│   │   ├── ChecklistItem.js # Individual checklist items
│   │   ├── ChecklistAssignment.js # Roster assignments
│   │   ├── Category.js      # Audit categories
│   │   ├── Location.js      # Location master
│   │   ├── Department.js    # Department master
│   │   ├── Name.js          # Name master
│   │   └── Roster.js        # Roster model
│   ├── routes/              # API route definitions
│   │   ├── auth.js          # Authentication routes
│   │   ├── users.js         # User management routes
│   │   ├── checklists.js    # Checklist routes
│   │   └── rosters.js       # Roster routes
│   ├── database/            # Database management
│   │   ├── migrations/      # Database schema migrations
│   │   └── seeds/           # Initial data seeders
│   ├── uploads/             # File storage
│   │   ├── images/          # Audit evidence images
│   │   └── checklists/      # Checklist attachments
│   ├── utils/               # Utility functions
│   │   ├── responseHelper.js # API response formatting
│   │   ├── userService.js   # User-related utilities
│   │   └── debugLogger.js   # Debug logging
│   └── tests/               # Backend tests
│       ├── unit/            # Unit tests
│       └── integration/     # Integration tests
├── client/                   # React Frontend
│   ├── src/
│   │   ├── components/      # Reusable React components
│   │   │   ├── UI/          # UI components (buttons, forms, etc.)
│   │   │   ├── Layout/      # Layout components
│   │   │   └── Common/      # Common components
│   │   ├── pages/           # Page components
│   │   │   ├── Dashboard.js # Role-based dashboard
│   │   │   ├── ChecklistForm.js # Dynamic checklist form
│   │   │   ├── ChecklistData.js # Completed checklists view
│   │   │   ├── Login.js     # Authentication page
│   │   │   ├── Users.js     # User management (Super Admin)
│   │   │   └── AdminRoster.js # Roster management
│   │   ├── contexts/        # React Context providers
│   │   │   └── AuthContext.js # Authentication state
│   │   ├── services/        # API service layer
│   │   │   └── api.js       # Axios-based API calls
│   │   ├── hooks/           # Custom React hooks
│   │   │   ├── useApi.js    # API call hook
│   │   │   └── useSearch.js # Search functionality
│   │   ├── constants/       # Application constants
│   │   │   ├── routes.js    # Route definitions
│   │   │   ├── roles.js     # Role constants
│   │   │   └── messages.js  # UI messages
│   │   ├── utils/           # Utility functions
│   │   │   └── navigation.js # Navigation helpers
│   │   └── __tests__/       # Frontend tests
│   ├── public/              # Static assets
│   └── package.json         # Frontend dependencies
└── e2e-tests/               # End-to-end tests
    ├── tests/               # Playwright test files
    └── playwright.config.js # E2E test configuration
```

## Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- MySQL (v8.0 or higher)
- npm or yarn

### Installation

1. **Clone and install dependencies:**
   ```bash
   cd va-re
   npm run setup
   ```

2. **Database Setup:**
   ```bash
   # Create MySQL database
   mysql -u root -p
   CREATE DATABASE va_rewamp;
   exit
   
   # Copy environment file
   cd server
   cp .env.example .env
   
   # Update .env with your database credentials
   # Then run migrations and seeds
   npm run db:setup
   ```

3. **Client Environment Setup:**
   ```bash
   # Copy client environment file
   cd client
   cp .env.example .env
   
   # Edit .env file:
   # For local: REACT_APP_API_URL= (leave empty)
   # For dev server: REACT_APP_API_URL=https://dev.cavinkare.in/va_revamp/api
   ```

4. **Start Development Servers:**
   ```bash
   # From root directory - starts both backend and frontend
   npm run dev
   
   # Or start individually:
   # Backend (http://localhost:8536)
   cd server && npm run dev
   
   # Frontend (http://localhost:3000)
   cd client && npm start
   ```

### Default Login Credentials

- **Email**: admin@varewamp.com
- **Password**: admin123
- **Role**: Super Admin

## Available Scripts

### Root Level
- `npm run dev` - Start both backend and frontend
- `npm run setup` - Install all dependencies
- `npm test` - Run all tests
- `npm run test:e2e` - Run E2E tests

### Backend (server/)
- `npm run dev` - Start development server
- `npm run migrate` - Run database migrations
- `npm run seed` - Run database seeds
- `npm run db:setup` - Run migrations and seeds
- `npm test` - Run backend tests

### Frontend (client/)
- `npm start` - Start development server
- `npm run build` - Build for production
- `npm test` - Run frontend tests

### E2E Tests (e2e-tests/)
- `npm test` - Run E2E tests
- `npm run test:headed` - Run tests with browser UI
- `npm run test:ui` - Run tests with Playwright UI

## Complete API Documentation

### Authentication Endpoints
```
POST /api/auth/login          # User authentication
GET  /api/auth/profile        # Get current user profile
POST /api/auth/logout         # User logout
```

### User Management (Super Admin Only)
```
GET    /api/users             # Get all users with pagination
GET    /api/users/:id         # Get specific user details
POST   /api/users             # Create new user
PUT    /api/users/:id         # Update user information
DELETE /api/users/:id         # Delete user account
GET    /api/users/roles       # Get all available roles
```

### Checklist Management
```
GET    /api/checklists                    # Get all checklists
GET    /api/checklists/:id               # Get specific checklist
POST   /api/checklists/:id/save          # Save checklist progress
POST   /api/checklists/:id/complete      # Complete checklist
GET    /api/checklists/data              # Get completed checklists data
POST   /api/checklists/upload            # Upload checklist images
```

### Roster Management
```
GET    /api/rosters                      # Get user rosters
GET    /api/rosters/dashboard/:userId    # Get user dashboard data
GET    /api/rosters/completed/:userId    # Get completed checklists
POST   /api/rosters                      # Create roster assignment
PUT    /api/rosters/:id                  # Update roster assignment
DELETE /api/rosters/:id                  # Delete roster assignment
```

### Admin Roster (Super Admin Only)
```
GET    /api/admin-rosters               # Get all roster assignments
POST   /api/admin-rosters               # Create new assignment
PUT    /api/admin-rosters/:id           # Update assignment
DELETE /api/admin-rosters/:id           # Delete assignment
GET    /api/admin-rosters/users         # Get assignable users
GET    /api/admin-rosters/checklists    # Get available checklists
```

## Complete Database Schema

### **Assignment & Status Flow Logic**

#### **Roster Assignment Dropdown Logic:**
```javascript
// Super Admin Assignment Interface
Assign Button → Dropdown Options:
├── Location Filter → users.location_access
├── Department Filter → users.department_access  
├── Role-Based Assignment:
│   ├── Auditor (Required) → rosters.auditor_id
│   ├── Supervisor (Optional) → rosters.supervisor_id
│   ├── Reviewer (Optional) → rosters.reviewer_id
│   └── Responsible Person (Optional) → rosters.responsible_person_id
└── Multi-Select Assignment → Single checklist, multiple users
```

#### **Status Progression Flow:**
```
New Assignment → Draft → Awaiting for NC response → Accepted/Rejected by Supervisor → Completed

Detailed Flow:
1. Super Admin assigns users to checklist
2. Auditor sees in "Pending" (status: null/Draft)
3. Auditor completes → status: "Awaiting for NC response"
4. Supervisor reviews → status: "Accepted/Rejected by Supervisor"
5. If Accepted → Reviewer sees in "Pending Review"
6. Reviewer completes → status: "Completed/Completed without NCs"
```

#### **Role-Based Status Visibility:**
```sql
-- Auditor Dashboard Query
WHERE rosters.auditor_id = user_id 
AND (checklist_data.id IS NULL OR checklist_data.submission_status = 'draft' 
     OR checklists.status IN ('', 'Draft', 'Rejected by Supervisor'))

-- Supervisor Dashboard Query  
WHERE rosters.supervisor_id = user_id
AND checklists.status = 'Awaiting for NC response'
AND NOT EXISTS (SELECT * FROM supervisor_reviews WHERE reviewed = true)

-- Reviewer Dashboard Query
WHERE rosters.reviewer_id = user_id 
AND checklists.status IN ('Accepted by Supervisor', 'Completed by Supervisor')
```

### Core Tables

#### **users**
```sql
id              INT PRIMARY KEY AUTO_INCREMENT
username        VARCHAR(50) UNIQUE NOT NULL
email           VARCHAR(100) UNIQUE NOT NULL
full_name       VARCHAR(100) NOT NULL
password        VARCHAR(255) NOT NULL (bcrypt hashed)
role_id         INT NOT NULL (Foreign Key → roles.id)
is_active       BOOLEAN DEFAULT true
last_login      TIMESTAMP NULL
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

#### **roles**
```sql
id              INT PRIMARY KEY AUTO_INCREMENT
name            VARCHAR(50) UNIQUE NOT NULL
description     TEXT
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

-- Default Roles:
-- 1: Super Admin, 2: Auditor, 3: Supervisor, 4: Reviewer, 5: Lead-Auditor
```

### Checklist Management Tables

#### **checklists**
```sql
id              INT PRIMARY KEY AUTO_INCREMENT
name            VARCHAR(100) NOT NULL
description     TEXT
is_active       BOOLEAN DEFAULT true
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

#### **checklist_items**
```sql
id              INT PRIMARY KEY AUTO_INCREMENT
checklist_id    INT NOT NULL (Foreign Key → checklists.id)
type            VARCHAR(50)
activities      TEXT
process         TEXT
criticality     VARCHAR(20)
order_index     INT
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

#### **checklist_data**
```sql
id                      INT PRIMARY KEY AUTO_INCREMENT
checklist_id           INT NOT NULL (Foreign Key → checklists.id)
user_id                INT NOT NULL (Foreign Key → users.id)
status                 ENUM('Active', 'Completed', 'Completed without NCs', 'Awaiting for NC response')
total_hours            DECIMAL(5,2)
location               VARCHAR(100)
department             VARCHAR(100)
total_camera_count     INT
total_camera_audited   INT
total_camera_random_audited INT
total_camera_not_audited    INT
total_camera_offline        INT
total_camera_offline_percent DECIMAL(5,2)
total_camera_technical_issues INT
total_camera_technical_issues_percent DECIMAL(5,2)
total_ncs              INT
remark                 TEXT
camera_file            VARCHAR(255)
created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

#### **checklist_responses**
```sql
id                  INT PRIMARY KEY AUTO_INCREMENT
checklist_data_id   INT NOT NULL (Foreign Key → checklist_data.id)
item_id             INT NOT NULL (Foreign Key → checklist_items.id)
status              ENUM('Yes', 'No', 'NA')
category            VARCHAR(100)
reason              TEXT
images              JSON (Array of image paths)
created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

### Assignment & Roster Tables

#### **checklist_assignments**
```sql
id              INT PRIMARY KEY AUTO_INCREMENT
user_id         INT NOT NULL (Foreign Key → users.id)
checklist_id    INT NOT NULL (Foreign Key → checklists.id)
assigned_date   DATE NOT NULL
status          ENUM('Pending', 'In Progress', 'Completed') DEFAULT 'Pending'
assigned_by     INT NOT NULL (Foreign Key → users.id)
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

#### **rosters**
```sql
id              INT PRIMARY KEY AUTO_INCREMENT
user_id         INT NOT NULL (Foreign Key → users.id)
checklist_id    INT NOT NULL (Foreign Key → checklists.id)
scheduled_date  DATE NOT NULL
status          ENUM('Scheduled', 'In Progress', 'Completed', 'Cancelled') DEFAULT 'Scheduled'
notes           TEXT
created_by      INT NOT NULL (Foreign Key → users.id)
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

### Master Data Tables

#### **categories**
```sql
id              INT PRIMARY KEY AUTO_INCREMENT
name            VARCHAR(100) UNIQUE NOT NULL
description     TEXT
is_active       BOOLEAN DEFAULT true
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

#### **locations**
```sql
id              INT PRIMARY KEY AUTO_INCREMENT
name            VARCHAR(100) UNIQUE NOT NULL
code            VARCHAR(20)
is_active       BOOLEAN DEFAULT true
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

#### **departments**
```sql
id              INT PRIMARY KEY AUTO_INCREMENT
name            VARCHAR(100) UNIQUE NOT NULL
code            VARCHAR(20)
is_active       BOOLEAN DEFAULT true
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

## Testing

The application includes comprehensive testing:

- **Unit Tests**: Model and utility function tests
- **Integration Tests**: API endpoint tests
- **Component Tests**: React component tests
- **E2E Tests**: Full user flow tests

Run tests with:
```bash
npm test                    # All tests
npm run test:server        # Backend tests only
npm run test:client        # Frontend tests only
npm run test:e2e          # E2E tests only
```

## Security Features

- JWT authentication
- Password hashing with bcrypt
- Rate limiting
- CORS protection
- Helmet security headers
- Input validation and sanitization
- Role-based access control

## Key Technical Implementation Details

### Backend Architecture
- **Knex.js Query Builder** with custom Eloquent-like model patterns
- **JWT Authentication** with role-based middleware
- **Multer File Upload** with image processing and validation
- **MySQL Transactions** for data consistency
- **Custom Middleware Stack** for authentication, validation, and error handling
- **RESTful API Design** with consistent response formatting

### Frontend Architecture
- **React 18** with functional components and hooks
- **Context API** for global state management (Authentication)
- **Axios** for HTTP client with interceptors
- **React Router v6** for client-side routing
- **Tailwind CSS** for responsive design system
- **Custom Hooks** for API calls and search functionality

### Security Implementation
- **bcrypt** password hashing (12 rounds)
- **JWT tokens** with expiration
- **Role-based access control** at route level
- **Input validation** and sanitization
- **File upload restrictions** (type, size, location)
- **CORS configuration** for cross-origin requests

### File Upload System
- **Image Storage**: `/server/uploads/images/`
- **Supported Formats**: JPG, JPEG, PNG, GIF
- **Size Limit**: 5MB per file
- **Naming Convention**: `timestamp_originalname`
- **Multiple Upload**: Support for multiple images per checklist item

### Database Design Patterns
- **Migration-based** schema management
- **Seeder files** for initial data
- **Foreign key constraints** for data integrity
- **Soft deletes** for user management
- **Timestamp tracking** for audit trails

## Deployment Guide

### Development Environment
```bash
# 1. Clone and setup
git clone <repository-url>
cd va-re
npm run setup

# 2. Database setup
mysql -u root -p
CREATE DATABASE va_rewamp;
exit

# 3. Configure environment
cd server
cp .env.example .env
# Edit .env with your database credentials
npm run db:setup

# 4. Start development servers
npm run dev  # Starts both backend (8536) and frontend (3000)
```

### Production Deployment
```bash
# 1. Build frontend
cd client
npm run build

# 2. Set production environment variables
cd ../server
# Edit .env for production settings
NODE_ENV=production
JWT_SECRET=your-production-secret
DB_HOST=your-production-db-host

# 3. Run production migrations
npm run migrate

# 4. Start production server
npm start
```

### Environment Variables

#### Server (.env)
```
NODE_ENV=development
PORT=8536
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRES_IN=24h

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your-password
DB_NAME=va_rewamp

UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880
```

#### Client (.env)
```
# For local development (leave empty)
REACT_APP_API_URL=

# For production deployment
REACT_APP_API_URL=https://your-domain.com/api
```

## Testing Strategy

### Backend Testing
```bash
cd server
npm test                    # Run all backend tests
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:coverage      # Test coverage report
```

### Frontend Testing
```bash
cd client
npm test                   # Run React tests
npm run test:coverage      # Coverage report
```

### E2E Testing
```bash
cd e2e-tests
npm test                   # Run Playwright tests
npm run test:headed        # Run with browser UI
npm run test:ui           # Run with Playwright UI
```

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Verify MySQL is running
   - Check .env database credentials
   - Ensure database exists

2. **File Upload Issues**
   - Check uploads directory permissions
   - Verify file size limits
   - Ensure supported file formats

3. **Authentication Problems**
   - Verify JWT_SECRET in .env
   - Check token expiration settings
   - Clear browser localStorage

4. **Camera Count Validation Error**
   - Ensure total camera count equals sum of all categories
   - Check for empty or invalid number inputs

### Performance Optimization

- **Database Indexing**: Key fields are indexed for faster queries
- **Image Optimization**: Implement image compression for uploads
- **Caching**: Consider Redis for session management in production
- **CDN**: Use CDN for static assets in production

## Contributing Guidelines

1. **Code Standards**
   - Follow ESLint configuration
   - Use consistent naming conventions
   - Add JSDoc comments for functions
   - Maintain test coverage above 80%

2. **Git Workflow**
   - Create feature branches from main
   - Use conventional commit messages
   - Ensure all tests pass before PR
   - Include migration files for schema changes

3. **Pull Request Process**
   - Provide clear description of changes
   - Include screenshots for UI changes
   - Update documentation if needed
   - Request review from team members

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For technical support or questions:
- Create an issue in the repository
- Contact the development team
- Check the troubleshooting section above

---

**Note**: This workflow is now stable and should not be changed without proper planning and team approval. The supervisor dual-access pattern is critical for the application's functionality.