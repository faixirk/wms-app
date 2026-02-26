import React from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ImageSourcePropType } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';
import { CustomHeader, FocusCard } from '../../components';
import { LightningIcon, ClockWhiteIcon, FlagHighIcon, InprogressClockIcon } from '../../assets/svgs';
import { BadgeConfig } from '../../components/FocusCard';

// Helper icons & colors
const TODO_BADGE_COLOR = '#1FCB66'; // Green
const IN_PROGRESS_BADGE_COLOR = '#F2F4F7'; // Gray
const HIGH_PRIORITY_COLOR = '#F95555'; // Red
const MED_PRIORITY_COLOR = '#FFC107'; // Yellow
const LOW_PRIORITY_COLOR = '#FF9800'; // Orange

interface DummyTask {
    id: string;
    title: string;
    dateText: string;
    status: BadgeConfig;
    priority: BadgeConfig;
    avatars: ImageSourcePropType[];
    extraAvatarsCount: number;
    actionIconColor: string;
}

const TODAYS_TASKS: DummyTask[] = [
    {
        id: '1',
        title: 'Wiring Dashboard Analytics',
        dateText: '27 April',
        status: {
            label: 'Todo',
            backgroundColor: TODO_BADGE_COLOR,
            textColor: COLORS.white,
            icon: <ClockWhiteIcon width={12} height={12} />
        },
        priority: {
            label: 'Medium',
            backgroundColor: MED_PRIORITY_COLOR,
            textColor: COLORS.white,
            icon: <FlagHighIcon width={12} height={12} fill={COLORS.white} />
        },
        avatars: [
            { uri: 'https://i.pravatar.cc/150?img=11' },
            { uri: 'https://i.pravatar.cc/150?img=32' },
            { uri: 'https://i.pravatar.cc/150?img=68' },
        ],
        extraAvatarsCount: 3,
        actionIconColor: '#7C3AED', // Purple
    },
    {
        id: '2',
        title: 'Wiring Dashboard Analytics',
        dateText: '27 April',
        status: {
            label: 'Todo',
            backgroundColor: TODO_BADGE_COLOR,
            textColor: COLORS.white,
            icon: <ClockWhiteIcon width={12} height={12} />
        },
        priority: {
            label: 'Low',
            backgroundColor: LOW_PRIORITY_COLOR,
            textColor: COLORS.white,
            icon: <FlagHighIcon width={12} height={12} fill={COLORS.white} />
        },
        avatars: [
            { uri: 'https://i.pravatar.cc/150?img=11' },
            { uri: 'https://i.pravatar.cc/150?img=32' },
            { uri: 'https://i.pravatar.cc/150?img=68' },
        ],
        extraAvatarsCount: 3,
        actionIconColor: '#7C3AED', // Purple
    },
    {
        id: '3',
        title: 'Wiring Dashboard Analytics',
        dateText: '27 April',
        status: {
            label: 'In Progress',
            backgroundColor: IN_PROGRESS_BADGE_COLOR,
            textColor: '#475467',
            icon: <InprogressClockIcon width={12} height={12} />
        },
        priority: {
            label: 'High',
            backgroundColor: HIGH_PRIORITY_COLOR,
            textColor: COLORS.white,
            icon: <FlagHighIcon width={12} height={12} fill={COLORS.white} />
        },
        avatars: [
            { uri: 'https://i.pravatar.cc/150?img=11' },
            { uri: 'https://i.pravatar.cc/150?img=32' },
            { uri: 'https://i.pravatar.cc/150?img=68' },
        ],
        extraAvatarsCount: 3,
        actionIconColor: '#7C3AED', // Purple
    }
];

const TodaysTask = ({ navigation }: any) => {
    return (
        <SafeAreaView style={styles.safeArea}>
            <CustomHeader
                titlePrefix="TODAY"
                titleSuffix="TASK"
                onBackPress={() => navigation?.goBack()}
            />

            <FlatList
                data={TODAYS_TASKS}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                    <FocusCard
                        title={item.title}
                        dateText={item.dateText}
                        statusBadgeConfig={item.status}
                        priorityBadgeConfig={item.priority}
                        avatars={item.avatars}
                        extraAvatarsCount={item.extraAvatarsCount}
                        actionNode={
                            <TouchableOpacity style={[styles.taskActionNode, { backgroundColor: item.actionIconColor }]} activeOpacity={0.8}>
                                <LightningIcon width={16} height={16} />
                            </TouchableOpacity>
                        }
                    />
                )}
            />
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
    taskActionNode: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default TodaysTask;
