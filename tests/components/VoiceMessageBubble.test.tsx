import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import VoiceMessageBubble from "@/src/components/chat/VoiceMessageBubble";
import { ThemeProvider } from "@/src/hooks/useTheme";
import { Message } from "@/src/models/db";
import useVoicePlayerStore from "@/src/store/useVoicePlayerStore";

describe("VoiceMessageBubble", () => {
  const sentMessage: Message = {
    id: "msg-1",
    content: "file:///mock/documents/media/voice/sent/msg-1.opus",
    sender_id: "me",
    status: "sent",
    created_at: 1700000000000,
    type: "voice",
  };

  const receivedMessage: Message = {
    id: "msg-2",
    content: "file:///mock/documents/media/voice/msg-2.opus",
    sender_id: "other-user",
    status: "delivered",
    created_at: 1700000000000,
    type: "voice",
  };

  beforeEach(() => {
    useVoicePlayerStore.setState({
      activeUri: null,
      isPlaying: false,
      positionMs: 0,
      durationMs: 0,
    });
  });

  it("renders sent voice message bubble with controls and waveform", async () => {
    const { getByTestId } = await render(
      <ThemeProvider>
        <VoiceMessageBubble message={sentMessage} />
      </ThemeProvider>
    );

    expect(getByTestId("voice-message-bubble")).toBeTruthy();
    expect(getByTestId("voice-play-button")).toBeTruthy();
    expect(getByTestId("voice-waveform")).toBeTruthy();
    expect(getByTestId("voice-duration")).toBeTruthy();
  });

  it("renders received voice message bubble", async () => {
    const { getByTestId } = await render(
      <ThemeProvider>
        <VoiceMessageBubble message={receivedMessage} />
      </ThemeProvider>
    );

    expect(getByTestId("voice-message-bubble")).toBeTruthy();
    expect(getByTestId("voice-play-button")).toBeTruthy();
  });

  it("triggers play when play button is pressed", async () => {
    const toggleSpy = jest.spyOn(useVoicePlayerStore.getState(), "togglePlayPause");

    const { getByTestId } = await render(
      <ThemeProvider>
        <VoiceMessageBubble message={sentMessage} />
      </ThemeProvider>
    );

    const playBtn = getByTestId("voice-play-button");
    fireEvent.press(playBtn);

    expect(toggleSpy).toHaveBeenCalledWith(sentMessage.content);
    toggleSpy.mockRestore();
  });
});
