import React, { useMemo } from 'react';
import { View, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StyledText } from "@/src/components/ui";
import { useThemedStyles, useTheme } from '@/src/hooks/useTheme';
import { Message } from '@/src/models/db';
import { formatMessageTime } from '@/src/utils/helpers';
import VoiceMessageBubble from './VoiceMessageBubble';
import ImageMessageBubble from './ImageMessageBubble';
import { EnrichedMarkdownText } from 'react-native-enriched-markdown';

// Two-pass markdown normalization for chat messages:
// 1. Strip the common leading whitespace (dedent) so the block hierarchy is
//    rooted at column 0.
// 2. Clamp any remaining leading spaces to 3 so CommonMark's 4-space
//    indented-code-block rule never fires on AI-generated or copy-pasted
//    content that arrived pre-indented.
function normalizeMarkdown(text: string): string {
    const lines = text.split('\n');
    const nonEmptyLines = lines.filter(l => l.trim().length > 0);
    if (nonEmptyLines.length === 0) return text;

    const minIndent = nonEmptyLines.reduce((min, line) =>
        Math.min(min, line.match(/^( *)/)?.[1].length ?? 0), Infinity);

    const stripped = minIndent > 0 && minIndent !== Infinity
        ? lines.map(l => l.slice(minIndent))
        : lines;

    return stripped.map(line => {
        const spaces = line.match(/^( *)/)?.[1].length ?? 0;
        return spaces >= 4 ? '   ' + line.trimStart() : line;
    }).join('\n');
}

export type ChatBubbleProps = {
    message: Message;
}


export default function ChatBubble({ message }: ChatBubbleProps) {
    const { colors } = useTheme();
    const themedStyles = useThemedStyles((colors) => ({
        sentBubble: {
            alignSelf: 'flex-end',
            backgroundColor: colors.primary,
            borderRadius: 20,
            borderCurve: 'continuous',
            borderBottomRightRadius: 4,
            padding: 10,
            paddingHorizontal: 12,
            marginVertical: 4,
            maxWidth: '88%',
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            justifyContent: 'flex-end',
            gap: 6,
        },
        receivedBubble: {
            alignSelf: 'flex-start',
            position: 'relative',
            backgroundColor: colors.surface,
            borderRadius: 20,
            borderCurve: 'continuous',
            borderBottomLeftRadius: 4,
            padding: 10,
            paddingHorizontal: 12,
            marginVertical: 4,
            maxWidth: '88%',
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            justifyContent: 'flex-start',
            gap: 6,
        },
        messageTextSent: {
            color: colors.onPrimary,
            fontSize: 14,
            lineHeight: 20,
            flexShrink: 1,
        },
        messageTextReceived: {
            color: colors.onBackground,
            fontSize: 14,
            lineHeight: 20,
            flexShrink: 1,
        },
        timestampRowSent: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 3,
            marginBottom: -4,
            marginRight: -6,
            marginLeft: 4,
        },
        timestampRowReceived: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 3,
            marginBottom: -4,
            marginLeft: 'auto',
            marginRight: -2,
        },
        timestampSent: {
            color: colors.onPrimary,
            opacity: 0.8,
            fontSize: 9,
        },
        timestampReceived: {
            color: colors.onSurfaceVariant,
            fontSize: 9,
            textAlign: 'right',
        },
        failedIndicator: {
        },
        systemContainer: {
            alignSelf: 'center',
            alignItems: 'center',
            paddingVertical: 8,
            paddingHorizontal: 16,
            marginVertical: 8,
            maxWidth: '85%',
        },
        systemText: {
            color: colors.onSurfaceVariant,
            fontSize: 13,
            lineHeight: 18,
            textAlign: 'center',
        },
        systemTimestamp: {
            color: colors.onSurfaceVariant,
            fontSize: 9,
            marginTop: 4,
            textAlign: 'center',
            opacity: 0.7,
        },
    }));

    const isMe = message.sender_id === 'me' || message.sender_id === 'self';
    const isSystem = message.type === 'system' || message.sender_id === 'system';

    // System messages render as centered, muted info text (not a chat bubble)
    if (isSystem) {
        return (
            <View style={themedStyles.systemContainer}>
                <StyledText style={themedStyles.systemText}>
                    {message.content}
                </StyledText>
                <StyledText style={themedStyles.systemTimestamp}>
                    {formatMessageTime(message.created_at)}
                </StyledText>
            </View>
        );
    }

    if (message.type === 'voice') {
        return <VoiceMessageBubble message={message} />;
    }

    if (message.type === 'image') {
        return <ImageMessageBubble message={message} />;
    }

    const statusIcon = isMe ? getStatusIcon(message.status, themedStyles) : null;
    const displayTimestamp = isMe
        ? message.created_at
        : (message.received_at ?? message.created_at);

    const sentTextColor = themedStyles.messageTextSent.color as string;
    const receivedTextColor = themedStyles.messageTextReceived.color as string;
    const textColor = isMe ? sentTextColor : receivedTextColor;
    const primaryColor = colors.primary as string;
    const outlineColor = colors.outline as string;
    const onSurfaceVariantColor = colors.onSurfaceVariant as string;

    // Explicit rgba for code/blockquote backgrounds — avoids platform-color opacity
    // issues where surfaceVariant resolves to an opaque system color on Android.
    const codeBg = isMe ? 'rgba(255,255,255,0.12)' : 'rgba(128,128,128,0.18)';
    const codeBlockBg = isMe ? 'rgba(0,0,0,0.28)' : 'rgba(128,128,128,0.22)';
    const blockquoteBg = isMe ? 'rgba(0,0,0,0.15)' : 'rgba(128,128,128,0.15)';
    const tableHeaderBg = isMe ? 'rgba(255,255,255,0.12)' : 'rgba(128,128,128,0.18)';
    const tableOddRowBg = isMe ? 'rgba(255,255,255,0.04)' : 'rgba(128,128,128,0.08)';
    const tableBorderColor = isMe ? 'rgba(255,255,255,0.18)' : 'rgba(128,128,128,0.3)';
    const dividerColor = isMe ? 'rgba(255,255,255,0.12)' : 'rgba(128,128,128,0.25)';

    const markdownStyle = useMemo(() => ({
        paragraph: {
            color: textColor,
            fontSize: 14,
            lineHeight: 20,
            marginTop: 0,
            marginBottom: 6,
        },
        h1: { color: textColor, fontSize: 19, lineHeight: 25, fontWeight: 'bold' as const, marginTop: 8, marginBottom: 4 },
        h2: { color: textColor, fontSize: 17, lineHeight: 23, fontWeight: 'bold' as const, marginTop: 6, marginBottom: 4 },
        h3: { color: textColor, fontSize: 16, lineHeight: 22, fontWeight: '600' as const, marginTop: 6, marginBottom: 4 },
        h4: { color: textColor, fontSize: 15, lineHeight: 21, fontWeight: '600' as const, marginTop: 4, marginBottom: 2 },
        h5: { color: textColor, fontSize: 14, lineHeight: 20, fontWeight: '600' as const, marginTop: 4, marginBottom: 2 },
        h6: { color: textColor, fontSize: 13, lineHeight: 18, fontWeight: '600' as const, marginTop: 4, marginBottom: 2 },
        link: {
            color: isMe ? 'rgba(255,255,255,0.9)' : primaryColor,
            underline: true,
        },
        strong: { color: textColor },
        em: { color: textColor },
        strikethrough: { color: textColor },
        list: {
            color: textColor,
            fontSize: 14,
            lineHeight: 20,
            bulletSize: 5,
            marginTop: 0,
            marginBottom: 6,
            bulletColor: isMe ? 'rgba(255,255,255,0.7)' : onSurfaceVariantColor,
            markerColor: isMe ? 'rgba(255,255,255,0.7)' : onSurfaceVariantColor,
        },
        code: {
            fontSize: 13,
            color: isMe ? '#FFD6A5' : primaryColor,
            backgroundColor: codeBg,
            borderColor: 'transparent',
        },
        codeBlock: {
            fontSize: 12.5,
            lineHeight: 18,
            color: isMe ? '#E0E0E0' : receivedTextColor,
            backgroundColor: codeBlockBg,
            borderRadius: 8,
            padding: 10,
            marginTop: 4,
            marginBottom: 6,
        },
        blockquote: {
            fontSize: 14,
            lineHeight: 20,
            color: textColor,
            borderColor: isMe ? 'rgba(255,255,255,0.4)' : primaryColor,
            borderWidth: 3,
            backgroundColor: blockquoteBg,
            borderRadius: 4,
            padding: 8,
            marginTop: 4,
            marginBottom: 6,
        },
        table: {
            fontSize: 13,
            lineHeight: 18,
            color: textColor,
            borderColor: tableBorderColor,
            headerBackgroundColor: tableHeaderBg,
            headerTextColor: textColor,
            rowEvenBackgroundColor: 'transparent',
            rowOddBackgroundColor: tableOddRowBg,
            borderRadius: 6,
            marginTop: 4,
            marginBottom: 6,
        },
        thematicBreak: {
            color: dividerColor,
            height: 0.5,
            marginTop: 6,
            marginBottom: 6,
        },
    }), [
        textColor, receivedTextColor, primaryColor, onSurfaceVariantColor,
        isMe, codeBg, codeBlockBg, blockquoteBg,
        tableHeaderBg, tableOddRowBg, tableBorderColor, dividerColor,
    ]);

    return (
        <View style={isMe ? themedStyles.sentBubble : themedStyles.receivedBubble}>
            <EnrichedMarkdownText
                markdown={normalizeMarkdown(message.content)}
                flavor="github"
                markdownStyle={markdownStyle}
                onLinkPress={({ url }) => {
                    if (url.startsWith('http://') || url.startsWith('https://')) {
                        Linking.openURL(url);
                    }
                }}
            />
            <View style={isMe ? themedStyles.timestampRowSent : themedStyles.timestampRowReceived}>
                <StyledText style={isMe ? themedStyles.timestampSent : themedStyles.timestampReceived}>
                    {formatMessageTime(displayTimestamp)}
                </StyledText>
                {statusIcon}
            </View>
        </View>
    );
}

function getStatusIcon(
    status: Message['status'],
    styles: { timestampSent: object; failedIndicator: object }
): React.ReactNode {
    switch (status) {
        case 'pending':
            return (
                <Ionicons
                    name="time-outline"
                    size={10}
                    color="rgba(255,255,255,0.6)"
                    style={styles.timestampSent}
                />
            );
        case 'failed':
            return (
                <Ionicons
                    name="alert-circle"
                    size={12}
                    color="#FF4444"
                    style={styles.failedIndicator}
                />
            );
        case 'sent':
            return (
                <Ionicons
                    name="checkmark"
                    size={11}
                    color="rgba(255,255,255,0.6)"
                    style={styles.timestampSent}
                />
            );
        case 'delivered':
            return (
                <Ionicons
                    name="checkmark-done"
                    size={11}
                    color="rgba(255,255,255,0.6)"
                    style={styles.timestampSent}
                />
            );
        default:
            return null;
    }
}
