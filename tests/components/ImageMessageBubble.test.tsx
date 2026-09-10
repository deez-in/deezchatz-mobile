import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import ImageMessageBubble from "@/src/components/chat/ImageMessageBubble";
import ChatBubble from "@/src/components/chat/ChatBubble";
import { ThemeProvider } from "@/src/hooks/useTheme";
import { Message } from "@/src/models/db";

describe("ImageMessageBubble", () => {
  const sentImageNoCaption: Message = {
    id: "img-1",
    content: "file:///mock/documents/DeezChatz/Media/Images/Sent/img-1.jpg",
    sender_id: "me",
    status: "sent",
    created_at: 1700000000000,
    type: "image",
  };

  const sentImageWithCaption: Message = {
    id: "img-2",
    content: "file:///mock/documents/DeezChatz/Media/Images/Sent/img-2.jpg",
    sender_id: "me",
    status: "delivered",
    created_at: 1700000000000,
    type: "image",
    caption: "Beautiful sunset at the beach! 🌅",
  };

  const receivedImageWithCaption: Message = {
    id: "img-3",
    content: "file:///mock/documents/DeezChatz/Media/Images/img-3.jpg",
    sender_id: "friend-user",
    status: "read",
    created_at: 1700000000000,
    type: "image",
    caption: "Check this out!",
  };

  it("renders sent image bubble without caption", async () => {
    const { getByTestId, queryByTestId } = await render(
      <ThemeProvider>
        <ImageMessageBubble message={sentImageNoCaption} />
      </ThemeProvider>
    );

    expect(getByTestId("image-message-bubble")).toBeTruthy();
    expect(queryByTestId("image-caption")).toBeNull();
  });

  it("renders sent image bubble with caption", async () => {
    const { getByTestId, getByText } = await render(
      <ThemeProvider>
        <ImageMessageBubble message={sentImageWithCaption} />
      </ThemeProvider>
    );

    expect(getByTestId("image-message-bubble")).toBeTruthy();
    expect(getByTestId("image-caption")).toBeTruthy();
    expect(getByText("Beautiful sunset at the beach! 🌅")).toBeTruthy();
  });

  it("renders received image bubble with caption", async () => {
    const { getByTestId, getByText } = await render(
      <ThemeProvider>
        <ImageMessageBubble message={receivedImageWithCaption} />
      </ThemeProvider>
    );

    expect(getByTestId("image-message-bubble")).toBeTruthy();
    expect(getByText("Check this out!")).toBeTruthy();
  });

  it("invokes custom onPress callback when provided", async () => {
    const onPressMock = jest.fn();
    const { getByTestId } = await render(
      <ThemeProvider>
        <ImageMessageBubble message={sentImageWithCaption} onPress={onPressMock} />
      </ThemeProvider>
    );

    fireEvent.press(getByTestId("image-bubble-pressable"));
    expect(onPressMock).toHaveBeenCalledWith(
      sentImageWithCaption.content,
      sentImageWithCaption.caption
    );
  });

  it("routes message.type === 'image' in ChatBubble to ImageMessageBubble", async () => {
    const { getByTestId } = await render(
      <ThemeProvider>
        <ChatBubble message={sentImageWithCaption} />
      </ThemeProvider>
    );

    expect(getByTestId("image-message-bubble")).toBeTruthy();
  });
});
