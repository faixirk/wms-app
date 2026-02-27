import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { addImg, appLogo } from '../../assets/images';
import { COLORS } from '../../constants/colors';
import { FONT_HEADING } from '../../constants/fonts';
import { ArrowUpRightIcon } from '../../assets/svgs';
import { SCREENS } from '../../constants/screens';
import Button from '../../components/Button';
import { CutoutCard } from '../../components/CutoutCard';
import { useAppDispatch } from '../../hooks';
import { setHasSelectedWorkspace } from '../../redux/slices/auth';
import request from '../../services/network/request';
import ENDPOINTS from '../../constants/endpoints';

interface WorkspaceData {
    id: string;
    name: string;
    type?: string;
    address?: string;
    // Based on standard API structure, adapting to design
}

const WorkspaceScreen = () => {
    const navigation = useNavigation<any>();
    const dispatch = useAppDispatch();
    const [workspaces, setWorkspaces] = useState<WorkspaceData[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    useEffect(() => {
        fetchWorkspaces();
    }, []);

    const fetchWorkspaces = async () => {
        try {
            setLoading(true);
            const response = await request({
                url: ENDPOINTS.WORKSPACES,
                method: 'GET',
            });
            // Adapt to the actual structure of the API. Assuming response.data is an array.
            const data = response?.data as any;
            console.log("data", JSON.stringify(data, null, 2));
            if (data && Array.isArray(data)) {
                setWorkspaces(data);
            } else if (data && data.workspaces && Array.isArray(data.workspaces)) {
                setWorkspaces(data.workspaces);
            } else if (data && data.data && Array.isArray(data.data)) {
                setWorkspaces(data.data);
            } else {
                setWorkspaces([]); // Handle empty explicitly
            }
        } catch (error) {
            console.error('Failed to fetch workspaces', error);
            setWorkspaces([]); // Fallback to empty state on error instead of mock data
        } finally {
            setLoading(false);
        }
    };

    const handleSelectWorkspace = (id: string) => {
        setSelectedId(id);
    };

    const handleContinue = () => {
        if (!selectedId) return;

        // Save to redux state
        dispatch(setHasSelectedWorkspace({ hasSelected: true, workspaceId: selectedId }));

        // Navigate to Home
        navigation.replace(SCREENS.MAIN_TABS);
    };

    const renderWorkspaceItem = ({ item, index }: { item: WorkspaceData, index: number }) => {
        const isSelected = item.id === selectedId;
        const isFirst = index === 0;

        // Alternating colors between purple and red based on index as seen in design
        const bgColor = isFirst ? '#6964F8' : '#FA5A5A';

        return (
            <TouchableOpacity
                style={[
                    styles.cardWrapper,
                    isSelected && styles.selectedCard
                ]}
                activeOpacity={0.9}
                onPress={() => handleSelectWorkspace(item.id)}
            >
                {/* The cutout card container replacing the hacky absolute mask view */}
                <CutoutCard
                    color={bgColor}
                    cutoutWidth={76} // Right cutout width based on workspace design
                    cutoutHeight={56} // Top cutout height
                    cornerRadius={32} // Large radius for the outside corners
                    cutoutRadius={24} // Radius for the concave corner shape
                    cutoutPosition="topRight"
                    style={styles.cutoutLayer}
                >
                    <View style={styles.cardContent}>
                        <Text style={styles.iconEmoji}>🏢</Text>

                        {isFirst ? (
                            <Text style={styles.cardTitle}>{item.name}</Text>
                        ) : (
                            <View style={styles.splitTextRow}>
                                <Text style={styles.cardTitle}>NEXTBYTE</Text>
                                <Text style={styles.cardSubtitle}> LTD PVT</Text>
                            </View>
                        )}
                    </View>
                </CutoutCard>

                {/* Independent absolute positioned action button placing it in the cutout area */}
                <View style={[styles.arrowButton, { backgroundColor: COLORS.black }]}>
                    <ArrowUpRightIcon width={16} height={16} />
                </View>
            </TouchableOpacity>
        );
    };

    // New Workspace Add Button
    const renderAddWorkspace = () => (
        <TouchableOpacity style={styles.addCardContainer} activeOpacity={0.8}>
            <View style={styles.plusCircle}>
                <Image source={addImg} style={styles.logo} resizeMode="contain" />
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* Header / Logo */}
            <View style={styles.logoContainer}>
                <Image source={appLogo} style={styles.logo} resizeMode="contain" />
            </View>

            {/* Title */}
            <Text style={styles.titleText}>
                <Text style={styles.titleSelect}>SELECT</Text> WORKSPACE
            </Text>

            {/* List */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : (
                <FlatList
                    data={workspaces}
                    keyExtractor={(item) => item.id}
                    renderItem={renderWorkspaceItem}
                    ListFooterComponent={renderAddWorkspace}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}

            {/* Footer Button */}
            <View style={styles.footer}>
                <Button
                    title="CONTINUE"
                    onPress={handleContinue}
                    disabled={!selectedId}
                    style={styles.continueButton}
                />
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#F5F6F8', // Light grey background
    },
    logoContainer: {
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 30,
    },
    logo: {
        width: 100,
        height: 100,
    },
    titleText: {
        fontFamily: FONT_HEADING,
        fontSize: 28,
        letterSpacing: -1,
        textAlign: 'center',
        color: COLORS.black,
        marginBottom: 30,
    },
    titleSelect: {
        color: '#1366D9',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        marginTop: 10,
        paddingHorizontal: 24,
        paddingBottom: 20,
        gap: 16,
    },
    cardWrapper: {
        position: 'relative',
        borderRadius: 36, // Slightly larger border radius for outer active state padding overlap if scaling
    },
    selectedCard: {
        transform: [{ scale: 0.98 }], // subtle press effect instead of harsh border, fitting smooth aesthetic better
        opacity: 0.9,
    },
    cutoutLayer: {
        height: 140, // Height matching original item
        width: '100%',
    },
    arrowButton: {
        position: 'absolute',
        top: -5,
        right: 8,
        width: 56, // Button size (fills the remaining space near the top right nicely)
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardContent: {
        flex: 1,
        padding: 24,
        paddingTop: 0,
        justifyContent: 'flex-end',
    },
    iconEmoji: {
        fontSize: 24,
        marginBottom: 8,
    },
    cardTitle: {
        fontFamily: FONT_HEADING,
        fontSize: 32,
        color: COLORS.white,
        letterSpacing: -1,
    },
    splitTextRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    cardSubtitle: {
        fontFamily: FONT_HEADING,
        fontSize: 14,
        color: COLORS.white,
        letterSpacing: 0,
    },
    addCardContainer: {
        backgroundColor: COLORS.white,
        height: 140,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 4,
    },
    plusCircle: {
        width: 60,
        height: 60,
        justifyContent: 'center',
        alignItems: 'center',
    },
    plusText: {
        fontSize: 28,
        color: '#201A3C', // Deep purple
        fontWeight: '300',
    },
    footer: {
        paddingHorizontal: 24,
        paddingBottom: 20,
        paddingTop: 10,
    },
    continueButton: {
        borderRadius: 30,
        height: 56,
    }
});

export default WorkspaceScreen;
