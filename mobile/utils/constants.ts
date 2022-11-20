import { ENetworks, TAvailableNetworks } from '@synonymdev/react-native-ldk';

export const selectedNetwork: TAvailableNetworks = 'bitcoinRegtest';

//Lightning Peer Info
export const peers = {
	lnd: {
		pubKey:
			'0242c4451deb6266c2cf4593b891597529b73b1d2f98f7994a0ef420bfe1fd9b6c',
		address: '192.168.0.105',
		port: 9735,
	},
	// bt: {
	// 	pubKey:
	// 		'0296b2db342fcf87ea94d981757fdf4d3e545bd5cef4919f58b5d38dfdd73bf5c9',
	// 	address: '34.79.58.84',
	// 	port: 9735,
	// },
};

//Electrum Server Info (Synonym Regtest Set By Default)
export const customPeers = {
	bitcoin: [
		{
			host: '35.187.18.233',
			ssl: 8912,
			tcp: 8911,
			protocol: 'tcp',
		},
	],
	bitcoinTestnet: [],
	bitcoinRegtest: [
		{
			host: '192.168.0.105',
			ssl: 18484,
			tcp: 50001,
			protocol: 'tcp',
		},
	],
};
