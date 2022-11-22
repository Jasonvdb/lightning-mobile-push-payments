const host = '192.168.0.105';
const port = 8000;

const pushSettings = {
    // gcm: {
    //     id: 'TODO',
    //     ...
    // },
    apn: {
        token: {
            key: './certs/AuthKey_DCJCD7NVP4.p8', // optionally: fs.readFileSync('./certs/key.p8')
            keyId: 'DCJCD7NVP4',
            teamId: 'KYH47R284B',
        },
        production: false // true for APN production environment, false for APN sandbox environment,
    },
    isAlwaysUseFCM: false, // true all messages will be sent through node-gcm (which actually uses FCM)
};

const defaultPaymentAlert = {
    title: 'Incoming payment',
    body: 'Please open app and ask sender to try again.'
}

const appBundleID = 'to.synonym.LnPushPayments';

module.exports = {host, port, pushSettings, defaultPaymentAlert, appBundleID};