# Smart Attendance System

A full-stack attendance management system built with React, Express, Prisma 8, and PostgreSQL.

## Prerequisites

- **Node.js** (v18 or higher recommended)
- **PostgreSQL** (Installed and running on your local machine)
- **Git**

## Installation & Setup Guide

### 1. Clone and Install Dependencies

Clone the repository and install the monorepo dependencies from the root directory:

```bash
git clone https://github.com/tanmayskotadia/attendance-system.git
cd attendance-system
npm install
```

### 2. Database Configuration

1. Make sure your local PostgreSQL server is running.
2. Create a database for the project (e.g., `attendance_db`).
3. Navigate to the API directory:
   ```bash
   cd apps/api
   ```
4. Create an `.env` file based on your local setup:
   ```bash
   New-Item .env -ItemType File
   ```
5. Open `.env` and configure your database URL and JWT secret:
   ```env
   PORT=3000
   DATABASE_URL="postgresql://<user>:<password>@localhost:5432/attendance_db?schema=public"
   JWT_SECRET="your-super-secret-jwt-key"
   ```

### 3. Initialize Prisma ORM

The backend uses Prisma 8. From the `apps/api` directory, initialize the database:

1. Generate the Prisma client artifacts:
   ```bash
   npm run contract:emit
   ```
2. Apply the schema to your PostgreSQL database:
   ```bash
   npx prisma db update --confirm attendance_db
   ```
3. Return to the project root directory:
   ```bash
   cd ../..
   ```

### 4. Run the Application

Start both the frontend (Vite) and backend (Express) development servers simultaneously from the **root directory**:

```bash
npm run dev
```

- **Frontend UI:** [http://localhost:5173](http://localhost:5173)
- **Backend API:** [http://localhost:3000](http://localhost:3000)

### 5. Initial Usage

1. Open the frontend URL in your browser.
2. Use the application's interface to register a new user (the first user should be given an admin role, or you can register normally).
3. Under the **Register** section, you can start managing **Time Slots**, **Courses**, and **Students**.
4. Use the **Daily Attendance** page to track and mark student attendance for active sessions.
