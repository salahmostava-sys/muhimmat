import { authService as coreAuthService } from "../../services/authService";

export type { AppRole, UserProfile } from "../../services/authService";

export const authService = {
  signIn: async (email: string, password: string) => {
    const data = await coreAuthService.signIn(email, password);
    return { data, error: null };
  },
  signOut: async () => {
    await coreAuthService.signOut();
    return { error: null };
  },
  getSession: async () => {
    const session = await coreAuthService.getSession();
    return { session, error: null };
  },
  getCurrentUser: async () => {
    const user = await coreAuthService.getCurrentUser();
    return { user, error: null };
  },
  fetchUserRole: coreAuthService.fetchUserRole,
  fetchIsActive: coreAuthService.fetchIsActive,
  fetchProfile: coreAuthService.fetchProfile,
  updatePassword: async (newPassword: string) => {
    await coreAuthService.updatePassword(newPassword);
    return { data: null, error: null };
  },
  sendPasswordReset: async (email: string) => {
    await coreAuthService.sendPasswordReset(email);
    return { data: null, error: null };
  },
  refreshSession: async () => {
    const data = await coreAuthService.refreshSession();
    return { data, error: null };
  },
  onAuthStateChange: coreAuthService.onAuthStateChange,
  subscribeToProfileActiveChanges: coreAuthService.subscribeToProfileActiveChanges,
  removeRealtimeChannel: coreAuthService.removeRealtimeChannel,
  revokeSession: async (userId: string | null) => {
    await coreAuthService.revokeSession(userId);
    return { error: null };
  },
};
