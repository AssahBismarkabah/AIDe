# Module Knowledge Files - Quick Reference

## 🚀 Quick Start

### Generate Knowledge Files
```bash
# For entire project
npx aide generate-knowledge --path ./src

# For specific file  
npx aide generate-knowledge --file ./src/UserService.ts
```

### Enhance Business Context
Replace these placeholders in your `.module-knowledge.ttl` files:

```turtle
# ❌ Replace this:
business:belongsToDomain "[BUSINESS_DOMAIN] - Replace with actual domain" ;

# ✅ With this:
business:belongsToDomain "User Authentication and Authorization" ;
```

## 📝 Essential Edits

### 1. Business Domain
```turtle
business:belongsToDomain "E-commerce Order Processing" ;
```

### 2. Business Rules  
```turtle
business:hasBusinessRules "
- Orders over $500 require manager approval
- Payment must be validated before fulfillment
- Refunds processed within 30 days
" ;
```

### 3. Use Cases
```turtle
business:supportsUseCases "
- Customer places order
- Payment processing  
- Inventory allocation
- Order fulfillment
" ;
```

### 4. Method Descriptions
```turtle
code:validateUser 
    code:summary "Validates user credentials against security policies" ;
    code:description "Multi-step validation with rate limiting and account lockout protection" ;
    business:implementsRule "Corporate password complexity standards" .
```

## ⚠️ Important Rules

### ✅ SAFE TO EDIT - Business & Documentation Properties:

**Module-Level Business Context:**
- `business:belongsToDomain` - Business domain description
- `business:hasBusinessRules` - Business rules and constraints
- `business:supportsUseCases` - Supported use cases
- `business:satisfiesAttribute` - Quality attributes (performance, security, etc.)
- `business:subjectToConstraint` - Business constraints
- `business:hasStakeholder` - Key stakeholders

**Method/Class Documentation:**
- `code:summary` - Brief description of purpose
- `code:description` - Detailed explanation
- `code:example` - Usage examples
- `code:seeAlso` - Related references
- `code:deprecated` - Deprecation notes

**Business Rule Implementation:**
- `business:implementsRule` - Which business rules this implements
- `business:supportsUseCase` - Which use cases this supports

**Custom Domain Properties:**
- Any properties with your custom namespace (e.g., `ecommerce:handlesPaymentTypes`)

### ❌ NEVER EDIT - Auto-Generated Technical Properties:

**Core Structure (Auto-Generated from Code):**
- `code:name` - Class/method/module names
- `code:signature` - Method signatures
- `code:language` - Programming language
- `code:version` - Module version
- `code:hasClass` - Module contains classes
- `code:hasMethod` - Class contains methods
- `code:hasProperty` - Class contains properties
- `code:hasParameter` - Method contains parameters
- `code:extends` - Class inheritance
- `code:implements` - Interface implementations
- `code:dependsOn` - Dependencies
- `code:imports` - Import statements
- `code:exports` - Export statements

**Technical Metadata:**
- `code:fullyQualifiedName` - Full class/method names
- `code:visibility` - public/private/protected
- `code:isStatic` - Static method flag
- `code:isAsync` - Async method flag
- `code:isAbstract` - Abstract class flag
- `code:isOptional` - Optional parameter flag
- `code:isReadonly` - Readonly property flag
- `code:type` - Parameter/property types
- `code:returnType` - Method return types

**Source Location:**
- `code:sourceFile` - Source file path
- `code:startLine` - Starting line number
- `code:endLine` - Ending line number
- `code:startColumn` - Starting column
- `code:endColumn` - Ending column

**Quality Metrics (Auto-Calculated):**
- `quality:cyclomaticComplexity` - Complexity metrics
- `quality:cognitiveComplexity` - Cognitive complexity
- `quality:linesOfCode` - Lines of code count
- `quality:maintainabilityIndex` - Maintainability score

**File Metadata:**
- `code:generatedAt` - Generation timestamp
- `code:checksum` - File checksum
- `code:createdAt` - Creation timestamp
- `code:modifiedAt` - Last modification

## 🔍 Validation

```bash
# Check your edits
npx aide validate-knowledge

# Fix common issues
npx aide validate-knowledge --fix
```

## 🆘 Common Errors

| Error | Fix |
|-------|-----|
| `Invalid RDF syntax` | Check semicolons and quotes |
| `Placeholder detected` | Replace `[PLACEHOLDER]` text |
| `Missing required property` | Add missing business context |

## 📁 File Structure

```
src/
├── UserService.ts
├── .module-knowledge.ttl    ← Edit this file
└── OrderService.ts
    └── .module-knowledge.ttl ← Edit this file
```

## 🔄 Workflow

1. **Code** → Write/modify TypeScript/JavaScript
2. **Generate** → System creates `.module-knowledge.ttl`
3. **Enhance** → Add business context manually
4. **Validate** → Check syntax and completeness
5. **Commit** → Business context preserved on updates

---

💡 **Pro Tip**: Start with business domain and rules - these provide the most value for AI assistance and team understanding.