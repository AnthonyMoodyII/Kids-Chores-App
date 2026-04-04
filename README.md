Moody Family Chore App

The Moody Family Chore App is a full-stack, gamified task management system built to help parents track household contributions and automate reward calculations. It replaces manual checklists with a persistent, database-driven dashboard that enforces specific earning logic based on weekly consistency.

🚀 Core Features
1. Tiered Payout Logic (The 4-Day Rule)
The application automatically calculates weekly earnings for each chore based on a specific threshold:

0–3 Days Completed: $0 earned.

4 Days Completed: 80% of the chore's base value is earned.

5–6 Days Completed: 100% of the base value is earned.

7 Days Completed: 100% of the base value is earned, plus a $1.00 bonus.

2. Parent Portal & Oversight
A secure, password-protected portal allows for administrative household management:

Approval System: Chores that meet the 4-day threshold require parent verification before payouts are processed.

Household Hub: A dashboard providing a high-level view of total approved earnings, pending tasks, and top earners.

Chore Library: Centrally manage chore templates (title and base value) and assign them to multiple children at once.

Unassign Chores: Remove chore assignments from selected children without deleting the template.

Payout History: A persistent log of all completed and paid transactions, with options to delete individual entries, clear history for a specific child, or clear all payout history globally.

3. Kids' Interactive Dashboard
A user-friendly interface designed for children to track their own progress:

Checklist View: Simple daily toggle for assigned chores.

Milestone Modals: Visual celebrations (Trophy/Star) when hitting the 4-day or 7-day milestones.

Real-time Progress Bars: Visual indicators showing how close a chore is to reaching the earning threshold.

🛠 Technology Stack
Frontend: React 18 with TypeScript, Vite, Tailwind CSS, and Lucide React icons.

Backend: Node.js and Express API.

Database: PostgreSQL for persistent storage of users, chores, and payouts.

ORM: Prisma for type-safe database queries and schema management.

Infrastructure: Docker and Docker Compose for environment-agnostic deployment.

📁 Data Models
The system utilizes a structured relational database schema:

User: Stores names and roles (Parent/Child).

ChoreTemplate: A library of reusable chore definitions and their standard values.

Chore: Tracks individual assignments, including completion state for each day of the week.

PayoutRecord: Maintains a historical archive of all processed rewards.

🐳 Deployment & Installation
Prerequisites
Docker and Docker Compose installed.

A .env file in the root directory containing VITE_PARENT_USERNAME, VITE_PARENT_PASSWORD, and DATABASE_URL.

Setup Instructions
Orchestrate Services: Run docker-compose up -d --build to start the frontend, backend, and PostgreSQL containers in detached mode (avoids terminal log flooding).

Initialize Database: Synchronize the database schema by running npx prisma db push within the backend service.

Access the App:

Frontend: http://localhost:8080

Backend API: http://localhost:3000

⚠️ Security & Maintenance
Environment Variables: Ensure production passwords are set via environment variables rather than hardcoded.

Weekly Resets: Use the "Reset Week" feature in the Parent Portal every Sunday evening to clear completion checkmarks for the new week.

Payout History Management: Parents can delete individual payout entries, clear history for a specific child, or perform a global clear of all payout records. Note that global clears are irreversible.