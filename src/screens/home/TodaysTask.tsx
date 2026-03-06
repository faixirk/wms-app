import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Text, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';
import { FONT_HEADING, FONT_BODY } from '../../constants/fonts';
import { CustomHeader, FocusCard } from '../../components';
import { LightningIcon, FlagHighIcon, InprogressClockIcon } from '../../assets/svgs';
import { noTaskImg } from '../../assets/images';
import { useAppSelector } from '../../hooks';
import request from '../../services/network/request';
import ENDPOINTS from '../../constants/endpoints';

const EmptyStateCard = ({ imageSource, title, description }: { imageSource: any; title: string; description: string }) => (
    <View style={styles.emptyCard}>
        <Image source={imageSource} style={styles.emptyCardImage} resizeMode="contain" />
        <Text style={styles.emptyCardTitle}>{title}</Text>
        <Text style={styles.emptyCardDescription}>{description}</Text>
    </View>
);

const TodaysTask = ({ navigation }: any) => {
    const [todayTasks, setTodayTasks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { selectedWorkspaceId } = useAppSelector((state: any) => state.auth);

    const fetchTodayTasks = async () => {
        if (!selectedWorkspaceId) return;
        try {
            setLoading(true);
            const response = await request<any>({
                url: `${ENDPOINTS.TASKS_TODAY}?workspaceId=${selectedWorkspaceId}`,
                method: 'GET',
            });
            const respData = response?.data;
            const dataObj = respData?.data || respData;
            const tasks = dataObj?.tasks;
            if (tasks && Array.isArray(tasks)) {
                setTodayTasks(tasks);
            }
        } catch (error) {
            console.log('Failed to fetch today tasks:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTodayTasks();
    }, [selectedWorkspaceId]);

    const renderEmptyState = () => {
        if (loading) return null;
        return (
            <EmptyStateCard
                title="NO TASKS ASSIGNED"
                description="It looks like you don't have any tasks assigned to you right now. Don't worry, this space will be updated as new tasks become available."
                imageSource={noTaskImg}
            />
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <CustomHeader
                titlePrefix="TODAY"
                titleSuffix="TASK"
                onBackPress={() => navigation?.goBack()}
            />

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : (
                <FlatList
                    data={todayTasks}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={renderEmptyState}
                    renderItem={({ item: task }) => {
                        const dateText = task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : 'No due date';

                        const statusColor = task.workState?.color || '#F2F4F7';
                        const isLightStatus = statusColor.toUpperCase() === '#F2F4F7' || statusColor.toUpperCase() === '#FFFFFF';

                        const statusBadgeConfig = task.workState ? {
                            label: task.workState.name,
                            backgroundColor: statusColor,
                            textColor: isLightStatus ? '#475467' : COLORS.white,
                            icon: <InprogressClockIcon width={12} height={12} fill={isLightStatus ? '#475467' : COLORS.white} />
                        } : undefined;

                        let priorityBg = '#F2F4F7';
                        let priorityText = '#475467';
                        if (task.priority === 'urgent' || task.priority === 'high') {
                            priorityBg = '#F95555';
                            priorityText = COLORS.white;
                        }

                        const priorityBadgeConfig = task.priority ? {
                            label: task.priority.charAt(0).toUpperCase() + task.priority.slice(1),
                            backgroundColor: priorityBg,
                            textColor: priorityText,
                            icon: <FlagHighIcon width={12} height={12} fill={priorityText} />
                        } : undefined;

                        const avatars = task.assignees ? task.assignees.slice(0, 3).map((a: any) => ({
                            uri: a.avatar,
                            initial: a.username ? a.username.charAt(0).toUpperCase() : (a.email ? a.email.charAt(0).toUpperCase() : '?')
                        })) : [];
                        const extraAvatarsCount = task.assignees && task.assignees.length > 3 ? task.assignees.length - 3 : 0;

                        return (
                            <FocusCard
                                title={task.name}
                                dateText={dateText}
                                projectName={task.project?.name}
                                statusBadgeConfig={statusBadgeConfig}
                                priorityBadgeConfig={priorityBadgeConfig}
                                avatars={avatars}
                                extraAvatarsCount={extraAvatarsCount}
                                actionNode={
                                    <TouchableOpacity style={[styles.taskActionNode, { backgroundColor: '#7C3AED' }]} activeOpacity={0.8}>
                                        <LightningIcon width={16} height={16} />
                                    </TouchableOpacity>
                                }
                            />
                        );
                    }}
                />
            )}
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyCard: {
        backgroundColor: COLORS.white,
        borderRadius: 38,
        padding: 14,
        alignItems: 'center',
        marginTop: 20,
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
});

export default TodaysTask;
