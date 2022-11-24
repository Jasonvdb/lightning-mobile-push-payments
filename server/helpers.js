const Electrum = require("electrum-client");
const { pushSettings, defaultPaymentAlert, appBundleID, host, port, electrumConfig } = require('./settings');

const justTheTip = async (onUpdate) => {
    const {port, server, protocol} = electrumConfig;
    const ecl = new Electrum(port, server, protocol);
    await ecl.connect();
    ecl.subscribe.on('blockchain.headers.subscribe', (headers) => {
        if (!headers[0]) {
            return;
        }
        onUpdate(headers[0]);
    });

    try{
        const tip = await ecl.blockchainHeaders_subscribe()
        onUpdate(tip);
    } catch(e){
        console.error("Failed to subscribe to block header");
        console.log(e)
        process.exit(1);
    }

    while (true) {
        //Keep connection alive
        await ecl.request('server.ping');
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
};

const fancyGuid = () => {
    let firstPart = (Math.random() * 46656) | 0;
    let secondPart = (Math.random() * 46656) | 0;
    firstPart = ("000" + firstPart.toString(36)).slice(-3);
    secondPart = ("000" + secondPart.toString(36)).slice(-3);
    return firstPart + secondPart;
};

const createPushData = (payload) => {
    return {
        topic: appBundleID,
        title: defaultPaymentAlert.title,
        body: defaultPaymentAlert.body,
        alert: { // iOS only
            ...defaultPaymentAlert,
            payload
        },
        priority: 'high',
        contentAvailable: 1,
        mutableContent: 1, // tells iOS to spin up app extension with LDK
        badge: 1,
        sound: 'ping.aiff',
    };
};

module.exports = {justTheTip, fancyGuid, createPushData};