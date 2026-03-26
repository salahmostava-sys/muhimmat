import { supabase } from '@/integrations/supabase/client';
import { throwIfError } from '@/services/serviceError';
import { authService } from '@/services/authService';

export const profileService = {
  getProfile: async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('name, avatar_url')
      .eq('id', userId)
      .single();
    throwIfError(error, 'profileService.getProfile');
    return { data, error: null };
  },

  getProfileName: async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', userId)
      .maybeSingle();
    throwIfError(error, 'profileService.getProfileName');
    return { data, error: null };
  },

  uploadAvatar: async (userId: string, file: File) => {
    const ext = file.name.split('.').pop();
    const path = `${userId}/avatar.${ext}`;
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true });
    throwIfError(error, 'profileService.uploadAvatar');
    return { data, error: null };
  },

  getAvatarPublicUrl: (path: string) => {
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return data.publicUrl;
  },

  updateProfile: async (userId: string, payload: { name: string; avatar_url: string }) => {
    const { error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', userId);
    throwIfError(error, 'profileService.updateProfile');
    return { error: null };
  },

  updatePassword: async (password: string) => {
    const { error } = await authService.updatePassword(password);
    throwIfError(error, 'profileService.updatePassword');
    return { error: null };
  },
};
