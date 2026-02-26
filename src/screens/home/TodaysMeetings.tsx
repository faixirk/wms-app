import React from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';
import { FONT_BODY } from '../../constants/fonts';
import { CustomHeader, FocusCard } from '../../components';
import { VideoCamIcon } from '../../assets/svgs';

interface DummyMeeting {
    id: string;
    title: string;
    timeText: string;
    avatars: any[];
    extraAvatarsCount: number;
    actionIconColor: string;
}

const TODAYS_MEETINGS: DummyMeeting[] = [
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
        actionIconColor: '#6938EF', // Purple
    },
    {
        id: '2',
        title: 'WMS Meeting',
        timeText: '01:30 AM - 02:00 AM',
        avatars: [
            { uri: 'https://i.pravatar.cc/150?img=11' },
            { uri: 'https://i.pravatar.cc/150?img=32' },
            { uri: 'https://i.pravatar.cc/150?img=68' },
        ],
        extraAvatarsCount: 3,
        actionIconColor: '#6938EF', // Purple
    }
];

const TodaysMeetings = ({ navigation }: any) => {
    return (
        <SafeAreaView style={styles.safeArea}>
            <CustomHeader
                titlePrefix="TODAY"
                titleSuffix="MEETINGS"
                onBackPress={() => navigation?.goBack()}
            />

            <FlatList
                data={TODAYS_MEETINGS}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                    <FocusCard
                        title={item.title}
                        dateText={item.timeText}
                        avatars={item.avatars}
                        extraAvatarsCount={item.extraAvatarsCount}
                        actionNode={
                            <TouchableOpacity style={[styles.meetingActionNode, { backgroundColor: item.actionIconColor }]} activeOpacity={0.8}>
                                <VideoCamIcon width={20} height={20} />
                            </TouchableOpacity>
                        }
                    >
                        {/* Custom Children: Join Meet button positioned under the avatars */}
                        <TouchableOpacity style={styles.joinMeetBtn} activeOpacity={0.8}>
                            <Text style={styles.joinMeetText}>Join Meet</Text>
                        </TouchableOpacity>
                    </FocusCard>
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
    meetingActionNode: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    joinMeetBtn: {
        backgroundColor: '#6938EF', // requested purple background for the pill
        alignSelf: 'flex-start',
        paddingHorizontal: 16,
        height: 28, // Compact pill height
        borderRadius: 100, // fully rounded
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 5,
    },
    joinMeetText: {
        color: COLORS.white,
        fontFamily: FONT_BODY,
        fontWeight: '600',
        fontSize: 12,
    },
});

export default TodaysMeetings;
