"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/services";

export interface ProfileState {
  error: string | null;
  saved: boolean;
}

export async function updateProfileAction(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Enter your name.", saved: false };
  try {
    await api.user.updateProfile({ name });
  } catch {
    return { error: "We couldn't save your profile.", saved: false };
  }
  revalidatePath("/app", "layout");
  return { error: null, saved: true };
}
