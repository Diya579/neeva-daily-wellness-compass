import { createContext, useCallback, useContext, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { DEFAULT_COMPANION, type Companion } from "./companion";
import type { Goal } from "./neeva-data";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfilePatch = Database["public"]["Tables"]["profiles"]["Update"];

type Ctx = {
  userId: string;
  email: string;
  profile: Profile;
  companion: Companion;
  goal: Goal;
  saveProfile: (patch: ProfilePatch) => Promise<void>;
  saving: boolean;
};

const ProfileCtx = createContext<Ctx | null>(null);

async function loadProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (data) return data;
  // Older accounts may predate the signup trigger: create the row on first visit.
  const { data: created, error: insErr } = await supabase
    .from("profiles")
    .insert({ id: userId })
    .select("*")
    .single();
  if (insErr) throw insErr;
  return created;
}

export function ProfileProvider({
  userId,
  email,
  children,
  fallback,
}: {
  userId: string;
  email: string;
  children: ReactNode;
  fallback: ReactNode;
}) {
  const qc = useQueryClient();
  const key = ["profile", userId] as const;
  const { data: profile, error } = useQuery({ queryKey: key, queryFn: () => loadProfile(userId) });

  const mutation = useMutation({
    mutationFn: async (patch: ProfilePatch) => {
      const { data, error: e } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", userId)
        .select("*")
        .single();
      if (e) throw e;
      return data;
    },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Profile>(key);
      if (prev) qc.setQueryData<Profile>(key, { ...prev, ...(patch as Partial<Profile>) });
      return { prev };
    },
    onError: (_e, _p, ctx) => ctx?.prev && qc.setQueryData(key, ctx.prev),
    onSuccess: (data) => qc.setQueryData(key, data),
  });

  const saveProfile = useCallback(
    async (patch: ProfilePatch) => {
      await mutation.mutateAsync(patch);
    },
    [mutation],
  );

  if (error) throw error;
  if (!profile) return <>{fallback}</>;

  const companion: Companion = {
    name: profile.companion_name || DEFAULT_COMPANION.name,
    vibe: profile.companion_vibe as Companion["vibe"],
    length: profile.companion_length as Companion["length"],
    avatar: profile.companion_avatar as Companion["avatar"],
    emoji: profile.companion_emoji,
    approach: profile.companion_approach as Companion["approach"],
    tone: profile.companion_tone as Companion["tone"],
    notes: profile.companion_notes,
  };

  return (
    <ProfileCtx.Provider
      value={{
        userId,
        email,
        profile,
        companion,
        goal: profile.goal as Goal,
        saveProfile,
        saving: mutation.isPending,
      }}
    >
      {children}
    </ProfileCtx.Provider>
  );
}

/** Map companion settings onto profile columns. */
export const companionPatch = (c: Companion): ProfilePatch => ({
  companion_name: c.name,
  companion_vibe: c.vibe,
  companion_length: c.length,
  companion_avatar: c.avatar,
  companion_emoji: c.emoji,
  companion_approach: c.approach,
  companion_tone: c.tone,
  companion_notes: c.notes,
  companion_configured: true,
});

export function useProfile() {
  const ctx = useContext(ProfileCtx);
  if (!ctx) throw new Error("useProfile must be used inside ProfileProvider");
  return ctx;
}
