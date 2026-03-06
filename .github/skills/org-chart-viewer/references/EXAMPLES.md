# Manifest Examples

## Minimal — Single Department + Person

```yaml
name: My Team

entities:
  - id: team
    type: department
    name: My Team

  - id: lead
    type: person
    name: Alice
    parentId: team
    metadata:
      title: Team Lead
```

## Small Team — Flat Structure

```yaml
name: Platform Team

entities:
  - id: platform
    type: department
    name: Platform Team
    metadata:
      headcount: 5

  - id: lead
    type: person
    name: Sarah Connor
    parentId: platform
    metadata:
      title: Tech Lead
      email: sarah@company.com

  - id: dev1
    type: person
    name: James Kirk
    parentId: platform
    managerId: lead
    metadata:
      title: Senior Developer

  - id: dev2
    type: person
    name: Nyota Uhura
    parentId: platform
    managerId: lead
    metadata:
      title: Developer

  - id: dev3
    type: person
    name: Montgomery Scott
    parentId: platform
    managerId: lead
    metadata:
      title: DevOps Engineer
```

## Full Company — Nested Departments, People, Vendors & Relationships

```yaml
name: Acme Corporation

entities:
  # Root
  - id: company
    type: department
    name: Acme Corporation
    metadata:
      founded: "2020"
      employees: 50

  # Level 1 departments
  - id: engineering
    type: department
    name: Engineering
    parentId: company
    metadata:
      headcount: 20
      budget: "$2M"

  - id: sales
    type: department
    name: Sales
    parentId: company
    metadata:
      headcount: 15

  # Level 2 departments
  - id: frontend
    type: department
    name: Frontend Team
    parentId: engineering
    metadata:
      headcount: 8

  - id: backend
    type: department
    name: Backend Team
    parentId: engineering
    metadata:
      headcount: 12

  # People — C-suite
  - id: ceo
    type: person
    name: Jane Doe
    parentId: company
    metadata:
      title: CEO
      email: jane@acme.com

  # People — Engineering
  - id: cto
    type: person
    name: John Smith
    parentId: engineering
    metadata:
      title: CTO

  - id: fe-lead
    type: person
    name: Alice Chen
    parentId: frontend
    managerId: cto
    metadata:
      title: Frontend Lead

  - id: be-lead
    type: person
    name: Bob Wilson
    parentId: backend
    managerId: cto
    metadata:
      title: Backend Lead

  # People — Sales
  - id: vp-sales
    type: person
    name: Sarah Johnson
    parentId: sales
    metadata:
      title: VP Sales

  # Vendors
  - id: cloud-vendor
    type: vendor
    name: AWS
    metadata:
      contract: "$200K/year"

# Explicit cross-cutting relationships
relationships:
  - from: engineering
    to: cloud-vendor
    type: depends_on
    note: Cloud infrastructure
    strength: high

  - from: fe-lead
    to: be-lead
    type: collaborates_with
    note: API design
```

## ID Naming Conventions

Use lowercase kebab-case for IDs:
- `ceo`, `cto`, `vp-sales` — for people
- `engineering`, `frontend`, `backend` — for departments
- `cloud-vendor` — for vendors

This keeps IDs readable and consistent across manifests.
