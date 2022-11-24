import Keychain from 'react-native-keychain';
import { TAccount, TAvailableNetworks, TCreatePaymentReq, ENetworks, TPaymentReq } from '@synonymdev/react-native-ldk';
import ldk from '@synonymdev/react-native-ldk/dist/ldk';
import { getItem, setItem } from '../ldk';
import { EAccount } from './types';
import { err, ok, Result } from './result';
import { randomBytes } from 'react-native-randombytes';
import * as bitcoin from 'bitcoinjs-lib';
import { selectedNetwork } from './constants';
import RNFS from 'react-native-fs';
import * as bip32 from 'bip32';
import * as bip39 from 'bip39';
import lightningPayReq from 'bolt11';
import { Alert } from 'react-native';

export const createPaymentRequestWithNotificationHook = async (req: TCreatePaymentReq, pushToken: string) => {
	if (!pushToken) {
		return err("Register for push notifications first.");
	}

	try {
		const response = await fetch(`http://192.168.0.105:8000/register?token=${pushToken}`);
		const {result: hook} = await response.json();

		return await ldk.createPaymentRequest({...req, description: `${req.description} {${hook}}`});
	} catch (e) {
		return err(e);
	}
}

export const getInvoiceDescription = (invoice: string): string => {
	let description = '';
	const {tags} = lightningPayReq.decode(invoice);
	tags.forEach(({data, tagName}) => {
		if (tagName === 'description') {
			description = data.toString();
		}
	});

	return description;
}

export const getInvoiceDescriptionWithoutHook = (invoice: string): string => {
	const description = getInvoiceDescription(invoice);
	return description.substring(0, description.indexOf('{'));
}

export const getHookFromInvoice = (invoice: string): string => {
	const description = getInvoiceDescription(invoice);

	return description.substring(
		description.indexOf("{") + 1, 
		description.lastIndexOf("}")
	);
}

export const payInvoiceWithNotification = async (req: TPaymentReq): Promise<Result<string>> => {
	const hook = getHookFromInvoice(req.paymentRequest);

	try {
		const response = await fetch(hook);
		const {error, delay} = await response.json();
		if (error) {
			return err(`Error waking up receipient: ${error}`);
		}

		await sleep(delay);

		const res1 = await ldk.pay(req);
		if (res1.isOk()) {
			return ok(res1.value);
		}

		// await sleep(5000);

		// const res2 = await ldk.pay(req);
		// if (res2.isOk()) {
		// 	return ok(res2.value);
		// }

		// await sleep(5);

		// const res3 = await ldk.pay(req);
		// if (res3.isOk()) {
		// 	return ok(res3.value);
		// }

		return err(res1.error);
	} catch (e) {
		return err("Error: " + JSON.stringify(e));
	}
}

const sleep = (ms: number) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Use Keychain to save LDK name & seed.
 * @param {string} [key]
 * @param {string} seed
 */
export const setAccount = async ({
	name = EAccount.name,
	seed = randomSeed(),
}: TAccount): Promise<boolean> => {
	try {
		const account: TAccount = {
			name,
			seed,
		};
		await Keychain.setGenericPassword(name, JSON.stringify(account), {
			service: name,
		});
		await setItem(EAccount.currentAccountKey, name);
		return true;
	} catch {
		return false;
	}
};

/**
 * Use Keychain to retrieve LDK name & seed.
 * @param {string} [accountName]
 * @returns {Promise<string>}
 */
export const getAccount = async (accountName?: string): Promise<TAccount> => {
	if (!accountName) {
		accountName = await getCurrentAccountName();
	}
	const defaultAccount: TAccount = {
		name: EAccount.name,
		seed: randomSeed(),
	};
	try {
		let result = await Keychain.getGenericPassword({ service: accountName });
		if (result && result?.password) {
			// Return existing account.
			return JSON.parse(result?.password);
		} else {
			// Setup default account.
			await setAccount(defaultAccount);
			return defaultAccount;
		}
	} catch (e) {
		console.log(e);
		return defaultAccount;
	}
};

/**
 * Returns current account name, if any.
 * @returns {Promise<string>}
 */
export const getCurrentAccountName = async (): Promise<string> => {
	const currentAccountName = await getItem(EAccount.currentAccountKey);

	return currentAccountName ?? EAccount.name;
};

/**
 * Creates and saves new name/seed pair.
 * @returns {Promise<TAccount>}
 */
export const createNewAccount = async (): Promise<Result<TAccount>> => {
	try {
		const iosSharedDirectory = await RNFS.pathForGroup('group.LnPushPayments');

		let emptyAccount = false;
		const currentAccountName = await getCurrentAccountName();
		let num = Number(currentAccountName.replace('wallet', ''));
		while (emptyAccount === false) {			
			const accountExists = await RNFS.exists(
				`${iosSharedDirectory}/ldk/wallet${num}`,
			);
			if (accountExists) {
				num++;
			} else {
				emptyAccount = true;
			}
		}
		const name = `wallet${num}`;
		const account: TAccount = {
			name,
			seed: randomSeed(),
		};
		await setAccount(account);
		return ok(account);
	} catch (e) {
		console.log(e);
		return err(e);
	}
};

export const randomSeed = (): string => {
	return randomBytes(32).toString('hex');
};

/**
 * Returns the appropriate bitcoinjs-lib network object.
 * @param network
 * @returns {bitcoin.networks.Network}
 */
export const getNetwork = (
	network: TAvailableNetworks,
): bitcoin.networks.Network => {
	switch (network) {
		case 'bitcoin':
			return bitcoin.networks.bitcoin;
		case 'bitcoinTestnet':
			return bitcoin.networks.testnet;
		case 'bitcoinRegtest':
			return bitcoin.networks.regtest;
		default:
			return bitcoin.networks.regtest;
	}
};

/**
 * Converts address to output script.
 * @param {string} address
 * @returns {string}
 */
export const getOutputScript = (address: string): string => {
	const _network = getNetwork(selectedNetwork);
	return bitcoin.address.toOutputScript(address, _network).toString('hex');
};

/**
 * Get scriptHash for a given address
 * @param {string} address
 * @returns {string}
 */
export const getScriptHash = (address: string): string => {
	try {
		const _network = getNetwork(selectedNetwork);
		const script = bitcoin.address.toOutputScript(address, _network);
		let hash = bitcoin.crypto.sha256(script);
		const reversedHash = new Buffer(hash.reverse());
		return reversedHash.toString('hex');
	} catch (e) {
		console.log(e);
		return '';
	}
};

/**
 * Get address for a given scriptPubKey.
 * @param scriptPubKey
 * @returns {string}
 */
export const getAddressFromScriptPubKey = (scriptPubKey: string): string => {
	return bitcoin.address.fromOutputScript(
		Buffer.from(scriptPubKey, 'hex'),
		getNetwork(selectedNetwork),
	);
};

/**
 * @param {string} accountSeed
 * @returns {string}
 */
export const getMnemonicPhraseFromSeed = (accountSeed: string): string => {
	return bip39.entropyToMnemonic(accountSeed);
};

/**
 * Returns a single test address used for channel closures.
 * @returns {Promise<string>}
 */
export const getAddress = async (): Promise<string> => {
	const network = getNetwork(selectedNetwork);

	const { seed: accountSeed } = await getAccount();
	const mnemonic = getMnemonicPhraseFromSeed(accountSeed);
	const mnemonicSeed = await bip39.mnemonicToSeed(mnemonic);
	const root = bip32.fromSeed(mnemonicSeed, network);
	const keyPair = root.derivePath("m/84'/1'/0'/0/0");
	return (
		bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey, network }).address ??
		''
	);
};

export const ldkNetwork = (network: TAvailableNetworks): ENetworks => {
	switch (network) {
		case 'bitcoinRegtest':
			return ENetworks.regtest;
		case 'bitcoinTestnet':
			return ENetworks.testnet;
		case 'bitcoin':
			return ENetworks.mainnet;
	}
};
