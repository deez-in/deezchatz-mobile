import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import { Contact, ContactField } from "expo-contacts";

import { apiRequest } from "@/src/clients/apiClient";
import { Message } from "@/src/models/db";
import { PreKeyBundle } from "@/src/models/crypto";
import { reportUser } from "@/src/utils/api/user";
import {
  acknowledgeKeyChange,
  blockContact,
  getContactByPhone,
  getContactByUserId,
  getContactInfo,
  isContactBlocked,
  unblockContact,
} from "@/src/utils/db";
import { syncContactBundle } from "@/src/utils/network/sync/bundleSync";
import { syncDeviceContacts } from "@/src/utils/network/sync/contactSync";

export interface UseContactIdentityOptions {
  userId: string;
  id?: string;
  initialName?: string;
  resolvedUUID: string | null;
  setResolvedUUID: (uuid: string) => void;
  chatMessages: Message[];
}

export function useContactIdentity({
  userId,
  id,
  initialName,
  resolvedUUID,
  setResolvedUUID,
  chatMessages,
}: UseContactIdentityOptions) {
  const [name, setName] = useState<string>(initialName || "");
  const [picture, setPicture] = useState<string | null>(null);
  const [showKeyChangeBanner, setShowKeyChangeBanner] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showBlockSheet, setShowBlockSheet] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const resolveIdentity = async () => {
      if (resolvedUUID) {
        const info = await getContactInfo(resolvedUUID);
        if (info && isMounted) {
          if (info.name) setName(info.name);
          if (info.picture) setPicture(info.picture);

          if (info.identity_key_changed === 1) {
            setShowKeyChangeBanner(true);
          }
        }

        // 1. Local contact sync
        syncDeviceContacts(true)
          .then(async () => {
            if (!isMounted) return;
            const updated = await getContactInfo(resolvedUUID);
            if (isMounted && updated?.name) {
              setName(updated.name);
            }
          })
          .catch((e) => console.warn("[Chat] Local contact sync failed:", e));

        // 2. Online bundle sync
        syncContactBundle(resolvedUUID)
          .then((result) => {
            if (!isMounted || !result) return;
            if (result.keyChanged) setShowKeyChangeBanner(true);
            if (result.pictureChanged) {
              getContactInfo(resolvedUUID).then((updated) => {
                if (isMounted && updated?.picture) setPicture(updated.picture);
              });
            }
          })
          .catch((e) => console.warn("[Chat] Online bundle sync failed:", e));

        if (!info?.name && initialName) {
          if (isMounted) setName(initialName);
        }

        return;
      }

      if (id) {
        try {
          const contact = new Contact(id.split("/")[0]);
          const details = await contact.getDetails([ContactField.FULL_NAME]);
          if (isMounted && details) {
            setName(details.fullName || "");
          }
        } catch (e) {
          console.warn("Failed to fetch contact by device ID:", e);
        }
      } else {
        const isPhone = userId.startsWith("+") || /^\d+$/.test(userId);
        if (isPhone) {
          if (isMounted) setName(userId);
        } else if (resolvedUUID) {
          const phone = await getContactByUserId(resolvedUUID);
          if (isMounted) setName(phone || userId);
        }
      }
    };

    resolveIdentity();
    return () => {
      isMounted = false;
    };
  }, [id, userId, resolvedUUID, initialName]);

  useEffect(() => {
    let isMounted = true;
    const checkBlocked = async () => {
      const targetId = resolvedUUID || userId;
      if (targetId) {
        const blocked = await isContactBlocked(targetId);
        if (isMounted) {
          setIsBlocked(blocked);
        }
      }
    };
    checkBlocked();
    return () => {
      isMounted = false;
    };
  }, [resolvedUUID, userId]);

  const handleConfirmBlock = useCallback(
    async (shouldReport: boolean) => {
      const targetId = resolvedUUID || userId;
      if (!targetId) return;

      await blockContact(targetId);
      if (resolvedUUID && resolvedUUID !== targetId) {
        await blockContact(resolvedUUID);
      }
      setIsBlocked(true);

      if (shouldReport) {
        try {
          let reportTargetUUID: string | null | undefined = resolvedUUID;
          if (!reportTargetUUID) {
            const isPhone = userId.startsWith("+") || /^\d+$/.test(userId);
            if (isPhone) {
              reportTargetUUID = await getContactByPhone(userId);
            } else {
              reportTargetUUID = userId;
            }
          }

          if (!reportTargetUUID) {
            try {
              const bundle = await apiRequest<PreKeyBundle>(
                `/bundle/${encodeURIComponent(userId)}`,
                { method: "POST", authenticated: true }
              );
              if (bundle?.userId) {
                reportTargetUUID = bundle.userId;
                setResolvedUUID(bundle.userId);
              }
            } catch (e) {
              console.warn("Could not fetch bundle to resolve UUID for report:", e);
            }
          }

          if (!reportTargetUUID) {
            Alert.alert("Report Failed", "Could not resolve user ID to submit report.");
          } else {
            await reportUser(reportTargetUUID, chatMessages);
            Alert.alert(
              "Report Submitted",
              "Thank you for reporting. Our team will review the messages."
            );
          }
        } catch (err: any) {
          console.error("Failed to report user:", err);
          Alert.alert(
            "Report Failed",
            err?.message || "Failed to submit report. Please try again."
          );
        }
      }
    },
    [resolvedUUID, userId, chatMessages, setResolvedUUID]
  );

  const handleUnblock = useCallback(async () => {
    const targetId = resolvedUUID || userId;
    if (!targetId) return;

    await unblockContact(targetId);
    setIsBlocked(false);
  }, [resolvedUUID, userId]);

  const dismissKeyChangeBanner = useCallback(() => {
    setShowKeyChangeBanner(false);
    if (resolvedUUID) {
      acknowledgeKeyChange(resolvedUUID).catch(() => {});
    }
  }, [resolvedUUID]);

  return {
    name,
    picture,
    isBlocked,
    showBlockSheet,
    setShowBlockSheet,
    showKeyChangeBanner,
    dismissKeyChangeBanner,
    handleConfirmBlock,
    handleUnblock,
  };
}

export default useContactIdentity;
