# Attendance System

## Installation Procedure

### 1. Prerequisites
- Node.js (v18 or higher recommended)
- PostgreSQL (Installed and running on your local machine)
- Git

### 2. Setup the Repository
Clone the repository and install the monorepo dependencies:
```bash
git clone <your-repo-url>
cd attendance_system
npm install
```

### 3. Database Configuration
1. Ensure your local PostgreSQL server is running.
2. Create a database for the project (e.g., `attendance_db`).
3. Navigate to the API app:
   ```bash
   cd apps/api
   ```
4. Copy the environment variables template and configure it:
   ```bash
   cp .env.example .env
   ```
5. Open `.env` and set your `DATABASE_URL` to match your local PostgreSQL credentials:
   ```env
   DATABASE_URL="postgresql://<user>:<password>@localhost:5432/attendance_db"
   JWT_SECRET="your-super-secret-jwt-key"
   ```

### 4. Initialize Prisma ORM
We use Prisma 8 (contract-based workflow). From the `apps/api` directory, run:

1. Validate the schema and generate the client artifacts:
   ```bash
   npm run contract:emit
   ```
2. Push the schema to your database to create the tables:
   ```bash
   npx prisma db update --yes
   ```

### 5. Run the Development Server
With the dependencies installed and database ready, start the API dev server (from `apps/api`):
```bash
npm run dev
```

The server will start at `http://localhost:3000`. You can verify it's running by visiting `http://localhost:3000/health`.
