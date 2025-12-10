import {
  clearEmailConfigCache,
  getEmailConfig,
  sendInviteEmail,
  sendTestEmail,
  verifyEmailForSandbox,
} from '../../email';
import {
  getMigrationStatus,
  runMigrations as runMigrationsFromModule,
} from '../../migrations';
import { pool } from '../../pool';
import {
  clearSettingsCache,
  getSettings,
  type SiteSettings,
} from '../../settings';
import { resetStorageConfig, testStorage } from '../../storage';
import {
  createInvitation,
  deleteInvitation,
  deleteUser,
  getInvitations,
  getUsers,
  linkUserToPerson,
  logAudit,
  updateUserRole,
} from '../../users';
import { type Context, requireAuth } from './helpers';

export const adminResolvers = {
  Query: {
    me: async (_: unknown, __: unknown, context: Context) => {
      const user = requireAuth(context);
      const { rows } = await pool.query(
        'SELECT id, email, name, role, created_at, last_login, last_accessed, api_key FROM users WHERE id = $1',
        [user.id],
      );
      return rows[0] || null;
    },

    // Admin queries,
    users: async (_: unknown, __: unknown, context: Context) => {
      requireAuth(context, 'admin');
      return getUsers();
    },
    invitations: async (_: unknown, __: unknown, context: Context) => {
      requireAuth(context, 'admin');
      return getInvitations();
    },

    // Surname crests (coat of arms by surname),
    siteSettings: async (): Promise<SiteSettings> => {
      return getSettings();
    },
    settings: async (_: unknown, __: unknown, context: Context) => {
      requireAuth(context, 'admin');
      try {
        const { rows } = await pool.query(
          'SELECT key, value, description, category, updated_at FROM settings ORDER BY category, key',
        );
        return rows;
      } catch (error) {
        // Table might not exist
        if ((error as { code?: string }).code === '42P01') {
          return [];
        }
        throw error;
      }
    },
    migrationStatus: async (_: unknown, __: unknown, context: Context) => {
      requireAuth(context, 'admin');
      const status = await getMigrationStatus(pool);
      const { rows } = await pool.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);
      const requiredTables = [
        'people',
        'families',
        'children',
        'users',
        'settings',
      ];
      const existingTables = rows.map(
        (r: { table_name: string }) => r.table_name,
      );
      const missingTables = requiredTables.filter(
        (t) => !existingTables.includes(t),
      );
      return {
        tables: existingTables,
        missingTables,
        migrationNeeded: missingTables.length > 0 || status.pendingCount > 0,
        currentVersion: status.currentVersion,
        latestVersion: status.latestVersion,
        pendingMigrations: status.pendingCount,
        appliedMigrations: status.appliedMigrations,
      };
    },

    // Email queries (admin only),
    emailLogs: async (
      _: unknown,
      { limit = 50, offset = 0 }: { limit?: number; offset?: number },
      context: Context,
    ) => {
      requireAuth(context, 'admin');
      const { rows } = await pool.query(
        'SELECT id, email_type, recipient, subject, success, error_message, sent_at FROM email_log ORDER BY sent_at DESC LIMIT $1 OFFSET $2',
        [limit, offset],
      );
      return rows;
    },
    emailStats: async (_: unknown, __: unknown, context: Context) => {
      requireAuth(context, 'admin');
      const totals = await pool.query(`
        SELECT
          COUNT(*) as total_sent,
          COUNT(*) FILTER (WHERE success = true) as successful,
          COUNT(*) FILTER (WHERE success = false) as failed
        FROM email_log
      `);
      const byType = await pool.query(`
        SELECT email_type, COUNT(*) as count
        FROM email_log
        GROUP BY email_type
        ORDER BY count DESC
      `);
      return {
        total_sent: parseInt(totals.rows[0].total_sent, 10) || 0,
        successful: parseInt(totals.rows[0].successful, 10) || 0,
        failed: parseInt(totals.rows[0].failed, 10) || 0,
        by_type: byType.rows,
      };
    },

    // Email preferences (current user),
    myEmailPreferences: async (_: unknown, __: unknown, context: Context) => {
      const user = requireAuth(context);
      const { rows } = await pool.query(
        'SELECT user_id, research_updates, tree_changes, weekly_digest, birthday_reminders FROM email_preferences WHERE user_id = $1',
        [user.id],
      );
      return rows[0] || null;
    },

    // Client errors (admin only)
    clientErrors: async (
      _: unknown,
      { limit = 50, offset = 0 }: { limit?: number; offset?: number },
      context: Context,
    ) => {
      requireAuth(context, 'admin');
      const { rows } = await pool.query(
        `SELECT id, user_id, error_message, stack_trace, url, user_agent, component_stack, error_info, created_at
         FROM client_errors
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      );
      return rows;
    },

    clientErrorStats: async (_: unknown, __: unknown, context: Context) => {
      requireAuth(context, 'admin');
      const stats = await pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24_hours,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last_7_days,
          COUNT(DISTINCT error_message) as unique_errors
        FROM client_errors
      `);
      return {
        total: parseInt(stats.rows[0].total, 10) || 0,
        last24Hours: parseInt(stats.rows[0].last_24_hours, 10) || 0,
        last7Days: parseInt(stats.rows[0].last_7_days, 10) || 0,
        uniqueErrors: parseInt(stats.rows[0].unique_errors, 10) || 0,
      };
    },

    // GEDCOM export,
  },
  Mutation: {
    createInvitation: async (
      _: unknown,
      { email, role }: { email: string; role: string },
      context: Context,
    ) => {
      const user = requireAuth(context, 'admin');

      const invitation = await createInvitation(email, role, user.id);
      await logAudit(user.id, 'create_invitation', { email, role });

      // Generate invitation URL
      const inviteUrl = `${process.env.NEXTAUTH_URL}/login?invite=${invitation.token}`;

      // Verify email for SES sandbox mode
      await verifyEmailForSandbox(email);

      // Send invite email
      try {
        await sendInviteEmail({
          to: email,
          inviteUrl,
          role,
          inviterName: user.email,
          inviterEmail: user.email,
        });
      } catch (error) {
        console.error('Failed to send invite email:', error);
      }

      return invitation;
    },
    deleteInvitation: async (
      _: unknown,
      { id }: { id: string },
      context: Context,
    ) => {
      const user = requireAuth(context, 'admin');
      await deleteInvitation(id);
      await logAudit(user.id, 'delete_invitation', { invitationId: id });
      return true;
    },
    updateUserRole: async (
      _: unknown,
      { userId, role }: { userId: string; role: string },
      context: Context,
    ) => {
      const user = requireAuth(context, 'admin');

      // Prevent removing own admin rights
      if (userId === user.id && role !== 'admin') {
        throw new Error('Cannot demote yourself');
      }

      await updateUserRole(userId, role);
      await logAudit(user.id, 'update_user_role', {
        targetUserId: userId,
        newRole: role,
      });

      // Return updated user
      const users = await getUsers();
      return users.find((u) => u.id === userId);
    },
    linkUserToPerson: async (
      _: unknown,
      { userId, personId }: { userId: string; personId: string | null },
      context: Context,
    ) => {
      const user = requireAuth(context, 'admin');

      await linkUserToPerson(userId, personId);
      await logAudit(user.id, 'link_user_to_person', {
        targetUserId: userId,
        personId: personId,
      });

      // Return updated user
      const users = await getUsers();
      return users.find((u) => u.id === userId);
    },
    deleteUser: async (
      _: unknown,
      { userId }: { userId: string },
      context: Context,
    ) => {
      const user = requireAuth(context, 'admin');

      // Prevent self-deletion
      if (userId === user.id) {
        throw new Error('Cannot delete yourself');
      }

      await deleteUser(userId);
      await logAudit(user.id, 'delete_user', { deletedUserId: userId });
      return true;
    },

    // Surname crest mutations,
    updateSettings: async (
      _: unknown,
      { input }: { input: Record<string, string | null> },
      context: Context,
    ) => {
      const user = requireAuth(context, 'admin');
      const entries = Object.entries(input).filter(([, v]) => v !== undefined);
      for (const [key, value] of entries) {
        await pool.query(
          `INSERT INTO settings (key, value, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
          [key, value],
        );
      }
      clearSettingsCache();

      // Clear email config cache if email settings were updated
      const emailKeys = entries.filter(([key]) => key.startsWith('email_'));
      if (emailKeys.length > 0) {
        clearEmailConfigCache();
      }

      // Clear storage config cache if storage settings were updated
      const storageKeys = entries.filter(([key]) => key.startsWith('storage_'));
      if (storageKeys.length > 0) {
        resetStorageConfig();
      }

      // Audit log
      await logAudit(user.id, 'update_settings', {
        settingsKeys: entries.map(([key]) => key),
        settingsCount: entries.length,
      });

      return getSettings();
    },
    runMigrations: async (_: unknown, __: unknown, context: Context) => {
      requireAuth(context, 'admin');
      return runMigrationsFromModule(pool);
    },
    testEmail: async (
      _: unknown,
      { recipientEmail }: { recipientEmail?: string },
      context: Context,
    ) => {
      const user = requireAuth(context, 'admin');

      // Get email config to check if configured
      const config = await getEmailConfig();
      if (!config.configured) {
        return {
          success: false,
          message:
            'Email is not configured. Please configure email settings first.',
          recipient: null,
        };
      }

      // Use provided email or current user's email
      const recipient = recipientEmail || user.email;

      try {
        // Send test email using the helper function
        const success = await sendTestEmail(recipient);

        if (success) {
          await logAudit(user.id, 'test_email', { recipient });
          return {
            success: true,
            message: `Test email sent successfully to ${recipient}`,
            recipient,
          };
        } else {
          return {
            success: false,
            message: `Failed to send test email to ${recipient}`,
            recipient,
          };
        }
      } catch (error) {
        console.error('[Email] Test email failed:', error);
        return {
          success: false,
          message: `Failed to send test email: ${(error as Error).message}`,
          recipient,
        };
      }
    },
    testStorage: async (_: unknown, __: unknown, context: Context) => {
      const user = requireAuth(context, 'admin');

      try {
        // Test storage by uploading and deleting a test file
        await testStorage();

        await logAudit(user.id, 'test_storage', {});

        // Get current storage config to return provider info
        const settings = await pool.query(
          `SELECT key, value FROM settings WHERE key = 'storage_provider'`,
        );
        const provider = settings.rows[0]?.value || 'local';

        return {
          success: true,
          message: `Storage test successful! ${provider === 's3' ? 'S3 bucket is accessible and writable.' : 'Local storage is working correctly.'}`,
          provider,
        };
      } catch (error) {
        console.error('[Storage] Test storage failed:', error);

        // Get current storage config to return provider info
        const settings = await pool.query(
          `SELECT key, value FROM settings WHERE key = 'storage_provider'`,
        );
        const provider = settings.rows[0]?.value || 'local';

        return {
          success: false,
          message: `Storage test failed: ${(error as Error).message}`,
          provider,
        };
      }
    },

    // User profile mutations - allow users to link themselves to a person,
    setMyPerson: async (
      _: unknown,
      { personId }: { personId: string | null },
      context: Context,
    ) => {
      const user = requireAuth(context);

      await linkUserToPerson(user.id, personId);
      await logAudit(user.id, 'set_my_person', { personId });

      const users = await getUsers();
      return users.find((u) => u.id === user.id);
    },

    // API Key mutations,
    generateApiKey: async (_: unknown, __: unknown, context: Context) => {
      const user = requireAuth(context);
      // Generate a secure random API key (64 hex characters)
      const crypto = await import('node:crypto');
      const apiKey = crypto.randomBytes(32).toString('hex');

      await pool.query('UPDATE users SET api_key = $1 WHERE id = $2', [
        apiKey,
        user.id,
      ]);
      await logAudit(user.id, 'generate_api_key', { userId: user.id });

      return apiKey;
    },
    revokeApiKey: async (_: unknown, __: unknown, context: Context) => {
      const user = requireAuth(context);
      await pool.query('UPDATE users SET api_key = NULL WHERE id = $1', [
        user.id,
      ]);
      await logAudit(user.id, 'revoke_api_key', { userId: user.id });
      return true;
    },

    // Email preferences mutation,
    updateEmailPreferences: async (
      _: unknown,
      {
        input,
      }: {
        input: {
          research_updates?: boolean;
          tree_changes?: boolean;
          weekly_digest?: boolean;
          birthday_reminders?: boolean;
        };
      },
      context: Context,
    ) => {
      const user = requireAuth(context);

      // Upsert preferences
      const { rows } = await pool.query(
        `
        INSERT INTO email_preferences (user_id, research_updates, tree_changes, weekly_digest, birthday_reminders, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          research_updates = COALESCE($2, email_preferences.research_updates),
          tree_changes = COALESCE($3, email_preferences.tree_changes),
          weekly_digest = COALESCE($4, email_preferences.weekly_digest),
          birthday_reminders = COALESCE($5, email_preferences.birthday_reminders),
          updated_at = NOW()
        RETURNING user_id, research_updates, tree_changes, weekly_digest, birthday_reminders
      `,
        [
          user.id,
          input.research_updates ?? true,
          input.tree_changes ?? false,
          input.weekly_digest ?? false,
          input.birthday_reminders ?? false,
        ],
      );

      return rows[0];
    },

    // Admin: Create local user directly (no invitation required),
    createLocalUser: async (
      _: unknown,
      {
        email,
        name,
        role,
        password,
        requirePasswordChange,
      }: {
        email: string;
        name: string;
        role: string;
        password: string;
        requirePasswordChange?: boolean;
      },
      context: Context,
    ) => {
      requireAuth(context, 'admin');
      const bcrypt = await import('bcryptjs');
      const crypto = await import('node:crypto');

      // Check if user already exists
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email],
      );
      if (existingUser.rows.length > 0) {
        throw new Error('User with this email already exists');
      }

      // Validate role
      if (!['admin', 'editor', 'viewer'].includes(role)) {
        throw new Error('Invalid role. Must be admin, editor, or viewer');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);
      const userId = crypto.randomBytes(8).toString('hex');

      // Create user
      const { rows } = await pool.query(
        `INSERT INTO users (id, email, name, role, password_hash, auth_provider, require_password_change, created_at, last_login)
         VALUES ($1, $2, $3, $4, $5, 'local', $6, NOW(), NULL)
         RETURNING id, email, name, role, created_at`,
        [
          userId,
          email,
          name,
          role,
          passwordHash,
          requirePasswordChange ?? false,
        ],
      );

      return rows[0];
    },

    // Service account mutations,
    createServiceAccount: async (
      _: unknown,
      {
        name,
        description,
        role,
      }: { name: string; description?: string; role: string },
      context: Context,
    ) => {
      requireAuth(context, 'admin');
      const crypto = await import('node:crypto');

      // Validate role (service accounts cannot be admin)
      if (!['editor', 'viewer'].includes(role)) {
        throw new Error(
          'Invalid role. Service accounts can only be editor or viewer',
        );
      }

      // Generate unique ID and API key
      const userId = crypto.randomBytes(8).toString('hex');
      const apiKey = crypto.randomBytes(32).toString('hex');

      // Create service account (no email, no password)
      const { rows } = await pool.query(
        `INSERT INTO users (id, email, name, role, account_type, description, api_key, auth_provider, created_at)
         VALUES ($1, $2, $3, $4, 'service', $5, $6, 'api', NOW())
         RETURNING id, email, name, role, account_type, description, created_at`,
        [
          userId,
          `service-${userId}@internal`,
          name,
          role,
          description || null,
          apiKey,
        ],
      );

      return { user: rows[0], apiKey };
    },
    revokeServiceAccount: async (
      _: unknown,
      { userId }: { userId: string },
      context: Context,
    ) => {
      requireAuth(context, 'admin');

      // Verify it's a service account
      const { rows } = await pool.query(
        'SELECT id FROM users WHERE id = $1 AND account_type = $2',
        [userId, 'service'],
      );

      if (rows.length === 0) {
        throw new Error('Service account not found');
      }

      // Delete the service account
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
      return true;
    },

    // Local auth mutations,
    registerWithInvitation: async (
      _: unknown,
      {
        token,
        password,
        name,
      }: { token: string; password: string; name?: string },
    ) => {
      const bcrypt = await import('bcryptjs');
      const crypto = await import('node:crypto');

      // Find valid invitation
      const invResult = await pool.query(
        `SELECT id, email, role FROM invitations
         WHERE token = $1 AND accepted_at IS NULL AND expires_at > NOW()`,
        [token],
      );

      if (invResult.rows.length === 0) {
        return { success: false, message: 'Invalid or expired invitation' };
      }

      const invitation = invResult.rows[0];

      // Check if user already exists
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [invitation.email],
      );
      if (existingUser.rows.length > 0) {
        return { success: false, message: 'User already exists' };
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);
      const userId = crypto.randomBytes(8).toString('hex');

      // Create user
      await pool.query(
        `INSERT INTO users (id, email, name, role, password_hash, auth_provider, invited_at, last_login)
         VALUES ($1, $2, $3, $4, $5, 'local', NOW(), NOW())`,
        [
          userId,
          invitation.email,
          name || invitation.email.split('@')[0],
          invitation.role,
          passwordHash,
        ],
      );

      // Mark invitation as accepted
      await pool.query(
        'UPDATE invitations SET accepted_at = NOW() WHERE id = $1',
        [invitation.id],
      );

      return { success: true, message: 'Account created successfully', userId };
    },
    requestPasswordReset: async (_: unknown, { email }: { email: string }) => {
      const crypto = await import('node:crypto');

      // Find user with local auth
      const userResult = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND auth_provider = $2',
        [email, 'local'],
      );

      // Always return true to prevent email enumeration
      if (userResult.rows.length === 0) {
        return true;
      }

      const user = userResult.rows[0];

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store token
      await pool.query(
        `INSERT INTO password_reset_tokens (user_id, token, expires_at)
         VALUES ($1, $2, $3)`,
        [user.id, resetToken, expiresAt],
      );

      // Send email (import dynamically to avoid circular deps)
      try {
        const { sendPasswordResetEmail } = await import('../../email');
        await sendPasswordResetEmail(email, resetToken);
      } catch (error) {
        console.error('[Auth] Failed to send password reset email:', error);
      }

      return true;
    },
    resetPassword: async (
      _: unknown,
      { token, newPassword }: { token: string; newPassword: string },
    ) => {
      const bcrypt = await import('bcryptjs');

      // Find valid token
      const tokenResult = await pool.query(
        `SELECT user_id FROM password_reset_tokens
         WHERE token = $1 AND expires_at > NOW() AND used_at IS NULL`,
        [token],
      );

      if (tokenResult.rows.length === 0) {
        return { success: false, message: 'Invalid or expired reset token' };
      }

      const userId = tokenResult.rows[0].user_id;

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, 12);

      // Update password
      await pool.query(
        'UPDATE users SET password_hash = $1, failed_login_attempts = 0, locked_until = NULL WHERE id = $2',
        [passwordHash, userId],
      );

      // Mark token as used
      await pool.query(
        'UPDATE password_reset_tokens SET used_at = NOW() WHERE token = $1',
        [token],
      );

      return { success: true, message: 'Password reset successfully', userId };
    },
    changePassword: async (
      _: unknown,
      {
        currentPassword,
        newPassword,
      }: { currentPassword: string; newPassword: string },
      context: Context,
    ) => {
      const user = requireAuth(context);
      const bcrypt = await import('bcryptjs');

      // Get current password hash
      const userResult = await pool.query(
        'SELECT password_hash FROM users WHERE id = $1 AND auth_provider = $2',
        [user.id, 'local'],
      );

      if (userResult.rows.length === 0 || !userResult.rows[0].password_hash) {
        throw new Error('Password change not available for this account');
      }

      // Verify current password
      const isValid = await bcrypt.compare(
        currentPassword,
        userResult.rows[0].password_hash,
      );
      if (!isValid) {
        throw new Error('Current password is incorrect');
      }

      // Hash and update new password
      const passwordHash = await bcrypt.hash(newPassword, 12);
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
        passwordHash,
        user.id,
      ]);

      return true;
    },

    // Client error mutations (admin only)
    deleteClientError: async (
      _: unknown,
      { id }: { id: string },
      context: Context,
    ) => {
      requireAuth(context, 'admin');
      await pool.query('DELETE FROM client_errors WHERE id = $1', [id]);
      return true;
    },

    clearAllClientErrors: async (_: unknown, __: unknown, context: Context) => {
      requireAuth(context, 'admin');
      await pool.query('DELETE FROM client_errors');
      return true;
    },

    // GEDCOM import,
  },
};
