import { NavigationContainer } from '@react-navigation/native';
import MainStack from './MainStack';
import AuthStack from './AuthStack';
import { StyleSheet, View } from 'react-native';
import { useAppSelector } from '../hooks';

const Root = () => {
  const token = useAppSelector((state) => state.auth.token);

  return (
    <View style={[styles.container]}>
      <NavigationContainer>
        {token ? <MainStack /> : <AuthStack />}
      </NavigationContainer>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});

export default Root;
