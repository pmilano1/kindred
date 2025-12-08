# Kindred API Documentation

Kindred exposes a GraphQL API for data access and a few REST endpoints for operational tasks.

## Authentication

### Session Authentication
Web users authenticate via NextAuth.js with Google OAuth or local credentials.

### API Key Authentication
For programmatic access, use an API key in the `X-API-Key` header:

```bash
curl -X POST https://your-domain/api/graphql \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"query": "{ stats { total_people } }"}'
```

Generate API keys via:
- **Admin UI**: Admin → API Keys
- **GraphQL**: `mutation { generateApiKey }`

---

## GraphQL API

**Endpoint**: `POST /api/graphql`

**Playground**: Open `/api/graphql` in browser for interactive explorer.

### Queries

#### People & Families

| Query | Description | Auth |
|-------|-------------|------|
| `person(id: ID!)` | Get single person by ID | Required |
| `people(first, after, last, before)` | Paginated list (cursor-based) | Required |
| `peopleList(limit, offset)` | Simple list (max 100) | Required |
| `search(query, first, after)` | Full-text search with pagination | Required |
| `family(id: ID!)` | Get single family | Required |
| `families` | List all families | Required |
| `ancestors(personId, generations)` | Get ancestors | Required |
| `descendants(personId, generations)` | Get descendants | Required |

#### Stats & Timeline

| Query | Description | Auth |
|-------|-------------|------|
| `stats` | Database statistics | Required |
| `timeline` | Events grouped by year | Required |
| `researchQueue(limit)` | People needing research | Required |
| `notablePeople` | Notable ancestors | Required |
| `recentPeople(limit)` | Recently added | Required |

#### Coats of Arms

| Query | Description | Auth |
|-------|-------------|------|
| `surnameCrests` | All surname crests | Required |
| `surnameCrest(surname)` | Get crest by surname | Required |

#### Admin

| Query | Description | Auth |
|-------|-------------|------|
| `me` | Current user info | Required |
| `users` | List all users | Admin |
| `invitations` | List invitations | Admin |
| `siteSettings` | Site configuration | Public |
| `settings` | All settings | Admin |
| `migrationStatus` | Database migration status | Admin |
| `emailLogs(limit, offset)` | Email history | Admin |
| `emailStats` | Email statistics | Admin |
| `myEmailPreferences` | User's email prefs | Required |

#### Export

| Query | Description | Auth |
|-------|-------------|------|
| `exportGedcom(includeLiving, includeSources)` | Export to GEDCOM format | Admin |

### Mutations

#### Person Management

```graphql
# Create person
mutation {
  createPerson(input: {
    name_full: "John Smith"
    name_given: "John"
    name_surname: "Smith"
    sex: "M"
    birth_year: 1950
    living: true
  }) {
    id
    name_full
  }
}

# Update person
mutation {
  updatePerson(id: "abc123", input: {
    death_year: 2020
    living: false
  }) {
    id
  }
}

# Delete person
mutation {
  deletePerson(id: "abc123")
}
```

#### Family Management

```graphql
# Create family (marriage)
mutation {
  createFamily(input: {
    husband_id: "person1"
    wife_id: "person2"
    marriage_year: 1975
    marriage_place: "New York, NY"
  }) {
    id
  }
}

# Add child to family
mutation {
  addChildToFamily(familyId: "fam1", personId: "child1")
}
```

#### Research Sources

```graphql
mutation {
  addSource(personId: "abc123", input: {
    action: "found"
    source_type: "Census"
    source_name: "1940 US Census"
    source_url: "https://familysearch.org/..."
    content: "Found in household of..."
    confidence: "high"
  }) {
    id
  }
}
```

#### Life Events

```graphql
mutation {
  addLifeEvent(personId: "abc123", input: {
    event_type: "residence"
    event_year: 1920
    event_place: "Chicago, IL"
  }) {
    id
  }
}
```

#### Admin Mutations

| Mutation | Description | Auth |
|----------|-------------|------|
| `createInvitation(email, role)` | Invite user | Admin |
| `createLocalUser(email, name, role, password)` | Create local user | Admin |
| `createServiceAccount(name, description, role)` | Create service account | Admin |
| `updateUserRole(userId, role)` | Change user role | Admin |
| `deleteUser(userId)` | Delete user | Admin |
| `updateSettings(input)` | Update site settings | Admin |
| `runMigrations` | Run DB migrations | Admin |
| `importGedcom(content)` | Import GEDCOM file | Admin |

#### User Mutations

| Mutation | Description | Auth |
|----------|-------------|------|
| `generateApiKey` | Generate personal API key | Required |
| `revokeApiKey` | Revoke API key | Required |
| `changePassword(currentPassword, newPassword)` | Change password | Required |
| `updateEmailPreferences(input)` | Update email prefs | Required |

---

## REST Endpoints

### Health Check

```
GET /api/health
GET /api/health?db=true
```

**Response:**
```json
{
  "status": "ok",
  "database": "genealogy",
  "time": "2024-01-15T10:30:00Z",
  "ssl": "enabled"
}
```

### Setup Status

```
GET /api/setup/status
```

**Response:**
```json
{
  "configured": true,
  "database": {
    "connected": true,
    "tablesExist": true
  },
  "auth": {
    "configured": true,
    "googleClientId": true,
    "googleClientSecret": true,
    "nextAuthSecret": true
  },
  "admin": {
    "exists": true,
    "email": "admin@example.com"
  }
}
```

### Email Configuration (Admin)

```
GET /api/email-config
```

**Headers:** Requires admin session

**Response:**
```json
{
  "configured": true,
  "type": "smtp",
  "details": "SMTP (smtp.gmail.com:587)"
}
```

### Media Upload (Editor+)

```
POST /api/media/upload
Content-Type: multipart/form-data
```

**Form Fields:**
- `file`: Image or document file
- `personId`: Person to attach media to
- `mediaType`: "photo" | "document"
- `caption`: Optional caption

---

## Types Reference

### Person

| Field | Type | Description |
|-------|------|-------------|
| `id` | ID! | Unique identifier |
| `name_full` | String! | Full display name |
| `name_given` | String | First/given name |
| `name_surname` | String | Last/family name |
| `sex` | String | "M", "F", or null |
| `birth_date` | String | Birth date (various formats) |
| `birth_year` | Int | Birth year |
| `birth_place` | String | Birth location |
| `death_date` | String | Death date |
| `death_year` | Int | Death year |
| `death_place` | String | Death location |
| `living` | Boolean! | Is person living |
| `description` | String | Biography/notes |
| `research_status` | String | "not_started", "in_progress", "complete" |
| `research_priority` | Int | 1-5 priority |
| `parents` | [Person!]! | Parent persons |
| `children` | [Person!]! | Child persons |
| `spouses` | [Person!]! | Spouse persons |
| `lifeEvents` | [LifeEvent!]! | Life events |
| `sources` | [Source!]! | Research sources |
| `media` | [Media!]! | Photos/documents |

### Family

| Field | Type | Description |
|-------|------|-------------|
| `id` | ID! | Unique identifier |
| `husband_id` | String | Husband person ID |
| `wife_id` | String | Wife person ID |
| `husband` | Person | Husband details |
| `wife` | Person | Wife details |
| `children` | [Person!]! | Children |
| `marriage_date` | String | Marriage date |
| `marriage_year` | Int | Marriage year |
| `marriage_place` | String | Marriage location |

### Source

| Field | Type | Description |
|-------|------|-------------|
| `id` | String! | Unique identifier |
| `action` | String! | "found", "searched", "verified" |
| `source_type` | String | Census, Vital Record, etc. |
| `source_name` | String | Source title |
| `source_url` | String | URL to source |
| `content` | String | Notes/findings |
| `confidence` | String | "high", "medium", "low" |

### LifeEvent

| Field | Type | Description |
|-------|------|-------------|
| `id` | Int! | Unique identifier |
| `event_type` | String! | "residence", "occupation", etc. |
| `event_date` | String | Event date |
| `event_year` | Int | Event year |
| `event_place` | String | Event location |
| `event_value` | String | Additional value |

---

## Roles & Permissions

| Role | Permissions |
|------|-------------|
| `viewer` | Read-only access to people and families |
| `editor` | Can create/edit people, families, sources |
| `admin` | Full access including user management |
| `service` | API-only access (no UI login) |

---

## Error Handling

GraphQL errors return in standard format:

```json
{
  "errors": [
    {
      "message": "Not authorized",
      "extensions": {
        "code": "UNAUTHORIZED"
      }
    }
  ],
  "data": null
}
```

Common error codes:
- `UNAUTHORIZED` - Not logged in
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource doesn't exist
- `BAD_REQUEST` - Invalid input

---

## Rate Limiting

Currently no rate limiting is enforced. For high-volume usage, consider implementing caching or pagination.

---

## Examples

### Get Person with Family

```graphql
query GetPersonDetails($id: ID!) {
  person(id: $id) {
    id
    name_full
    birth_year
    death_year
    parents {
      id
      name_full
    }
    children {
      id
      name_full
    }
    spouses {
      id
      name_full
    }
  }
}
```

### Search People

```graphql
query SearchPeople($query: String!) {
  search(query: $query, first: 10) {
    edges {
      node {
        id
        name_full
        birth_year
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

### Get Stats

```graphql
query {
  stats {
    total_people
    total_families
    living_count
    male_count
    female_count
  }
}
```

