const PushNotifications = require('node-pushnotifications');

const settings = {
    // gcm: {
    //     id: 'your-GCM-id',
    //     phonegap: false, // phonegap compatibility mode, see below (defaults to false)
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

const push = new PushNotifications(settings);



const token = 'c83520b3522858a13b945ecaeb7db2bc6faa24e997d5f1bedd20d89bc7d00dc4';

const title = 'Incoming payment';
const body = 'Please open app and ask sender to try again.'

const blockData = {
    height: 123,
    hash: 'abc123'
};

const data = {
    title,
    topic: 'to.synonym.LnPushPayments', // REQUIRED for iOS (apn and gcm)
    /* The topic of the notification. When using token-based authentication, specify the bundle ID of the app.
     * When using certificate-based authentication, the topic is usually your app's bundle ID.
     * More details can be found under https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server/sending_notification_requests_to_apns
     */
    body,
    priority: 'high', // gcm, apn. Supported values are 'high' or 'normal' (gcm). Will be translated to 10 and 5 for apn. Defaults to 'high'
    contentAvailable: true, // gcm, apn. node-apn will translate true to 1 as required by apn.
    mutableContent: 1, // apn
    badge: 1,
    sound: 'ping.aiff',
    alert: { // apn, will take precedence over title and body
        title,
        body,
        payload: blockData
    },
};

// Or you could use it as a promise:
push.send([token], data)
    .then((results) => { 
        console.log('SUCCESS');
        console.log(JSON.stringify(results));
        process.exit(1);
     })
    .catch((err) => { 
        console.log('ERROR');
        console.error(err);
        process.exit(1);
     });