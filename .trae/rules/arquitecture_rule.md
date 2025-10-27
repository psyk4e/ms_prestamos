# Project Architecture Guide

## Overview

This project follows **Clean Architecture** principles, ensuring separation of concerns, maintainability, and scalability. The structure is organized into distinct layers, each with specific responsibilities.

## 📁 Project Structure

```
src/
├── domain/                    # Business Logic Layer (Core)
│   ├── entities/              # Business entities and data models
│   └── interfaces/            # Repository and service contracts
├── application/               # Application Business Rules
│   ├── use-cases/            # Business use cases and orchestration
│   └── validators/           # Input validation logic
├── infrastructure/            # External Concerns
│   ├── config/               # Configuration files
│   ├── database/             # Database implementations
│   └── services/             # External service implementations
├── presentation/              # Interface Adapters
│   ├── controllers/          # HTTP request handlers
│   ├── middleware/           # Request/response middleware
│   └── routes/               # API route definitions
└── index.ts                  # Application entry point
```

## 🏗️ Layer Responsibilities

### 1. Domain Layer (Core Business Logic)
**Location**: `src/domain/`

**Purpose**: Contains the core business logic and rules. This layer is independent of external frameworks and technologies.

**Components**:
- **Entities** (`entities/`): Core business objects and data structures
- **Interfaces** (`interfaces/`): Contracts for repositories and services

**Rules**:
- ❌ No dependencies on other layers
- ❌ No framework-specific code
- ✅ Pure business logic only
- ✅ Define contracts for external dependencies

**Example Structure**:
```
domain/
├── entities/
│   ├── CreditoAtrasado.ts     # Core business entity
│   ├── User.ts               # User entity
│   └── Payment.ts            # Payment entity
└── interfaces/
    ├── ICreditoAtrasadoRepository.ts
    ├── IUserRepository.ts
    └── IPaymentService.ts
```

### 2. Application Layer (Use Cases)
**Location**: `src/application/`

**Purpose**: Orchestrates business workflows and implements application-specific business rules.

**Components**:
- **Use Cases** (`use-cases/`): Business workflows and orchestration logic
- **Validators** (`validators/`): Input validation and data sanitization

**Rules**:
- ✅ Can depend on Domain layer
- ❌ No dependencies on Infrastructure or Presentation
- ✅ Orchestrates business logic
- ✅ Handles application-specific validation

**Example Structure**:
```
application/
├── use-cases/
│   ├── CreditoAtrasadoUseCase.ts    # Credit management workflows
│   ├── UserManagementUseCase.ts     # User operations
│   └── PaymentProcessingUseCase.ts  # Payment workflows
└── validators/
    ├── CreditoAtrasadoValidator.ts   # Credit validation rules
    ├── UserValidator.ts             # User input validation
    └── PaymentValidator.ts          # Payment validation
```

### 3. Infrastructure Layer (External Concerns)
**Location**: `src/infrastructure/`

**Purpose**: Implements external dependencies and technical details.

**Components**:
- **Config** (`config/`): Application configuration and settings
- **Database** (`database/`): Database implementations and repositories
- **Services** (`services/`): External service implementations

**Rules**:
- ✅ Can depend on Domain and Application layers
- ✅ Implements interfaces defined in Domain
- ✅ Contains framework-specific code
- ✅ Handles external integrations

**Example Structure**:
```
infrastructure/
├── config/
│   ├── AppConfig.ts              # Application settings
│   ├── DatabaseConfig.ts         # Database configuration
│   └── SentryAlertsConfig.ts     # Monitoring configuration
├── database/
│   ├── PrismaClient.ts           # Database client setup
│   ├── CreditoAtrasadoRepository.ts  # Repository implementation
│   └── migrations/               # Database migrations
└── services/
    ├── SentryLogService.ts       # Logging service implementation
    ├── EmailService.ts           # Email service implementation
    └── WebhookLogService.ts      # Webhook logging
```

### 4. Presentation Layer (Interface Adapters)
**Location**: `src/presentation/`

**Purpose**: Handles HTTP requests, responses, and user interface concerns.

**Components**:
- **Controllers** (`controllers/`): HTTP request handlers
- **Middleware** (`middleware/`): Request/response processing
- **Routes** (`routes/`): API endpoint definitions

**Rules**:
- ✅ Can depend on Application layer
- ❌ Should not depend directly on Infrastructure
- ✅ Handles HTTP-specific concerns
- ✅ Transforms data for external interfaces

**Example Structure**:
```
presentation/
├── controllers/
│   ├── WebhookController.ts      # Webhook endpoints
│   ├── CreditoController.ts      # Credit management endpoints
│   └── UserController.ts         # User management endpoints
├── middleware/
│   ├── AuthMiddleware.ts         # Authentication middleware
│   ├── SecurityMiddleware.ts     # Security headers and validation
│   └── LoggingMiddleware.ts      # Request logging
└── routes/
    ├── ApiRoutes.ts              # Main API routes
    ├── WebhookRoutes.ts          # Webhook routes
    └── HealthRoutes.ts           # Health check routes
```

## 🚀 Scalability Guidelines

### Adding New Features

1. **Start with Domain Layer**:
   ```typescript
   // 1. Define entity in domain/entities/
   export interface NewFeature {
     id: string;
     name: string;
     // ... other properties
   }
   
   // 2. Define repository interface in domain/interfaces/
   export interface INewFeatureRepository {
     findById(id: string): Promise<NewFeature | null>;
     save(feature: NewFeature): Promise<void>;
   }
   ```

2. **Create Use Case in Application Layer**:
   ```typescript
   // application/use-cases/NewFeatureUseCase.ts
   export class NewFeatureUseCase {
     constructor(private repository: INewFeatureRepository) {}
     
     async createFeature(data: CreateFeatureRequest): Promise<NewFeature> {
       // Business logic here
     }
   }
   ```

3. **Implement Repository in Infrastructure**:
   ```typescript
   // infrastructure/database/NewFeatureRepository.ts
   export class NewFeatureRepository implements INewFeatureRepository {
     // Database implementation
   }
   ```

4. **Add Controller in Presentation**:
   ```typescript
   // presentation/controllers/NewFeatureController.ts
   export class NewFeatureController {
     constructor(private useCase: NewFeatureUseCase) {}
     
     async create(req: Request, res: Response) {
       // HTTP handling
     }
   }
   ```

### Naming Conventions

#### Files and Classes
- **Entities**: `PascalCase` (e.g., `CreditoAtrasado.ts`)
- **Interfaces**: `IPascalCase` (e.g., `ICreditoAtrasadoRepository.ts`)
- **Use Cases**: `PascalCaseUseCase` (e.g., `CreditoAtrasadoUseCase.ts`)
- **Controllers**: `PascalCaseController` (e.g., `WebhookController.ts`)
- **Services**: `PascalCaseService` (e.g., `SentryLogService.ts`)
- **Validators**: `PascalCaseValidator` (e.g., `CreditoAtrasadoValidator.ts`)

#### Directories
- Use `kebab-case` for multi-word directories (e.g., `use-cases/`)
- Use `camelCase` for single-word directories (e.g., `controllers/`)

### Dependency Injection Pattern

```typescript
// Recommended dependency injection setup
class ApplicationContainer {
  // Infrastructure
  private creditoRepository = new CreditoAtrasadoRepository();
  
  // Application
  private creditoUseCase = new CreditoAtrasadoUseCase(this.creditoRepository);
  
  // Presentation
  public creditoController = new CreditoController(this.creditoUseCase);
}
```

### Testing Strategy

```
tests/
├── unit/
│   ├── domain/           # Test business logic
│   ├── application/      # Test use cases
│   └── infrastructure/   # Test implementations
├── integration/
│   ├── database/         # Test database operations
│   └── services/         # Test external services
└── e2e/
    └── api/              # Test complete workflows
```

## 📋 Development Checklist

### Before Adding New Code
- [ ] Identify which layer the code belongs to
- [ ] Check if similar functionality already exists
- [ ] Follow naming conventions
- [ ] Ensure proper dependency direction

### Code Review Checklist
- [ ] No circular dependencies
- [ ] Domain layer has no external dependencies
- [ ] Use cases are focused and single-purpose
- [ ] Controllers only handle HTTP concerns
- [ ] Proper error handling implemented
- [ ] Input validation in place
- [ ] Tests cover new functionality

## 🔧 Maintenance Guidelines

### Regular Tasks
1. **Monthly**: Review and clean up unused imports
2. **Quarterly**: Analyze dependencies and update architecture docs
3. **Bi-annually**: Refactor based on new patterns and learnings

### Performance Considerations
- Keep use cases lightweight and focused
- Implement caching at the infrastructure layer
- Use database indexes for frequently queried fields
- Monitor and optimize slow queries

### Security Best Practices
- Validate all inputs at the presentation layer
- Sanitize data before database operations
- Implement proper authentication and authorization
- Log security-relevant events
- Keep sensitive configuration in environment variables

## 🎯 Benefits of This Architecture

1. **Testability**: Each layer can be tested independently
2. **Maintainability**: Clear separation of concerns
3. **Scalability**: Easy to add new features without affecting existing code
4. **Flexibility**: Can swap implementations without changing business logic
5. **Team Collaboration**: Clear boundaries for different team members

## 📚 Additional Resources

- [Clean Architecture by Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/)
- [Domain-Driven Design](https://martinfowler.com/bliki/DomainDrivenDesign.html)

---

**Last Updated**: January 2024  
**Version**: 1.0.0  
**Maintainer**: Development Team