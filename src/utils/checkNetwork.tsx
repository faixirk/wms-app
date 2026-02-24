import NetInfo from '@react-native-community/netinfo';

const checkNetwork = async () => {
    const state = await NetInfo.fetch();
    return state.isConnected;
};

export default checkNetwork;
