import { TAvailableNetworks } from '@synonymdev/react-native-ldk';

export enum EAccount {
	name = 'wallet0',
	currentAccountKey = 'currentAccount',
}

export interface IGetHeaderResponse {
	id: Number;
	error: boolean;
	method: 'getHeader';
	data: string;
	network: TAvailableNetworks;
}

export interface ISubscribeToHeader {
	data: {
		height: number;
		hex: string;
	};
	error: boolean;
	id: string;
	method: string;
}

export type TGetAddressHistory = { txid: string; height: number };
