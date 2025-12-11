// GraphQL Mutation type definitions

export const mutationTypes = `
  # ===========================================
  # MUTATIONS
  # ===========================================

  type Mutation {
    # Person mutations
    createPerson(input: PersonInput!): Person!
    updatePerson(id: ID!, input: PersonInput!): Person
    deletePerson(id: ID!): Boolean!

    # Life event mutations (requires editor role)
    addLifeEvent(personId: ID!, input: LifeEventInput!): LifeEvent!
    updateLifeEvent(id: Int!, input: LifeEventInput!): LifeEvent
    deleteLifeEvent(id: Int!): Boolean!

    # Fact mutations (requires editor role)
    addFact(personId: ID!, input: FactInput!): Fact!
    updateFact(id: Int!, input: FactInput!): Fact
    deleteFact(id: Int!): Boolean!

    # Family mutations (requires editor role)
    createFamily(input: FamilyInput!): Family!
    updateFamily(id: ID!, input: FamilyInput!): Family
    deleteFamily(id: ID!): Boolean!
    addChildToFamily(familyId: ID!, personId: ID!): Boolean!
    removeChildFromFamily(familyId: ID!, personId: ID!): Boolean!

    # High-level family mutations (Issue #283 - streamlined UI)
    addSpouse(personId: ID!, spouseId: ID!, marriageDate: String, marriageYear: Int, marriagePlace: String): Family!
    addChild(personId: ID!, childId: ID!, otherParentId: ID): Family!
    removeSpouse(personId: ID!, spouseId: ID!): Boolean!
    removeChild(personId: ID!, childId: ID!): Boolean!

    # Create and add in one step (Issue #287 - dual-mode)
    createAndAddSpouse(personId: ID!, newPerson: PersonInput!, marriageDate: String, marriageYear: Int, marriagePlace: String, skipDuplicateCheck: Boolean): CreateAndAddResult!
    createAndAddChild(personId: ID!, newPerson: PersonInput!, otherParentId: ID, skipDuplicateCheck: Boolean): CreateAndAddResult!

    # Source mutations (requires editor role)
    addSource(personId: ID!, input: SourceInput!): Source!
    updateSource(id: ID!, input: SourceInput!): Source
    deleteSource(id: ID!): Boolean!
    updateResearchStatus(personId: ID!, status: String!): Person
    updateResearchPriority(personId: ID!, priority: Int!): Person

    # Surname crest mutations (requires editor role)
    setSurnameCrest(surname: String!, coatOfArms: String!, description: String, origin: String, motto: String, blazon: String, sourceUrl: String): SurnameCrest
    updateSurnameCrest(id: ID!, input: SurnameCrestInput!): SurnameCrest
    removeSurnameCrest(surname: String!): Boolean

    # Person coat of arms override (requires editor role)
    setPersonCoatOfArms(personId: ID!, coatOfArms: String!): String
    removePersonCoatOfArms(personId: ID!): Boolean

    # Admin mutations (requires admin role)
    createInvitation(email: String!, role: String!): Invitation
    deleteInvitation(id: ID!): Boolean
    createLocalUser(email: String!, name: String!, role: String!, password: String!, requirePasswordChange: Boolean): User!
    updateUserRole(userId: ID!, role: String!): User
    linkUserToPerson(userId: ID!, personId: ID): User
    deleteUser(userId: ID!): Boolean

    # Service account mutations (requires admin role)
    createServiceAccount(name: String!, description: String, role: String!): ServiceAccountResult!
    revokeServiceAccount(userId: ID!): Boolean!

    # Settings mutations (requires admin role)
    updateSettings(input: SettingsInput!): SiteSettings!
    runMigrations: MigrationResult!
    testEmail(recipientEmail: String): EmailTestResult!

    # Client error mutations (admin only)
    deleteClientError(id: ID!): Boolean!
    clearAllClientErrors: Boolean!
    testStorage: StorageTestResult!

    # User profile mutations (current user)
    setMyPerson(personId: ID): User

    # API Key mutations (user can manage their own key)
    generateApiKey: String!
    revokeApiKey: Boolean!

    # Email preferences mutations (current user)
    updateEmailPreferences(input: EmailPreferencesInput!): EmailPreferences!

    # Local auth mutations (public - no auth required)
    registerWithInvitation(token: String!, password: String!, name: String): AuthResult!
    requestPasswordReset(email: String!): Boolean!
    resetPassword(token: String!, newPassword: String!): AuthResult!
    changePassword(currentPassword: String!, newPassword: String!): Boolean!

    # GEDCOM import (requires admin role)
    importGedcom(content: String!): GedcomImportResult!

    # Media mutations (requires editor role)
    uploadMedia(personId: ID!, input: MediaInput!): Media!
    updateMedia(id: ID!, input: MediaUpdateInput!): Media
    deleteMedia(id: ID!): Boolean!

    # Comment mutations (Issue #181 - Phase 1)
    addComment(personId: ID!, content: String!, parentCommentId: ID): Comment!
    updateComment(id: ID!, content: String!): Comment
    deleteComment(id: ID!): Boolean!
  }
`;
