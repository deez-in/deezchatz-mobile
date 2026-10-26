import React from "react";
import { Alert } from "react-native";

import { act, fireEvent, render } from "@testing-library/react-native";

import ProfileScreen from "@/src/app/profile";
import { apiRequest } from "@/src/clients/apiClient";
import { DeleteAccountSheet } from "@/src/components/shared";
import type { DeleteAccountSheetProps } from "@/src/components/shared/DeleteAccountSheet";
import { ThemeProvider } from "@/src/hooks/useTheme";
import useSession from "@/src/store/useSession";
import { wipeAllDatabases } from "@/src/utils/db";

jest.mock("@/src/clients/apiClient", () => ({ apiRequest: jest.fn() }));
jest.mock("@/src/utils/db", () => ({ wipeAllDatabases: jest.fn() }));
jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
  MaterialCommunityIcons: () => null,
}));
jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    SafeAreaView: ({ children }: React.PropsWithChildren) => <View>{children}</View>,
  };
});
jest.mock("@/src/components/shared", () => {
  const { Pressable, Text } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    ContactAvatar: () => null,
    DeleteAccountSheet: jest.fn(({ isPresented, onConfirmDelete, isDeleting }: DeleteAccountSheetProps) => (
      isPresented ? (
        <Pressable testID="confirm-delete" onPress={onConfirmDelete}>
          <Text>{isDeleting ? "Deleting" : "Confirm deletion"}</Text>
        </Pressable>
      ) : null
    )),
  };
});

describe("ProfileScreen account deletion", () => {
  const clearSession = jest.fn<Promise<void>, []>();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(apiRequest).mockReset();
    clearSession.mockResolvedValue(undefined);
    jest.mocked(wipeAllDatabases).mockResolvedValue(undefined);
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    useSession.setState({
      isAuthenticated: true,
      userId: "test-user",
      deviceId: "test-device",
      googleOauthToken: "test-token",
      clearSession,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function openDeletionSheet() {
    const screen = await render(<ThemeProvider><ProfileScreen /></ThemeProvider>);
    await fireEvent.press(screen.getByText("Delete Profile"));
    return screen;
  }

  it("cleans up only after server confirmation", async () => {
    jest.mocked(apiRequest).mockResolvedValueOnce({ status: "success", message: "Account deleted" });
    const screen = await openDeletionSheet();

    await fireEvent.press(screen.getByTestId("confirm-delete"));

    expect(wipeAllDatabases).toHaveBeenCalledTimes(1);
    expect(clearSession).toHaveBeenCalledTimes(1);
    expect(jest.mocked(apiRequest).mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(wipeAllDatabases).mock.invocationCallOrder[0]
    );
    expect(jest.mocked(wipeAllDatabases).mock.invocationCallOrder[0]).toBeLessThan(
      clearSession.mock.invocationCallOrder[0]
    );
    expect(screen.queryByTestId("confirm-delete")).toBeNull();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it.each(["Server error", "Network error", "Request aborted", "Invalid JSON"])(
    "preserves local data and authentication on %s and permits retry",
    async (message) => {
      jest.mocked(apiRequest).mockRejectedValueOnce(new Error(message));
      const screen = await openDeletionSheet();

      await fireEvent.press(screen.getByTestId("confirm-delete"));

      expect(wipeAllDatabases).not.toHaveBeenCalled();
      expect(clearSession).not.toHaveBeenCalled();
      expect(useSession.getState().isAuthenticated).toBe(true);
      expect(useSession.getState().userId).toBe("test-user");
      expect(Alert.alert).toHaveBeenCalledWith(
        "Server error", "Server error. Please try again.", [{ text: "OK" }]
      );
      expect(screen.getByText("Confirm deletion")).toBeTruthy();

      jest.mocked(apiRequest).mockResolvedValueOnce({ status: "success", message: "Account deleted" });
      await fireEvent.press(screen.getByTestId("confirm-delete"));

      expect(clearSession).toHaveBeenCalledTimes(1);
    }
  );

  it.each([undefined, {}, { status: "pending", message: "Deletion requested" }])(
    "does not delete local data for an unconfirmed response: %p",
    async (response) => {
      jest.mocked(apiRequest).mockResolvedValueOnce(response);
      const screen = await openDeletionSheet();

      await fireEvent.press(screen.getByTestId("confirm-delete"));

      expect(wipeAllDatabases).not.toHaveBeenCalled();
      expect(clearSession).not.toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalled();
      expect(screen.getByText("Confirm deletion")).toBeTruthy();
    }
  );

  it("ignores repeated confirmation while the server request is pending", async () => {
    let resolveRequest: ((response: unknown) => void) | undefined;
    jest.mocked(apiRequest).mockImplementationOnce(() => new Promise((resolve) => {
      resolveRequest = resolve;
    }));
    await openDeletionSheet();
    const sheetProps = jest.mocked(DeleteAccountSheet).mock.calls.at(-1)?.[0];
    if (!sheetProps) throw new Error("Deletion sheet was not rendered");

    await act(async () => {
      const pendingDeletion = sheetProps.onConfirmDelete();
      sheetProps.onConfirmDelete();

      expect(apiRequest).toHaveBeenCalledTimes(1);
      expect(wipeAllDatabases).not.toHaveBeenCalled();
      expect(clearSession).not.toHaveBeenCalled();

      resolveRequest?.({ status: "success", message: "Account deleted" });
      await pendingDeletion;
    });

    expect(wipeAllDatabases).toHaveBeenCalledTimes(1);
    expect(clearSession).toHaveBeenCalledTimes(1);
  });
});
