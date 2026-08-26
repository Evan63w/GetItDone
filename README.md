# GetItDone

GetItDone is a personal task and goal tracking app designed to help users manage what they need to do and mark progress as they complete it.

## Current status

The project is now set up as an AWS-native application with infrastructure, backend APIs, and automated validation in place.

### What I have built so far

- AWS CDK project scaffold and deployment structure
- Beta and prod deployment environments
  - Beta: us-west-2
  - Prod: us-east-1
- GitHub OIDC deployment role setup for AWS authentication
- Cognito User Pool and app client for login and auth
- DynamoDB table for task storage with a single-table design
- API Gateway with Cognito JWT authorizer
- Lambda functions for task operations
  - list tasks
  - create task
  - update task
- Unit tests for task logic and validation
- Real AWS integration test that creates a user, adds a task, updates the task, and validates the live flow
- GitHub Actions workflow to deploy beta and run live validation before prod deployment

### Architecture in place

- Cognito handles user identity and sign-in
- DynamoDB stores task records for each user
- Lambda functions implement the backend task API
- API Gateway exposes the authenticated endpoints
- GitHub Actions deploys infrastructure through CDK and validates the beta environment

### Repo structure

- bin/ - CDK app entry point
- lib/ - CDK stacks for Cognito, data, API, and GitHub deploy roles
- lambda/ - Lambda handlers for task operations
- test/ - unit and integration tests
- .github/workflows/ - deployment automation

### Deployment and validation status

The app has been deployed and validated in beta using real AWS resources. The live integration test creates a real Cognito user, creates a task through the API, updates it, and confirms the Lambda executions in CloudWatch.

### Testing

Local unit and integration checks are available through the project test script.

Typical commands:

- npm test
- npx cdk synth
- npx cdk deploy --require-approval never --context environment=beta --context account=341853291300 --context region=us-west-2 ...

For the integration test, the environment must include the deployed beta values for the user pool, app client, API URL, and task table.

## Next steps

### 1. Build the user-facing app experience

- Create the front-end client for login and task management
- Add a dashboard for viewing tasks by status
- Add a clean create/edit task form
- Add a logout flow and session handling

### 2. Expand the task model

- Add task categories or tags
- Add due dates and reminders
- Add priority levels
- Add completed task history and filtering
- Add basic search and sorting

### 3. Improve the backend and operations

- Add delete-task support
- Add pagination and task filtering
- Add richer CloudWatch logs and alerting
- Add API error handling and validation improvements
- Add request tracing across the task API

### 4. Harden production readiness

- Add prod live integration validation after deployment
- Add alarm and monitoring coverage for the Lambda/API layer
- Review IAM least-privilege boundaries
- Add environment-specific secrets and configuration cleanup

### 5. Product growth and polish

- Add user profile settings
- Add recurring tasks and habits
- Add cross-device sync behavior
- Add notifications and reminders
- Add a richer goal tracking experience beyond simple tasks

## Summary

The foundation is in place: AWS infrastructure, authentication, task APIs, deployment automation, and real AWS validation are working. The next major milestone is putting a usable product interface on top of this backend and continuing to expand the task system into a more complete personal productivity app.
