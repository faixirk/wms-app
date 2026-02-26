import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { COLORS } from '../../constants/colors';
import { FONT_HEADING, FONT_BODY } from '../../constants/fonts';
import { ChatIcon, BellIcon, ArrowUpRightIcon, LightningIcon, VideoCamIcon, InprogressClockIcon, FlagHighIcon } from '../../assets/svgs';
import { taskTimer, noTaskImg, todayMeetImg, cameraImg, startTimerIcon, stopTimerIcon, deleteTimerIcon } from '../../assets/images';
import { CutoutCard, FocusCard } from '../../components';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SCREENS } from '../../constants/screens';

const ACTIVE_TASKS = [
    {
        id: '1',
        title: 'Wiring Dashboard Analytics',
        dateText: '27 April',
        statusBadgeConfig: {
            label: 'In Progress',
            backgroundColor: '#F2F4F7',
            textColor: '#475467',
            icon: <InprogressClockIcon width={12} height={12} fill="#475467" />
        },
        priorityBadgeConfig: {
            label: 'High',
            backgroundColor: '#F95555',
            textColor: COLORS.white,
            icon: <FlagHighIcon width={12} height={12} fill={COLORS.white} />
        },
        avatars: [
            { uri: 'https://i.pravatar.cc/150?img=11' },
            { uri: 'https://i.pravatar.cc/150?img=32' },
            { uri: 'https://i.pravatar.cc/150?img=68' },
        ],
        extraAvatarsCount: 3,
    },
    {
        id: '2',
        title: 'Wiring Dashboard Analytics',
        dateText: '27 April',
        statusBadgeConfig: {
            label: 'In Progress',
            backgroundColor: '#F2F4F7',
            textColor: '#475467',
            icon: <InprogressClockIcon width={12} height={12} fill="#475467" />
        },
        priorityBadgeConfig: {
            label: 'High',
            backgroundColor: '#F95555',
            textColor: COLORS.white,
            icon: <FlagHighIcon width={12} height={12} fill={COLORS.white} />
        },
        avatars: [
            { uri: 'https://i.pravatar.cc/150?img=11' },
            { uri: 'https://i.pravatar.cc/150?img=32' },
            { uri: 'https://i.pravatar.cc/150?img=68' },
        ],
        extraAvatarsCount: 3,
    },
];

const ACTIVE_MEETINGS = [
    {
        id: '1',
        title: 'WMS Meeting',
        timeText: '01:30 AM - 02:00 AM',
        avatars: [
            { uri: 'https://i.pravatar.cc/150?img=11' },
            { uri: 'https://i.pravatar.cc/150?img=32' },
            { uri: 'https://i.pravatar.cc/150?img=68' },
        ],
        extraAvatarsCount: 3,
    }
];


const SectionHeader = ({ title, badgeCount, onSeeAllPress }: { title: string; badgeCount?: number; onSeeAllPress?: () => void }) => (
    <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionHeaderTitleRow}>
            <Text style={styles.sectionHeaderTitle}>{title}</Text>
            {badgeCount !== undefined && (
                <View style={styles.badgeContainer}>
                    <Text style={styles.badgeText}>{badgeCount}</Text>
                </View>
            )}
        </View>
        <TouchableOpacity onPress={onSeeAllPress} activeOpacity={0.8}>
            <Text style={styles.seeAllText}>See all</Text>
        </TouchableOpacity>
    </View>
);

const EmptyStateCard = ({ imageSource, title, description }: { imageSource: any; title: string; description: string }) => (
    <View style={styles.emptyCard}>
        <Image source={imageSource} style={styles.emptyCardImage} resizeMode="contain" />
        <Text style={styles.emptyCardTitle}>{title}</Text>
        <Text style={styles.emptyCardDescription}>{description}</Text>
    </View>
);

const Home = ({ navigation }: any) => {
    const [isTimerExpanded, setIsTimerExpanded] = useState(false);

    const toggleTimer = (expand: boolean) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsTimerExpanded(expand);
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* Header Profile Row */}
                <View style={styles.headerRow}>
                    <Image
                        source={{ uri: 'https://i.pravatar.cc/150?img=47' }}
                        style={styles.avatar}
                    />
                    <View style={styles.headerIcons}>
                        <TouchableOpacity style={styles.iconCircle}>
                            <ChatIcon width={20} height={20} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconCircle}>
                            <BellIcon width={20} height={20} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Greeting */}
                <Text style={styles.greetingText}>
                    <Text style={styles.greetingBlue}>LETS ORGANIZE </Text>
                    <Text>YOUR{'\n'}TASK TODAY! 👋</Text>
                </Text>

                {/* Remaining Tasks Card with Cutout Component */}
                <View style={{ position: 'relative', marginBottom: 32, zIndex: 10 }}>
                    <Image source={cameraImg} style={styles.cameraOverlay} resizeMode="contain" />
                    <CutoutCard
                        style={styles.remainingTasksCard}
                        color={COLORS.primary}
                        cutoutWidth={96}
                        cutoutHeight={76}
                        cornerRadius={38}
                        cutoutRadius={28}
                    >
                        <View style={styles.remainingTasksContent}>
                            <Text style={styles.remainingTasksTitle}>REMAINING TASKS</Text>
                            <Text style={styles.remainingTasksCount}>0</Text>
                        </View>

                        <TouchableOpacity style={styles.blackPillButton} activeOpacity={0.8}>
                            <ArrowUpRightIcon width={24} height={24} />
                        </TouchableOpacity>
                    </CutoutCard>
                </View>

                {/* Today Task Section */}
                <SectionHeader
                    title="TODAY TASK"
                    badgeCount={ACTIVE_TASKS.length > 0 ? ACTIVE_TASKS.length : undefined}
                    onSeeAllPress={() => navigation?.navigate(SCREENS.TODAYS_TASK)}
                />
                {ACTIVE_TASKS.length > 0 ? (
                    ACTIVE_TASKS.map((task) => (
                        <FocusCard
                            key={task.id}
                            title={task.title}
                            dateText={task.dateText}
                            statusBadgeConfig={task.statusBadgeConfig}
                            priorityBadgeConfig={task.priorityBadgeConfig}
                            avatars={task.avatars}
                            extraAvatarsCount={task.extraAvatarsCount}
                            actionNode={
                                <TouchableOpacity style={styles.taskActionNode} activeOpacity={0.8}>
                                    <LightningIcon width={16} height={16} />
                                </TouchableOpacity>
                            }
                        />
                    ))
                ) : (
                    <EmptyStateCard
                        title="NO TASKS ASSIGNED"
                        description="It looks like you don't have any tasks assigned to you right now. Don't worry, this space will be updated as new tasks become available."
                        imageSource={noTaskImg}
                    />
                )}

                {/* Today Meeting Section */}
                <View style={{ marginTop: 24 }}>
                    <SectionHeader
                        title="TODAY MEETING"
                        badgeCount={ACTIVE_MEETINGS.length > 0 ? ACTIVE_MEETINGS.length : undefined}
                        onSeeAllPress={() => navigation?.navigate(SCREENS.TODAYS_MEETINGS)}
                    />
                    {ACTIVE_MEETINGS.length > 0 ? (
                        ACTIVE_MEETINGS.map((meet) => (
                            <FocusCard
                                key={meet.id}
                                title={meet.title}
                                dateText={meet.timeText}
                                avatars={meet.avatars}
                                extraAvatarsCount={meet.extraAvatarsCount}
                                actionNode={
                                    <TouchableOpacity style={styles.meetActionNode} activeOpacity={0.8}>
                                        <VideoCamIcon width={20} height={20} />
                                    </TouchableOpacity>
                                }
                            >
                                <TouchableOpacity style={styles.joinMeetBtn} activeOpacity={0.8}>
                                    <Text style={styles.joinMeetText}>Join Meet</Text>
                                </TouchableOpacity>
                            </FocusCard>
                        ))
                    ) : (
                        <EmptyStateCard
                            title="NO MEETING AVAILABLE"
                            description="It looks like you don't have any meetings scheduled at the moment. This space will be updated as new meetings are added!"
                            imageSource={todayMeetImg}
                        />
                    )}
                </View>

                {/* Spacer for bottom tab bar */}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Floating Timer Button Wrapper */}
            <View style={[styles.timerWrapper, isTimerExpanded && styles.timerWrapperExpanded]}>
                <TouchableOpacity
                    style={[styles.timerFab, isTimerExpanded && styles.timerFabExpanded]}
                    activeOpacity={isTimerExpanded ? 1 : 0.9}
                    onPress={() => !isTimerExpanded && toggleTimer(true)}
                >
                    {isTimerExpanded ? (
                        <View style={styles.timerExpandedContent}>
                            <View style={styles.timerLeft}>
                                <Image source={taskTimer} style={styles.timerIconSmall} resizeMode="contain" />
                                <Text style={styles.timerText}>22:47:20</Text>
                            </View>
                            <View style={styles.timerRight}>
                                <TouchableOpacity style={styles.timerControlBtn} activeOpacity={0.7}>
                                    <Image source={startTimerIcon} style={styles.timerControlIcon} resizeMode="contain" />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.timerControlBtn} activeOpacity={0.7}>
                                    <Image source={stopTimerIcon} style={styles.timerControlIcon} resizeMode="contain" />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.timerControlBtn} activeOpacity={0.7}>
                                    <Image source={deleteTimerIcon} style={styles.timerControlIcon} resizeMode="contain" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.timerCloseBtn}
                                    onPress={() => toggleTimer(false)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Text style={styles.timerCloseText}>✕</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <Image source={taskTimer} style={styles.timerIcon} resizeMode="contain" />
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 40,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    headerIcons: {
        flexDirection: 'row',
        gap: 12,
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.white,
        justifyContent: 'center',
        alignItems: 'center',
    },
    greetingText: {
        fontSize: 28,
        fontFamily: FONT_HEADING,
        color: COLORS.black,
        lineHeight: 34,
        letterSpacing: -0.5,
        marginBottom: 40,
    },
    greetingBlue: {
        color: COLORS.primary,
    },
    remainingTasksCard: {
        height: 120,
        overflow: 'hidden', // Ensure content respects card boundaries
    },
    remainingTasksContent: {
        padding: 20,
        justifyContent: 'center',
    },
    remainingTasksTitle: {
        color: '#C4C4C4',
        fontSize: 20,
        fontFamily: FONT_HEADING,
        marginBottom: 16,
    },
    remainingTasksCount: {
        color: COLORS.white,
        fontSize: 48,
        fontFamily: FONT_HEADING,
        lineHeight: 52,
    },
    blackPillButton: {
        position: 'absolute',
        bottom: 10,
        right: 5,
        backgroundColor: COLORS.black,
        width: 80,
        height: 55,
        borderRadius: 30, // perfect pill format for height 60
        justifyContent: 'center',
        alignItems: 'center',
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionHeaderTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionHeaderTitle: {
        fontSize: 16,
        fontFamily: FONT_HEADING,
        color: COLORS.black,
    },
    badgeContainer: {
        backgroundColor: '#D1E0F9', // light blue accent
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    badgeText: {
        color: COLORS.primary,
        fontSize: 12,
        fontFamily: FONT_BODY,
        fontWeight: '600',
    },
    seeAllText: {
        color: COLORS.primary,
        fontSize: 14,
        fontFamily: FONT_BODY,
        fontWeight: '700',
    },
    emptyCard: {
        backgroundColor: COLORS.white,
        borderRadius: 38,
        padding: 14,
        alignItems: 'center',
    },
    emptyCardImage: {
        width: 140,
        height: 100,
        marginBottom: 16,
    },
    emptyCardTitle: {
        fontSize: 16,
        fontFamily: FONT_HEADING,
        color: COLORS.black,
        marginBottom: 8,
        textAlign: 'center',
    },
    emptyCardDescription: {
        fontSize: 12,
        fontFamily: FONT_BODY,
        color: COLORS.sheetDescription,
        textAlign: 'center',
        lineHeight: 18,
    },
    cameraOverlay: {
        position: 'absolute',
        top: -55,
        left: -25,
        width: 140,
        height: 100,
        zIndex: 20,
        transform: [{ rotate: '-10deg' }], // Slight angle matching design
    },
    taskActionNode: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#7C3AED',
        justifyContent: 'center',
        alignItems: 'center',
    },
    meetActionNode: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#7C3AED',
        justifyContent: 'center',
        alignItems: 'center',
    },
    joinMeetBtn: {
        backgroundColor: '#6938EF',
        paddingHorizontal: 20,
        height: 28, // explicit height request
        justifyContent: 'center',
        borderRadius: 100, // fully rounded pill
        alignSelf: 'flex-start',
        marginTop: 5,
    },
    joinMeetText: {
        color: COLORS.white,
        fontFamily: FONT_BODY,
        fontSize: 13,
        fontWeight: '600',
    },
    timerWrapper: {
        position: 'absolute',
        right: 20,
        bottom: 115,
        zIndex: 100,
    },
    timerWrapperExpanded: {
        left: 20,
        alignItems: 'center',
    },
    timerFab: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.white,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    timerFabExpanded: {
        width: '100%',
        maxWidth: 340,
        height: 56,
        borderRadius: 28,
        paddingHorizontal: 16,
    },
    timerIcon: {
        width: 24,
        height: 24,
    },
    timerExpandedContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
    },
    timerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    timerIconSmall: {
        width: 20,
        height: 20,
    },
    timerText: {
        fontFamily: FONT_HEADING,
        fontSize: 14,
        color: COLORS.black,
        marginTop: 2, // optical alignment
    },
    timerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    timerControlBtn: {
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    timerControlIcon: {
        width: 18,
        height: 18,
    },
    timerCloseBtn: {
        marginLeft: 4,
        justifyContent: 'center',
        alignItems: 'center',
    },
    timerCloseText: {
        color: COLORS.textSecondary,
        fontSize: 16,
        fontWeight: '600',
    },
});

export default Home;
