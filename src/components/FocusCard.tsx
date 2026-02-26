import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ImageSourcePropType } from 'react-native';
import { COLORS } from '../constants/colors';
import { FONT_HEADING, FONT_BODY } from '../constants/fonts';
import { CutoutCard } from './CutoutCard';
import { CalenderIcon, InprogressClockIcon, FlagHighIcon } from '../assets/svgs';

export interface BadgeConfig {
    label: string;
    backgroundColor: string;
    textColor?: string;
    icon?: React.ReactNode;
}

export interface FocusCardProps {
    title: string;
    dateText?: string;
    statusBadgeConfig?: BadgeConfig;
    priorityBadgeConfig?: BadgeConfig;
    avatars?: ImageSourcePropType[];
    extraAvatarsCount?: number;
    actionNode?: React.ReactNode;
    children?: React.ReactNode;
}

const FocusCard: React.FC<FocusCardProps> = ({
    title,
    dateText,
    statusBadgeConfig,
    priorityBadgeConfig,
    avatars = [],
    extraAvatarsCount = 0,
    actionNode,
    children,
}) => {
    return (
        <CutoutCard
            style={styles.cardContainer}
            color={COLORS.white}
            cutoutWidth={68}
            cutoutHeight={52}
            cornerRadius={28}
            cutoutRadius={20}
        >
            <View style={styles.cardContent}>
                {/* Top Row: Title & Status Badge / Time */}
                <View style={styles.topRow}>
                    <Text style={styles.title} numberOfLines={1}>{title}</Text>
                    {statusBadgeConfig && (
                        <View style={[styles.statusBadge, { backgroundColor: statusBadgeConfig.backgroundColor }]}>
                            {statusBadgeConfig.icon ? statusBadgeConfig.icon : <InprogressClockIcon width={12} height={12} />}
                            <Text style={[styles.statusText, statusBadgeConfig.textColor ? { color: statusBadgeConfig.textColor } : {}]}>
                                {statusBadgeConfig.label}
                            </Text>
                        </View>
                    )}
                    {!statusBadgeConfig && dateText && (
                        <View style={styles.timeBadge}>
                            <InprogressClockIcon width={14} height={14} fill="#9E9E9E" />
                            {/* Generic clock for time */}
                            <Text style={styles.timeText}>{dateText}</Text>
                        </View>
                    )}
                </View>

                {/* Middle Row: Date (Only if it has status Badge -> Task) */}
                {statusBadgeConfig && dateText && (
                    <View style={styles.dateRow}>
                        <CalenderIcon width={14} height={14} />
                        <Text style={styles.dateText}>{dateText}</Text>
                    </View>
                )}

                {/* Bottom Row: Avatars, Priority, Action area */}
                <View style={styles.bottomRow}>
                    <View style={styles.avatarsContainer}>
                        {avatars.map((img, index) => (
                            <Image
                                key={index}
                                source={img}
                                style={[styles.avatar, { marginLeft: index > 0 ? -12 : 0 }]}
                            />
                        ))}
                        {extraAvatarsCount > 0 && (
                            <Text style={styles.extraAvatarsText}>+{extraAvatarsCount}</Text>
                        )}
                    </View>

                    {priorityBadgeConfig && (
                        <View style={[styles.priorityBadge, { backgroundColor: priorityBadgeConfig.backgroundColor }]}>
                            {priorityBadgeConfig.icon ? priorityBadgeConfig.icon : <FlagHighIcon width={12} height={12} />}
                            <Text style={[styles.priorityText, priorityBadgeConfig.textColor ? { color: priorityBadgeConfig.textColor } : {}]}>
                                {priorityBadgeConfig.label}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Additional custom content (like the Join Meet button) */}
                {children && <View style={styles.customChildren}>{children}</View>}
            </View>

            {/* Absolute positioning for the Action Node in the cutout */}
            {actionNode && (
                <View style={styles.actionButtonContainer}>
                    {actionNode}
                </View>
            )}
        </CutoutCard>
    );
};

const styles = StyleSheet.create({
    cardContainer: {
        marginBottom: 16,
        // height: 130, // Match the visual size needed
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
        overflow: 'visible', // Ensure the shadow and overlay action button are visible
    },
    cardContent: {
        padding: 14,
        paddingRight: 10,
        flex: 1,
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    title: {
        fontSize: 14,
        fontFamily: FONT_BODY,
        fontWeight: '600',
        color: COLORS.black,
        flex: 1,
        marginRight: 8,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 6,
    },
    statusText: {
        fontSize: 12,
        fontFamily: FONT_BODY,
        color: '#475467',
        fontWeight: '700',
    },
    timeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 10,
        gap: 6,
    },
    timeText: {
        fontSize: 12,
        fontFamily: FONT_BODY,
        color: '#475467',
        fontWeight: '700',
    },
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    dateText: {
        fontSize: 13,
        fontFamily: FONT_BODY,
        color: COLORS.black,
        fontWeight: '600',
    },
    bottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    avatarsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 16,
    },
    avatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: COLORS.white,
    },
    extraAvatarsText: {
        fontSize: 14,
        fontFamily: FONT_BODY,
        color: COLORS.black,
        marginLeft: 8,
        fontWeight: '600',
    },
    priorityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        height: 24, // explicit height
        borderRadius: 100, // fully rounded
        gap: 6,
        marginRight: 70, // Ensures it leaves space for the floating action node
    },
    priorityText: {
        fontSize: 12,
        fontFamily: FONT_BODY,
        color: COLORS.white,
        fontWeight: '600',
    },
    actionButtonContainer: {
        position: 'absolute',
        bottom: 0,
        right: 10,
    },
    customChildren: {
        marginTop: 8,
    },
});

export default FocusCard;
