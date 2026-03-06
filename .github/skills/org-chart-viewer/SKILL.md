---
name: org-chart-viewer
description: 'Generate and display interactive organization charts from YAML manifests. Use when asked to create an org chart, organization chart, team structure, hierarchy visualization, reporting structure, department overview, team overview, or visualize an org for a group of people or organization. Generates YAML manifests and launches an interactive graph viewer locally.'
---

# Organization Chart Viewer

Generate YAML manifests describing organizational structures and display them as interactive graphs using the `org-chart` CLI from `github:emileSWAAA/org-chart`.

## When to Use This Skill

- User asks to "create an org chart", "show the team structure", "visualize the organization"
- User provides names, roles, departments, or reporting lines and wants a visual hierarchy
- User wants to generate an interactive, local organization chart from data in their project

## Prerequisites

- Node.js 18+ installed
- Internet access (to fetch the package from GitHub on first run)

## Step-by-Step Workflow

### Step 1: Gather Organizational Data

Collect from the user or workspace files:
- **People**: names, titles, department, manager
- **Departments**: names, parent departments, metadata (headcount, budget)
- **Vendors** (optional): external partners

### Step 2: Generate the YAML Manifest

Copy the template from [assets/manifest-template.yaml](assets/manifest-template.yaml) into the user's workspace as `org-chart.yaml` and populate it with the gathered data.

For the full field reference, see [references/SCHEMA.md](references/SCHEMA.md).
For worked examples (minimal, small team, full company), see [references/EXAMPLES.md](references/EXAMPLES.md).

**Quick entity summary** — each entity needs `id`, `type` (`person` | `department` | `vendor`), and `name`. Use `parentId` for hierarchy and `managerId` for management lines. Add any extra info in `metadata`.

### Step 3: Launch the Viewer

```bash
npx github:emileSWAAA/org-chart --file ./org-chart.yaml
```

This installs dependencies (first run only), loads the manifest, starts a Vite dev server, and opens the graph in the browser automatically.

**Alternative — inline YAML** (small orgs):

```bash
npx github:emileSWAAA/org-chart --yaml "name: My Team
entities:
  - id: team
    type: department
    name: My Team
  - id: lead
    type: person
    name: Alice
    parentId: team
    metadata:
      title: Team Lead"
```

**No manifest** (opens the file upload UI):

```bash
npx github:emileSWAAA/org-chart
```

## CLI Reference

```
org-chart [options]

Options:
  -f, --file <path>    Path to a YAML/JSON manifest file
  -y, --yaml <string>  Inline YAML manifest content
  -h, --help           Show help
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `npx` fails to fetch | Check internet and that `github:emileSWAAA/org-chart` is accessible |
| "File not found" | Verify `--file` path is correct relative to current directory |
| Browser doesn't open | Open the URL from terminal output manually (usually `http://localhost:5173`) |
| YAML parse error | Check indentation and required fields — see [references/SCHEMA.md](references/SCHEMA.md) |

## References

- [YAML Schema](references/SCHEMA.md) — full field reference, types, validation rules
- [Examples](references/EXAMPLES.md) — minimal, small team, and full company manifests
- [Manifest Template](assets/manifest-template.yaml) — copy-ready starter file
