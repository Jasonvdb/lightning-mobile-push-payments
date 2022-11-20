import './shim';
import React, { ReactElement, useEffect, useState, useRef } from 'react';
import {
	Alert,
	Button,
	EmitterSubscription,
	Modal,
	SafeAreaView,
	ScrollView,
	StyleSheet,
	Text,
	View,
	AppState,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import {
	backupAccount,
	importAccount,
	setupLdk,
	syncLdk,
	getAddressBalance,
	updateHeader,
} from './ldk';
import { connectToElectrum, subscribeToHeader } from './electrum';
import ldk from '@synonymdev/react-native-ldk/dist/ldk';
import lm, {
	EEventTypes,
	TChannelManagerPayment,
	TChannelUpdate,
} from '@synonymdev/react-native-ldk';
import { peers } from './utils/constants';
import PushNotificationIOS from '@react-native-community/push-notification-ios';

let paymentSubscription: EmitterSubscription | undefined;
let onChannelSubscription: EmitterSubscription | undefined;

const App = (): ReactElement => {
	const [message, setMessage] = useState('...');
	const [nodeStarted, setNodeStarted] = useState(false);

	const appState = useRef(AppState.currentState);
  	const [appStateVisible, setAppStateVisible] = useState(appState.current);

	  useEffect(() => {
		const subscription = AppState.addEventListener("change", nextAppState => {
		  if (
			appState.current.match(/inactive|background/) &&
			nextAppState === "active"
		  ) {
			setMessage("Starting LDK");
			//App in foreground
			setTimeout(async () => {
			// Setup LDK 
			const setupResponse = await setupLdk();
			if (setupResponse.isErr()) {
				setMessage(setupResponse.error.message);
				return;
			}

			setNodeStarted(true);
			setMessage(setupResponse.value);
			}, 1000)
		  } else {
			ldk.reset().catch(console.error);
		  }
	
		  appState.current = nextAppState;
		  setAppStateVisible(appState.current);
		});
	
		return () => {
		  subscription.remove();
		};
	  }, []);

	useEffect(() => {
		//Restarting LDK on each code update causes constant errors.
		if (nodeStarted) {
			return;
		}

		(async (): Promise<void> => {
			// Connect to Electrum Server
			const electrumResponse = await connectToElectrum({});
			if (electrumResponse.isErr()) {
				setMessage(
					`Unable to connect to Electrum Server:\n ${electrumResponse.error.message}`,
				);
				return;
			}
			// Subscribe to new blocks and sync LDK accordingly.
			const headerInfo = await subscribeToHeader({
				onReceive: async (): Promise<void> => {
					const syncRes = await syncLdk();
					if (syncRes.isErr()) {
						setMessage(syncRes.error.message);
						return;
					}
					setMessage(syncRes.value);
				},
			});
			if (headerInfo.isErr()) {
				setMessage(headerInfo.error.message);
				return;
			}
			await updateHeader({ header: headerInfo.value });
			// Setup LDK
			const setupResponse = await setupLdk();
			if (setupResponse.isErr()) {
				setMessage(setupResponse.error.message);
				return;
			}

			setNodeStarted(true);
			setMessage(setupResponse.value);
		})();
	}, [nodeStarted]);

	useEffect(() => {
		if (!paymentSubscription) {
			// @ts-ignore
			paymentSubscription = ldk.onEvent(
				EEventTypes.channel_manager_payment_claimed,
				(res: TChannelManagerPayment) =>
					alert(`Received ${res.amount_sat} sats`),
			);
		}

		if (!onChannelSubscription) {
			// @ts-ignore
			onChannelSubscription = ldk.onEvent(
				EEventTypes.new_channel,
				(res: TChannelUpdate) =>
					alert(
						`Channel received from ${res.counterparty_node_id} Channel ${res.channel_id}`,
					),
			);
		}

		return (): void => {
			paymentSubscription && paymentSubscription.remove();
			onChannelSubscription && onChannelSubscription.remove();
		};
	}, []);

	useEffect(() => {
		const type = 'register';
		PushNotificationIOS.addEventListener(type, (token) => {
		  console.log(`Push token: ${token}`);	
		  setMessage('Registered for push notifications');
		});
		
		return () => {
		  PushNotificationIOS.removeEventListener(type);
		};
	  });

	return (
		<SafeAreaView style={styles.container}>
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				style={styles.scrollView}>
				<Text style={styles.text}>LN push</Text>
				<View style={styles.messageContainer}>
					<Text style={styles.text}>{message}</Text>
				</View>
				<View style={styles.container}>
					<Button
						title={'Get Node ID'}
						onPress={async (): Promise<void> => {
							const nodeIdRes = await ldk.nodeId();
							if (nodeIdRes.isErr()) {
								return setMessage(nodeIdRes.error.message);
							}

							Clipboard.setString(nodeIdRes.value);
							console.log(nodeIdRes.value);

							setMessage(`Node ID: ${nodeIdRes.value}`);
						}}
					/>

					<Button
						title={'Sync LDK'}
						onPress={async (): Promise<void> => {
							const syncRes = await syncLdk();
							if (syncRes.isErr()) {
								setMessage(syncRes.error.message);
								return;
							}
							setMessage(syncRes.value);
						}}
					/>

					<Button
						title={'Add Peers'}
						onPress={async (): Promise<void> => {
							try {
								const peersRes = await Promise.all(
									Object.keys(peers).map(async (peer) => {
										const addPeer = await lm.addPeer({
											...peers[peer],
											timeout: 5000,
										});
										if (addPeer.isErr()) {
											setMessage(addPeer.error.message);
											return;
										}
										return addPeer.value;
									}),
								);
								setMessage(JSON.stringify(peersRes));
							} catch (e) {
								setMessage(e.toString());
							}
						}}
					/>

					<Button
						title={'List peers'}
						onPress={async (): Promise<void> => {
							try {
								const listPeers = await ldk.listPeers();
								if (listPeers.isErr()) {
									setMessage(listPeers.error.message);
									return;
								}
								setMessage(JSON.stringify(listPeers.value));
							} catch (e) {
								setMessage(e.toString());
							}
						}}
					/>

					<Button
						title={'List channels'}
						onPress={async (): Promise<void> => {
							try {
								const listChannels = await ldk.listChannels();
								if (listChannels.isErr()) {
									setMessage(listChannels.error.message);
									return;
								}
								if (listChannels.value.length < 1) {
									setMessage('No channels detected.');
									return;
								}

								let msg = '';

								listChannels.value.forEach(({outbound_capacity_sat, inbound_capacity_sat, is_channel_ready, is_usable}) => {
									msg = `${msg}Can spend: ${outbound_capacity_sat} sats\n`
									msg = `${msg}Can receive: ${inbound_capacity_sat} sats\n`
									msg = `${msg}Ready: ${is_channel_ready ? '✅' : '❌'}\n`
									msg = `${msg}Usable: ${is_usable ? '✅' : '❌'}\n\n`
								});

								setMessage(msg);
							} catch (e) {
								setMessage(e.toString());
							}
						}}
					/>
					
					<Button
						title={'Register for push notifications'}
						onPress={async (): Promise<void> => {
							PushNotificationIOS.requestPermissions();
						}}
					/> 
					
					<Button
						title={'Create invoice'}
						onPress={async (): Promise<void> => {
							try {
								const createPaymentRequest = await ldk.createPaymentRequest({
									description: 'TODO push url',
									expiryDeltaSeconds: 60 * 60,
								});

								if (createPaymentRequest.isErr()) {
									setMessage(createPaymentRequest.error.message);
									return;
								}

								const { to_str } = createPaymentRequest.value;
								console.log(to_str);
								Clipboard.setString(to_str);
								setMessage(to_str);
							} catch (e) {
								setMessage(e.toString());
							}
						}}
					/>

					<Button
						title={'Pay invoice'}
						onPress={async (): Promise<void> => {
							const paymentRequest = 'TODO';
							const decode = await ldk.decode({ paymentRequest });
							if (decode.isErr()) {
								return setMessage(decode.error.message);
							}

							const { recover_payee_pub_key, amount_satoshis } = decode.value;

							const ownAmountSats = 1000;
							Alert.alert(
								amount_satoshis
									? `Pay ${amount_satoshis ?? 0}`
									: 'Zero sat invoice found',
								amount_satoshis
									? `To pubkey: ${recover_payee_pub_key}`
									: `Send ${ownAmountSats} sats (Our chosen amount) to send over?`,
								[
									{
										text: 'Cancel',
										onPress: () => console.log('Cancel Pressed'),
										style: 'cancel',
									},
									{
										text: 'Pay',
										onPress: async (): Promise<void> => {
											const pay = await lm.payWithTimeout({
												paymentRequest,
												amountSats: amount_satoshis ? undefined : ownAmountSats,
												timeout: 20000,
											});
											if (pay.isErr()) {
												return setMessage(pay.error.message);
											}

											setMessage(pay.value.payment_id);
										},
									},
								],
							);
						}}
					/>

					<Button
						title={'Show claimable balances for closed/closing channels'}
						onPress={async (): Promise<void> => {
							const balances = await ldk.claimableBalances(false);
							if (balances.isErr()) {
								return setMessage(balances.error.message);
							}

							setMessage(JSON.stringify(balances.value));
						}}
					/>
				</View>
			</ScrollView>
		</SafeAreaView>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	scrollView: {
		flex: 1,
	},
	messageContainer: {
		minHeight: 120,
		marginHorizontal: 20,
		justifyContent: 'center',
	},
	text: {
		textAlign: 'center',
		color: 'gray'
	},
	logModal: {
		paddingTop: 40,
		paddingHorizontal: 10,
		flex: 1,
		backgroundColor: 'black',
	},
	modalText: {
		color: 'green',
		fontSize: 10,
	},
});

export default App;
