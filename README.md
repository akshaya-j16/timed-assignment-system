# Timed Assignment & Auto-Evaluation System

## Overview

The Timed Assignment & Auto-Evaluation System is a backend application that allows students to attempt assignments within a specified time limit and automatically evaluates their submissions using predefined criteria.

The system supports user authentication, role-based access control, assignment management, timed attempts, deadline validation, and automatic scoring.

## Features

- User registration and login
- Secure password hashing using bcrypt
- JWT-based authentication
- Role-based access for students and administrators
- Assignment creation and listing
- Timed assignment attempts
- Deadline enforcement and timeout handling
- Answer and URL validation
- Automatic scoring based on predefined criteria
- PostgreSQL database integration

## Technologies Used

- Node.js
- Express.js
- PostgreSQL
- JavaScript
- JSON Web Tokens (JWT)
- bcrypt
- Thunder Client for API testing

## Prerequisites

Install the following before running the project:

- Node.js and npm
- PostgreSQL
- Git

## Installation and Setup

1. Clone the repository:

   ```bash
   https://github.com/akshaya-j16/timed-assignment-system
   ```

2. Navigate to the project directory:

   ```bash
   cd timed-assignment-system
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Create a PostgreSQL database named `timed_assignment_system`.

5. Execute the SQL statements in `database/schema.sql` to create the required tables.

6. Create a `.env` file in the project root and configure your local database credentials and JWT secret. Use the variable names expected by `db.js` and `server.js`. Never commit this file.

7. Start the server using the start script configured in `package.json`:

   ```bash
   npm start
   ```

   If no start script is configured, run:

   ```bash
   node server.js
   ```

## API Overview

The backend provides endpoints for:

- Health checks and database connectivity
- User registration and login
- Authenticated user profile access
- Assignment creation and listing
- Starting timed assignment attempts
- Submitting answers for automatic evaluation

Authentication-protected endpoints require a valid JWT Bearer token. Administrator-only operations require the appropriate role.

Refer to `server.js` for the exact routes, request formats, and response structures.

## Automatic Evaluation

Submissions are evaluated using predefined criteria, including:

- Whether the answer is non-empty
- Whether the submitted URL is valid
- Whether the answer meets the minimum length requirement

The system calculates a score based on these criteria and tracks the submission status.

## Database

PostgreSQL stores user accounts, assignments, and student attempts, including deadlines, answers, evaluation results, scores, and submission statuses.

## Testing

API endpoints can be tested using Thunder Client or another REST API client.

## Security

- Passwords are stored as bcrypt hashes.
- Protected endpoints use JWT authentication.
- Student and administrator permissions are checked.
- Environment variables and database credentials must remain private.

## Future Improvements

- Frontend interface for students and administrators
- Detailed submission and result viewing
- Automated test coverage
- Deployment to a production hosting platform

## Author
Akshaya 
