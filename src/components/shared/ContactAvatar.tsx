import { useState, useMemo } from "react";
import { View, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StyledText } from "@/src/components/ui";
import { useTheme } from "@/src/hooks/useTheme";

export type ContactAvatarProps = {
    name?: string | null;
    picture?: string | null;
    userId: string;
    size?: number;
}


function getDeterministicColor(userId: string): string {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    // Generate pleasant sat/lightness levels for dark and light modes
    return `hsl(${h}, 60%, 48%)`;
}

export function ContactAvatar({ name, picture, userId, size = 44 }: ContactAvatarProps) {
    const { colors } = useTheme();
    const [imageError, setImageError] = useState(false);

    const initials = useMemo(() => {
        if (!name) return "?";
        const parts = name.trim().split(/\s+/);
        const first = parts[0]?.[0] || "";
        const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
        const letters = (first + last).trim().toUpperCase();
        
        // If the letters are non-alphabetic, fall back to '?'
        if (!letters || /[^a-zA-Z0-9]/.test(letters)) {
            return "?";
        }
        return letters;
    }, [name]);

    const backgroundColor = useMemo(() => getDeterministicColor(userId), [userId]);

    const dynamicStyles = useMemo(() => {
        const radius = size / 2;
        return StyleSheet.create({
            container: {
                width: size,
                height: size,
                borderRadius: radius,
                backgroundColor: picture && !imageError ? colors.surfaceVariant : backgroundColor,
                justifyContent: "center",
                alignItems: "center",
                overflow: "hidden",
            },
            image: {
                width: size,
                height: size,
                borderRadius: radius,
            },
            text: {
                color: "#FFFFFF",
                fontSize: size * 0.4,
                fontWeight: "700",
            },
        });
    }, [size, picture, imageError, backgroundColor, colors]);

    if (picture && !imageError) {
        return (
            <View style={dynamicStyles.container}>
                <Image
                    source={{ uri: picture }}
                    style={dynamicStyles.image}
                    onError={() => setImageError(true)}
                />
            </View>
        );
    }

    return (
        <View style={dynamicStyles.container}>
            {initials === "?" ? (
                <Ionicons name="person" size={size * 0.45} color="#FFFFFF" />
            ) : (
                <StyledText style={dynamicStyles.text}>{initials}</StyledText>
            )}
        </View>
    );
}

export default ContactAvatar;
