# YAML Manifest Schema Reference

The manifest is a YAML (or JSON) file with two top-level keys: `name` (optional) and `entities` (required), plus an optional `relationships` array.

## Top-Level Fields

| Field           | Required | Type   | Description                                |
|-----------------|----------|--------|--------------------------------------------|
| `name`          | No       | string | Human-readable name for the organization   |
| `entities`      | **Yes**  | array  | List of entity objects                     |
| `relationships` | No       | array  | Explicit relationships between entities    |

## Entity Object

| Field       | Required | Type   | Description                                                        |
|-------------|----------|--------|--------------------------------------------------------------------|
| `id`        | **Yes**  | string | Unique identifier (used for references). Use lowercase kebab-case. |
| `type`      | **Yes**  | string | One of: `person`, `department`, `vendor`                           |
| `name`      | **Yes**  | string | Display name                                                       |
| `parentId`  | No       | string | For departments: parent department ID. For persons: department ID.  |
| `managerId` | No       | string | For persons only: ID of their manager (must be another person).    |
| `color`     | No       | string | Custom color for the node (CSS color value).                       |
| `metadata`  | No       | object | Arbitrary key-value pairs shown in the inspector panel.            |

### Entity Type Rules

**`department`**
- `parentId` points to another department (creates hierarchy tree).
- A department without `parentId` is a root node.

**`person`**
- `parentId` must point to a department (which department they belong to).
- `managerId` must point to another person (their direct manager).
- Both are optional — a person without `parentId` floats unattached.

**`vendor`**
- Standalone entity. Cannot have `parentId` or `managerId`.
- Can participate in explicit relationships.

## Relationship Object

| Field      | Required | Type   | Description                                |
|------------|----------|--------|--------------------------------------------|
| `from`     | **Yes**  | string | Source entity ID                           |
| `to`       | **Yes**  | string | Target entity ID                           |
| `type`     | **Yes**  | string | One of the relationship types below        |
| `note`     | No       | string | Label displayed on the edge                |
| `strength` | No       | string | `low`, `medium`, or `high`                 |
| `metadata` | No       | object | Arbitrary key-value pairs                  |

### Relationship Types

| Type                     | Description                        | Implicit? |
|--------------------------|------------------------------------|-----------|
| `manages`                | Direct management                  | No        |
| `reports_to`             | Reporting line                     | No        |
| `influences`             | Advisory / influence               | No        |
| `depends_on`             | Dependency                         | No        |
| `collaborates_with`      | Collaboration                      | No        |
| `department_hierarchy`   | Parent-child department link       | Yes — auto-generated from `parentId` on departments |
| `person_management`      | Person-to-manager link             | Yes — auto-generated from `managerId` on persons    |

> You only need to define explicit relationships for cross-cutting links (collaboration, influence, dependency). Hierarchy and management lines are derived automatically.

## Metadata Conventions

The `metadata` object accepts arbitrary key-value pairs. Common conventions:

### Person metadata
| Key        | Example           | Description         |
|------------|-------------------|---------------------|
| `title`    | `"CTO"`           | Job title           |
| `email`    | `"j@acme.com"`    | Email address       |
| `tenure`   | `"5 years"`       | Time at company     |
| `location` | `"San Francisco"` | Office location     |

### Department metadata
| Key         | Example          | Description        |
|-------------|------------------|--------------------|
| `headcount` | `45`             | Number of people   |
| `budget`    | `"$5M"`          | Department budget  |
| `location`  | `"New York"`     | Office / region    |

### Vendor metadata
| Key              | Example          | Description      |
|------------------|------------------|------------------|
| `contract_value` | `"$500K/year"`   | Contract amount  |
| `renewal`        | `"2026-06"`      | Renewal date     |

## Validation Rules

The parser enforces these constraints:
1. All entity `id` values must be unique.
2. Department `parentId` must reference an existing department.
3. Person `parentId` must reference an existing department.
4. Person `managerId` must reference an existing person.
5. No circular references in department hierarchy.
6. Items are limited to 2 MB when serialized (Cosmos DB constraint if persisted).
