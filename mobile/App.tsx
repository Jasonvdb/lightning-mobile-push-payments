/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * Generated with the TypeScript template
 * https://github.com/react-native-community/react-native-template-typescript
 *
 * @format
 */

import PushNotificationIOS from '@react-native-community/push-notification-ios';
import React, {useEffect, type PropsWithChildren} from 'react';
import {
  Alert,
  Button,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const App = () => {
  useEffect(() => {
    const type = 'register';
    PushNotificationIOS.addEventListener(type, (token) => {
      alert(JSON.stringify(token))
      console.log(token);
    });
    return () => {
      PushNotificationIOS.removeEventListener(type);
    };
  });

  const onRegister = () => {
    PushNotificationIOS.requestPermissions();
  };

  return (
    <SafeAreaView style={{backgroundColor: 'blue', height: '100%'}}>
      <StatusBar
        barStyle={'light-content'}
      />
        <Text>LnPush</Text>
        <Button title='Register' onPress={onRegister}/>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  background: {
    color: 'red'
  }
});

export default App;
