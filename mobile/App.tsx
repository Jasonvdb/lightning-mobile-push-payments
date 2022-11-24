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
	Image,
	Dimensions,
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
import RNQRGenerator from 'rn-qr-generator';
import { connectToElectrum, subscribeToHeader } from './electrum';
import ldk from '@synonymdev/react-native-ldk/dist/ldk';
import lm, {
	EEventTypes,
	TChannelManagerPayment,
	TChannelManagerPaymentFailed,
	TChannelManagerPaymentPathSuccessful,
	TChannelManagerPaymentSent,
	TChannelUpdate,
} from '@synonymdev/react-native-ldk';
import { peers } from './utils/constants';
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import { CameraScreen } from 'react-native-camera-kit';
import {createPaymentRequestWithNotificationHook, getInvoiceDescription, getInvoiceDescriptionWithoutHook, payInvoiceWithNotification, setAccount} from './utils/helpers';

let paymentSubscription: EmitterSubscription | undefined;
let sentSubscription: EmitterSubscription | undefined;
let paymentPathSuccessSubscription: EmitterSubscription | undefined;
let sendFailSubscription: EmitterSubscription | undefined;
let onChannelSubscription: EmitterSubscription | undefined;

const qrSize = Dimensions.get('window').width * 0.9 - 10;

const App = (): ReactElement => {
	const [message, setMessage] = useState('...');
	const [balance, setBalance] = useState('');
	const [pushToken, setPushToken] = useState('');
	const [nodeStarted, setNodeStarted] = useState(false);
	const [invoiceQr, setInvoiceQr] = useState('');
	const [showScanner, setShowScanner] = useState(false);

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
			setInvoiceQr('');
			setBalance('');
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
			await PushNotificationIOS.requestPermissions();

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
				(res: TChannelManagerPayment) => {
					alert(`Received ${res.amount_sat} sats`);
					setInvoiceQr('');
					updateBalance();
				},
			);
		}

		if (!sentSubscription) {
			// @ts-ignore
			paymentSubscription = ldk.onEvent(
				EEventTypes.channel_manager_payment_sent,
				(res: TChannelManagerPaymentSent) => {
					alert(`Sent! Fee: ${res.fee_paid_sat} sats`);
					setMessage('');
					updateBalance();
				},
			);
		}

		if (!paymentPathSuccessSubscription) {
			// @ts-ignore
			paymentSubscription = ldk.onEvent(
				EEventTypes.channel_manager_payment_path_successful,
				(res: TChannelManagerPaymentPathSuccessful) => {
					alert(`Payment path success!`);
					setMessage('');
					updateBalance();
				},
			);
		}
		

		if (!sendFailSubscription) {
			// @ts-ignore
			sendFailSubscription = ldk.onEvent(
				EEventTypes.channel_manager_payment_failed,
				(res: TChannelManagerPaymentFailed) => {
					alert(`Payment failed`);
					setMessage('');
					updateBalance();
				},
			);
		}

		if (!onChannelSubscription) {
			// @ts-ignore
			onChannelSubscription = ldk.onEvent(
				EEventTypes.new_channel,
				(res: TChannelUpdate) => {
					alert(
						`Channel received from ${res.counterparty_node_id} Channel ${res.channel_id}`,
					);
					updateBalance();
				}
			);
		}

		return (): void => {
			paymentSubscription && paymentSubscription.remove();
			sentSubscription && sentSubscription.remove();
			paymentPathSuccessSubscription && paymentPathSuccessSubscription.remove();
			sendFailSubscription && sendFailSubscription.remove();
			onChannelSubscription && onChannelSubscription.remove();
		};
	}, []);

	useEffect(() => {
		const type = 'register';
		PushNotificationIOS.addEventListener(type, (token) => {
		  console.log(`Push token: ${token}`);	
		  setPushToken(token);
		  setMessage('Registered for push notifications');
		});
		
		return () => {
		  PushNotificationIOS.removeEventListener(type);
		};
	  });

	useEffect(() => {
		const interval = setInterval(updateBalance, 250);
		return () => clearInterval(interval);
	});

	const handleQr = async (event: any): Promise<void> => {
		setShowScanner(false);

		const paymentRequest = event.nativeEvent.codeStringValue;
		const decode = await ldk.decode({ paymentRequest });
		if (decode.isErr()) {
			return setMessage(decode.error.message);
		}

		const { recover_payee_pub_key, amount_satoshis } = decode.value;
		console.log(decode.value);
		const description = getInvoiceDescriptionWithoutHook(paymentRequest);

		Alert.prompt(
			"Amount",
			description,
			[
			  {
				text: "Cancel",
				onPress: () => console.log("Cancel Pressed"),
				style: "cancel"
			  },
			  {
				text: "Pay",
				onPress: async (sats) => {
					const ownAmountSats = Number(sats);

					setMessage('Paying...');
					const pay = await payInvoiceWithNotification({
						paymentRequest,
						amountSats: ownAmountSats,
					});
					if (pay.isErr()) {
						return setMessage(pay.error.message);
					}

					setMessage("Will keep trying...");
				}
			  }
			],
			"plain-text"
		  );
	};	

	const updateBalance = async () => {
		let total = 0;
		const listChannels = await ldk.listChannels();
		if (listChannels.isErr()) {
			setBalance('');
			return;
		}

		listChannels.value.forEach(({channel_value_satoshis, outbound_capacity_sat, inbound_capacity_sat, unspendable_punishment_reserve, is_channel_ready, is_usable}) => {
			// total += unspendable_punishment_reserve ?? 0;
			total += (channel_value_satoshis - inbound_capacity_sat) - (unspendable_punishment_reserve ?? 0);
		});

		setBalance(`${total} sats`);
	}

	return (
		<SafeAreaView style={styles.container}>
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				style={styles.scrollView}>
				<Text style={styles.text}>LN push</Text>
				<View style={styles.messageContainer}>
				<Text style={styles.balanceText}>{balance}</Text>
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
							// setAccount({name: 'wallet0'});
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

								listChannels.value.forEach(({channel_id, outbound_capacity_sat, inbound_capacity_sat, unspendable_punishment_reserve, is_channel_ready, is_usable}) => {
									msg = `${msg}${channel_id}\n`
									msg = `${msg}Can spend: ${outbound_capacity_sat} sats\n`
									msg = `${msg}Can receive: ${inbound_capacity_sat} sats\n`
									msg = `${msg}Reserve: ${unspendable_punishment_reserve} sats\n`
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
						title={'Close channel'}
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

								const { channel_id, counterparty_node_id } =
									listChannels.value[0];

								const close = async (force: boolean): Promise<void> => {
									setMessage(`Closing ${channel_id}...`);

									const res = await ldk.closeChannel({
										channelId: channel_id,
										counterPartyNodeId: counterparty_node_id,
										force,
									});
									if (res.isErr()) {
										setMessage(res.error.message);
										return;
									}
									setMessage(res.value);
								};

								Alert.alert('Close channel', `Peer ${counterparty_node_id}`, [
									{
										text: 'Cancel',
										onPress: () => console.log('Cancel Pressed'),
										style: 'cancel',
									},
									{
										text: 'Close channel',
										onPress: async (): Promise<void> => close(false),
									},
									{
										text: 'Force close',
										onPress: async (): Promise<void> => close(true),
									},
								]);
							} catch (e) {
								setMessage(e.toString());
							}
						}}
					/>
					
					<Button
						title={'Create invoice'}
						onPress={async (): Promise<void> => {
							try {
								const createPaymentRequest = await createPaymentRequestWithNotificationHook({
									description: 'Tip me!',
									expiryDeltaSeconds: 60 * 60,
								}, pushToken);

								if (createPaymentRequest.isErr()) {
									setMessage(createPaymentRequest.error.message);
									return;
								}

								const { to_str } = createPaymentRequest.value;
								console.log(to_str);

								RNQRGenerator.generate({
									value: to_str,
									height: qrSize,
									width: qrSize,
									correctionLevel: 'M'
								  })
									.then(response => {
									  const { uri } = response;
									  setInvoiceQr(uri);
									})
									.catch(error => console.log('Cannot create QR code', error));
									
							} catch (e) {
								setMessage(e.toString());
							}
						}}
					/>

					{invoiceQr ? 
					<View style={{backgroundColor: 'white', padding: 5}}>
						<Image source={{uri: invoiceQr}} style={{height: qrSize, width: qrSize}} />
					</View> : null}

					<Button title={`${showScanner ? 'Hide' : 'Show'} scanner`} onPress={() => setShowScanner(!showScanner)} />
					
					<Button
						title={'Show balances'}
						onPress={async (): Promise<void> => {
							const balances = await ldk.claimableBalances(true);
							if (balances.isErr()) {
								return setMessage(balances.error.message);
							}

							setMessage(JSON.stringify(balances.value));
						}}
					/>
					
					{showScanner ? <View style={{height: 200, width: 200}}>
						<CameraScreen
						scanBarcode={true}
						onReadCode={handleQr} // optional
						showFrame={true} // (default false) optional, show frame with transparent layer (qr code or barcode will be read on this area ONLY), start animation for scanner,that stoped when find any code. Frame always at center of the screen
						laserColor='red' // (default red) optional, color of laser in scanner frame
						frameColor='white' // (default white) optional, color of border of scanner frame
						/>
					</View>: null}
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
	balanceText: {
		color: 'green',
		fontSize: 40,
		textAlign: 'center'
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
