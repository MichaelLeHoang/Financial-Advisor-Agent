"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { Camera, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getAvatarColor, getAvatarInitials } from "@/lib/avatar";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import { Card } from "@/components/ui/card";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export default function EditProfileModal({ isOpen, onClose }: EditProfileModalProps) {
  const { user, updateProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const originalDisplayName = useRef("");
  const originalUsername = useRef("");

  useEffect(() => {
    if (isOpen && user && !user.is_guest) {
      const dn = user.display_name || "";
      const un = user.username || user.email?.split("@")[0] || "";
      setDisplayName(dn);
      setUsername(un);
      setAvatarUrl(user.avatar_url || null);
      setAvatarPreview(user.avatar_url || null);
      setAvatarFile(null);
      setError(null);
      setSuccess(false);
      originalDisplayName.current = dn;
      originalUsername.current = un;

      if (isSupabaseConfigured()) {
        const supabase = getSupabaseBrowserClient();
        supabase.auth.getUser().then(({ data }) => {
          const meta = data.user?.user_metadata;
          if (meta) {
            if (meta.display_name) {
              setDisplayName(meta.display_name);
              originalDisplayName.current = meta.display_name;
            }
            if (meta.username) {
              setUsername(meta.username);
              originalUsername.current = meta.username;
            }
            if (meta.avatar_url) {
              setAvatarUrl(meta.avatar_url);
              setAvatarPreview(meta.avatar_url);
            }
          }
        });
      }
    }
  }, [isOpen, user?.id]);

  const handleAvatarChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
      setError("Please select a JPG, PNG, WebP, or GIF image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be smaller than 2 MB.");
      return;
    }

    setAvatarFile(file);
    setError(null);

    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  const handleSave = async () => {
    if (!isSupabaseConfigured()) return;
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const supabase = getSupabaseBrowserClient();
      let finalAvatarUrl = avatarUrl;

      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop() || "png";
        const filePath = `${user.id}/${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, avatarFile, { upsert: true, contentType: avatarFile.type });

        if (uploadError) {
          console.warn("Avatar upload failed, using data URL:", uploadError.message);
          finalAvatarUrl = avatarPreview;
        } else {
          const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
          finalAvatarUrl = urlData.publicUrl;
        }
      }

      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          display_name: displayName.trim() || null,
          full_name: displayName.trim() || null,
          username: username.trim() || null,
          avatar_url: finalAvatarUrl,
        },
      });

      if (updateError) throw updateError;

      const nextDisplayName = displayName.trim() || null;
      const nextUsername = username.trim() || null;
      updateProfile({
        display_name: nextDisplayName,
        username: nextUsername,
        avatar_url: finalAvatarUrl,
      });
      setAvatarUrl(finalAvatarUrl);
      setAvatarPreview(finalAvatarUrl);
      originalDisplayName.current = nextDisplayName || "";
      originalUsername.current = nextUsername || "";
      setAvatarFile(null);
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const initials = getAvatarInitials(displayName || user?.display_name, user?.email);
  const avatarBg = getAvatarColor(user?.id || user?.email);
  const hasChanges =
    displayName !== originalDisplayName.current ||
    username !== originalUsername.current ||
    avatarFile !== null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-lg"
      >
        <Card className="rounded-2xl border border-white/[0.08] bg-[#1a1a1e] px-6 pb-6 pt-5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.5)] sm:px-8 sm:pb-4 sm:pt-4">
          <h2 className="text-xl font-semibold text-white/90 sm:text-2xl">Edit profile</h2>

          {/* Avatar */}
          <div className="flex justify-center">
            <div className="relative">
              <div
                className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full text-3xl font-semibold text-white shadow-[0_0_0_4px_rgba(0,0,0,0.3)] sm:h-32 sm:w-32 sm:text-4xl"
                style={{ backgroundColor: avatarBg }}
              >
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Avatar"
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#1a1a1e] bg-[#2a2a2e] text-white/70 shadow-lg transition-colors hover:bg-[#3a3a3e] hover:text-white"
                aria-label="Change avatar"
              >
                <Camera className="h-4 w-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleAvatarChange}
              />
            </div>
          </div>

          {/* Form fields */}
          <div className=" space-y-2">
            <div className="group rounded-xl border border-white/[0.1] bg-transparent px-4 pb-2.5 pt-2 transition-colors focus-within:border-white/[0.25]">
              <label className="block text-xs font-medium text-white/45">Display name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your display name"
                className="mt-0.5 w-full border-0 bg-transparent p-0 text-base font-medium text-white/90 placeholder:text-white/20 focus:outline-none focus:ring-0"
                maxLength={64}
              />
            </div>

            <div className="group rounded-xl border border-white/[0.1] bg-transparent px-4 pb-2.5 pt-2 transition-colors focus-within:border-white/[0.25]">
              <label className="block text-xs font-medium text-white/45">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
                placeholder="your_username"
                className="mt-0.5 w-full border-0 bg-transparent p-0 text-base font-medium text-white/90 placeholder:text-white/20 focus:outline-none focus:ring-0"
                maxLength={32}
              />
            </div>
          </div>

          <p className="text-center text-sm italic text-white/30">
            Customize your profile to your liking.
          </p>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 text-center text-sm text-red-400"
              >
                {error}
              </motion.p>
            )}
            {success && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 text-center text-sm text-green-400"
              >
                Profile updated!
              </motion.p>
            )}
          </AnimatePresence>

          <div className=" flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="h-10 rounded-full px-6 text-sm font-semibold text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="flex h-10 items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-black transition-all hover:bg-white/90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
