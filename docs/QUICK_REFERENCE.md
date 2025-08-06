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

### ✅ DO Edit These:
- `business:belongsToDomain`
- `business:hasBusinessRules` 
- `business:supportsUseCases`
- `code:summary` (for methods/classes)
- `code:description` (for methods/classes)

### ❌ DON'T Edit These:
- `code:name` (auto-generated)
- `code:hasMethod` (auto-generated)
- `code:signature` (auto-generated)
- `code:language` (auto-generated)

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