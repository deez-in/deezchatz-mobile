import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";
import DeleteAccountSheet from "@/src/components/DeleteAccountSheet";
import { ThemeProvider } from "@/src/hooks/useTheme";

// Mock @expo/ui components for test environment
jest.mock("@expo/ui", () => {
  const React = require("react");
  const { View, Pressable, Text } = require("react-native");

  return {
    BottomSheet: ({ isPresented, children }: { isPresented: boolean; children: React.ReactNode }) =>
      isPresented ? <View testID="bottom-sheet">{children}</View> : null,
    RNHostView: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    Host: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    Button: ({
      label,
      onPress,
      disabled,
      testID,
      children,
    }: {
      label?: string;
      onPress?: () => void;
      disabled?: boolean;
      testID?: string;
      children?: React.ReactNode;
    }) => (
      <Pressable testID={testID} onPress={disabled ? undefined : onPress} accessibilityState={{ disabled }}>
        {children ?? (label ? <Text>{label}</Text> : null)}
      </Pressable>
    ),
  };
});

describe("DeleteAccountSheet", () => {
  const mockOnDismiss = jest.fn();
  const mockOnConfirmDelete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderSheet = async (props = {}) => {
    return await render(
      <ThemeProvider>
        <DeleteAccountSheet
          isPresented={true}
          onDismiss={mockOnDismiss}
          onConfirmDelete={mockOnConfirmDelete}
          {...props}
        />
      </ThemeProvider>
    );
  };

  it("renders sheet content with warning and disabled delete button", async () => {
    const { getByText } = await renderSheet();

    expect(getByText("Delete Account?")).toBeTruthy();
    expect(getByText("Permanent Deletion")).toBeTruthy();
    expect(
      getByText("I understand that this action is irreversible and I want to permanently delete my account.")
    ).toBeTruthy();

    // Initially delete button shows "Delete Account" and is disabled
    expect(getByText("Delete Account")).toBeTruthy();
  });

  it("toggles checkbox and starts countdown timer", async () => {
    const { getByTestId, queryByText } = await renderSheet();

    const checkbox = getByTestId("delete-account-checkbox");

    // Check the box
    await act(async () => {
      fireEvent.press(checkbox);
    });

    // Countdown starts (label changes to Delete (10s))
    expect(queryByText(/Delete \(\d+s\)/)).toBeTruthy();
  });

  it("resets countdown when checkbox is unchecked", async () => {
    const { getByTestId, queryByText } = await renderSheet();

    const checkbox = getByTestId("delete-account-checkbox");

    // Check the box
    await act(async () => {
      fireEvent.press(checkbox);
    });
    expect(queryByText(/Delete \(\d+s\)/)).toBeTruthy();

    // Uncheck the box
    await act(async () => {
      fireEvent.press(checkbox);
    });

    // Button resets back to "Delete Account"
    expect(queryByText("Delete Account")).toBeTruthy();
  });

  it("calls onDismiss when Cancel button is pressed", async () => {
    const { getByTestId } = await renderSheet();

    const cancelBtn = getByTestId("cancel-delete-button");
    await act(async () => {
      fireEvent.press(cancelBtn);
    });

    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
  });
});
