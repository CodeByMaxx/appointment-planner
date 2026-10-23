# Appointment Planner

An appointment scheduling application built with a modern web stack and deployed on AWS.

**Project status:** MVP / Portfolio Project  
**Outlook Calendar integration:** Experimental

## Overview

Appointment Planner is a web application for managing appointments and displaying available booking slots. It includes a backend API, a frontend application, a PostgreSQL database, and AWS infrastructure.

The project is designed to demonstrate full-stack development, containerized deployment, database management, and cloud infrastructure integration.

## Features

- Appointment scheduling and availability management
- REST API for appointment-related operations
- PostgreSQL database with Prisma ORM
- Containerized application services using Docker Compose
- Multiple backend instances behind a load balancer
- AWS deployment
- Email integration using Amazon Simple Email Service (SES)
- Experimental Microsoft Outlook Calendar integration using Microsoft Graph API

## Technology Stack

### Frontend
- Web-based user interface
- Communicates with the backend API

### Backend
- Node.js
- TypeScript
- Prisma ORM
- REST API
- Microsoft Graph API integration (Experimental)

### Database
- PostgreSQL
- Prisma migrations

### Infrastructure
- Docker
- Docker Compose
- AWS EC2
- AWS CloudFront
- Amazon Simple Email Service (SES)

## Architecture

The application consists of the following components:

```text
                    Users
                      |
                      v
                  Frontend
                      |
                      v
                 API Load Balancer
                   /         \
                  v           v
               API 1         API 2
                  \           /
                   v         v
                   PostgreSQL
                       |
                       v
                  Appointment
                    Data

External integrations:
- Amazon SES for email delivery
- Microsoft Graph API for Outlook Calendar (Experimental)
```

The two API containers are instances of the same backend application. They do not represent separate stable and experimental backend implementations.

## Backend

The backend handles appointment scheduling, availability, database operations, and communication with external services.

The application uses Prisma ORM to access PostgreSQL. Database schema changes are managed through Prisma migrations.

### Outlook Calendar Integration (Experimental)

The backend includes an experimental integration with Microsoft Outlook Calendar through the Microsoft Graph API.

**Status: Experimental**

This integration is under development and should not be considered a fully validated production feature.

The integration is configured using environment variables:

| Variable | Description |
|---|---|
| `MS_TENANT_ID` | Microsoft Entra ID tenant identifier |
| `MS_CLIENT_ID` | Application (client) ID registered in Microsoft Entra ID |
| `MS_CLIENT_SECRET` | Application client secret |
| `MS_CALENDAR_EMAIL` | Email address of the target calendar |

These variables must be configured in the backend environment when the Outlook integration is used.

The corresponding Microsoft Entra ID application must have the required Microsoft Graph permissions and access to the target calendar.

#### Appointment and Outlook Event Association

The database includes an `outlookEventId` field on the appointment record. This field can be used to associate an application appointment with its corresponding Outlook calendar event.

The database migration adding this field must be applied before deploying backend code that depends on it.

#### Experimental Limitations

- The Outlook integration is experimental and requires further validation.
- Microsoft Graph authentication and calendar permissions must be configured correctly.
- Synchronization failures may require investigation and recovery.
- Appointment creation, updates, cancellations, and calendar synchronization should be tested together.
- The behavior when Microsoft Graph is unavailable must be verified.
- Outlook integration changes should be validated independently from the core appointment booking workflow.

The Outlook integration uses the existing backend application. It does not require a separate backend service.

## Environment Configuration

Application configuration is provided through environment variables.

Typical configuration includes database credentials, email delivery settings, company information, and optional Outlook integration settings.

### Database

The backend uses PostgreSQL. The database connection is configured through the `DATABASE_URL` environment variable.

Example format:

```env
DATABASE_URL=postgresql://USER:PASSWORD@postgres:5432/DATABASE
```

Replace the placeholders with the appropriate configuration. Do not commit real credentials to version control.

### Email

Amazon SES is used for email delivery.

Relevant configuration includes:

```env
AWS_REGION=your-aws-region
SES_FROM_EMAIL=your-verified-sender@example.com
```

The sender address must be configured and verified as required by the AWS SES environment.

### Outlook Calendar (Experimental)

The following optional configuration variables are used for Microsoft Graph integration:

```env
MS_TENANT_ID=
MS_CLIENT_ID=
MS_CLIENT_SECRET=
MS_CALENDAR_EMAIL=
```

Use valid values from your Microsoft Entra ID application and target calendar configuration.

**Security requirements:**
- Do not commit `.env` files containing secrets.
- Do not expose client secrets or access tokens in logs.
- Restrict access to deployment configuration.
- Rotate exposed credentials immediately.

## Local Development

### Prerequisites

Install the following tools before starting development:

- Node.js compatible with the project
- npm
- Docker
- Docker Compose

### Start the Application

From the project root, start the services with:

```bash
docker compose up -d --build
```

Check the service status:

```bash
docker compose ps
```

View logs:

```bash
docker compose logs -f
```

To stop the application:

```bash
docker compose down
```

**Note:** The exact startup procedure may depend on the current environment configuration and database migration state.

## Database Migrations

The project uses Prisma migrations to manage database schema changes.

Apply pending migrations with:

```bash
npx prisma migrate deploy
```

Run this command from the backend environment where Prisma and the correct database connection are configured.

For Docker deployments, execute migrations in the appropriate backend container or a one-off migration container according to the deployment procedure.

Migrations should be applied before starting application code that depends on the new schema.

Do not use `prisma migrate reset` against a production database, as it can delete data.

## Deployment

The application is deployed using Docker Compose on AWS EC2.

The deployment process includes:

1. Preparing the deployment environment.
2. Transferring the application files.
3. Configuring environment variables.
4. Building the Docker images.
5. Starting the database and application services.
6. Applying pending database migrations.
7. Verifying application health.

The deployment script and Docker Compose configuration are the authoritative references for the actual deployment sequence.

### Deployment Considerations

- Ensure required environment variables are configured on the server.
- Apply database migrations before running code that requires the updated schema.
- Verify that all required containers are running.
- Check backend and database logs after deployment.
- Test appointment availability and booking after deployment.
- Test external integrations independently.
- Keep secrets out of source control and deployment logs.

## Testing and Validation

Before deploying changes, validate the affected functionality.

Recommended checks include:

- Backend API startup
- Database connectivity
- Appointment availability
- Appointment creation and cancellation
- Database migrations
- Email delivery
- Outlook authentication and calendar access (Experimental)
- Error handling when external services are unavailable

The Outlook integration should be tested with a non-production calendar before relying on it for real appointments.

## Known Limitations

- The Outlook Calendar integration is experimental.
- External calendar synchronization requires further validation.
- The exact recovery behavior for synchronization failures must be verified.
- Production reliability depends on correct environment configuration, database migrations, and external service availability.

## Future Improvements

Potential areas for further development include:

- More comprehensive automated tests
- Improved error handling and retry logic for external integrations
- More robust Outlook synchronization and recovery
- Improved monitoring and operational logging
- Further validation of deployment and database migration procedures
- Additional documentation for administration and maintenance

## Security

- Keep all secrets outside the source code.
- Never commit `.env` files containing credentials.
- Use appropriately scoped cloud and Microsoft permissions.
- Protect production database access.
- Avoid logging secrets, tokens, or sensitive appointment information.
- Review authentication and authorization before exposing additional functionality.

## Project Purpose

Appointment Planner is a portfolio project demonstrating full-stack application development, API design, database integration, containerization, and cloud deployment.

The Outlook Calendar integration is an experimental extension of the existing backend and should be evaluated separately from the core appointment scheduling functionality.
