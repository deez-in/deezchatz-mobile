import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import VoiceRecordBar from "@/src/components/chat/VoiceRecordBar";
import { ThemeProvider } from "@/src/hooks/useTheme";

describe("VoiceRecordBar", () => {
  const mockOnDiscard = jest.fn();
  const mockOnTogglePlayPreview = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders recording mode with timer and recording label", async () => {
    const { getByTestId, getByText } = await render(
      <ThemeProvider>
        <VoiceRecordBar
          mode="recording"
          durationSeconds={5}
          onDiscard={mockOnDiscard}
        />
      </ThemeProvider>
    );

    expect(getByTestId("voice-recording-bar")).toBeTruthy();
    expect(getByTestId("recording-indicator")).toBeTruthy();
    expect(getByText("00:05")).toBeTruthy();
    expect(getByText("Recording...")).toBeTruthy();
  });

  it("renders review mode with delete button, play button, and duration", async () => {
    const { getByTestId, getByText } = await render(
      <ThemeProvider>
        <VoiceRecordBar
          mode="reviewing"
          durationSeconds={12}
          onDiscard={mockOnDiscard}
          onTogglePlayPreview={mockOnTogglePlayPreview}
          isPlayingPreview={false}
        />
      </ThemeProvider>
    );

    expect(getByTestId("voice-review-bar")).toBeTruthy();
    expect(getByTestId("voice-delete-button")).toBeTruthy();
    expect(getByTestId("voice-play-preview-button")).toBeTruthy();
    expect(getByText("00:12")).toBeTruthy();
  });

  it("calls onDiscard when delete button is pressed", async () => {
    const { getByTestId } = await render(
      <ThemeProvider>
        <VoiceRecordBar
          mode="reviewing"
          durationSeconds={8}
          onDiscard={mockOnDiscard}
          onTogglePlayPreview={mockOnTogglePlayPreview}
        />
      </ThemeProvider>
    );

    const deleteBtn = getByTestId("voice-delete-button");
    fireEvent.press(deleteBtn);
    expect(mockOnDiscard).toHaveBeenCalledTimes(1);
  });

  it("calls onTogglePlayPreview when play preview button is pressed", async () => {
    const { getByTestId } = await render(
      <ThemeProvider>
        <VoiceRecordBar
          mode="reviewing"
          durationSeconds={8}
          onDiscard={mockOnDiscard}
          onTogglePlayPreview={mockOnTogglePlayPreview}
        />
      </ThemeProvider>
    );

    const playBtn = getByTestId("voice-play-preview-button");
    fireEvent.press(playBtn);
    expect(mockOnTogglePlayPreview).toHaveBeenCalledTimes(1);
  });
});
