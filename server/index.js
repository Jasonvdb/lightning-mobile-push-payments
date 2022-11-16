const PushNotifications = require('node-pushnotifications');
const { exit } = require('process');

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
}

const data = {
    title, // REQUIRED for Android
    topic: 'to.synonym.LnPushPayments', // REQUIRED for iOS (apn and gcm)
    /* The topic of the notification. When using token-based authentication, specify the bundle ID of the app.
     * When using certificate-based authentication, the topic is usually your app's bundle ID.
     * More details can be found under https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server/sending_notification_requests_to_apns
     */
    body,
    priority: 'high', // gcm, apn. Supported values are 'high' or 'normal' (gcm). Will be translated to 10 and 5 for apn. Defaults to 'high'
    contentAvailable: true, // gcm, apn. node-apn will translate true to 1 as required by apn.
    // delayWhileIdle: true, // gcm for android
    // restrictedPackageName: '', // gcm for android
    // dryRun: false, // gcm for android
    // icon: '', // gcm for android
    // image: '', // gcm for android
    // style: '', // gcm for android
    // picture: '', // gcm for android
    // tag: '', // gcm for android
    // color: '', // gcm for android
    // clickAction: '', // gcm for android. In ios, category will be used if not supplied
    // locKey: '', // gcm, apn
    // titleLocKey: '', // gcm, apn
    // locArgs: undefined, // gcm, apn. Expected format: Stringified Array
    // titleLocArgs: undefined, // gcm, apn. Expected format: Stringified Array
    // retries: 1, // gcm, apn
    // encoding: '', // apn
    badge: 1, // gcm for ios, apn
    sound: 'ping.aiff', // gcm, apn
    // android_channel_id: '', // gcm - Android Channel ID
    // notificationCount: 0, // fcm for android. badge can be used for both fcm and apn
    alert: { // apn, will take precedence over title and body
        title,
        body,
        payload: blockData
        // details: https://github.com/node-apn/node-apn/blob/master/doc/notification.markdown#convenience-setters
    },
    // silent: false, // gcm, apn, will override badge, sound, alert and priority if set to true on iOS, will omit `notification` property and send as data-only on Android/GCM
    // /*
    //  * A string is also accepted as a payload for alert
    //  * Your notification won't appear on ios if alert is empty object
    //  * If alert is an empty string the regular 'title' and 'body' will show in Notification
    //  */
    // // alert: '',
    // launchImage: '', // apn and gcm for ios
    // action: '', // apn and gcm for ios
    // category: '', // apn and gcm for ios
    // // mdm: '', // apn and gcm for ios. Use this to send Mobile Device Management commands.
    // // https://developer.apple.com/library/content/documentation/Miscellaneous/Reference/MobileDeviceManagementProtocolRef/3-MDM_Protocol/MDM_Protocol.html
    urlArgs: 'urlArgs', // apn and gcm for ios
    // truncateAtWordEnd: true, // apn and gcm for ios
    mutableContent: 1, // apn
    // threadId: '', // apn
    // pushType: 'alert', // apn. valid values are 'alert' and 'background' (https://github.com/parse-community/node-apn/blob/master/doc/notification.markdown#notificationpushtype)
    // expiry: Math.floor(Date.now() / 1000) + 28 * 86400, // unit is seconds. if both expiry and timeToLive are given, expiry will take precedence
    // timeToLive: 28 * 86400,
    payload: "TODO"
};

// Or you could use it as a promise:
push.send([token], data)
    .then((results) => { 
        console.log('SUCCESS');
        console.log(JSON.stringify(results));
        exit(1);
     })
    .catch((err) => { 
        console.log('ERROR');
        console.error(err);
        exit(1);
     });