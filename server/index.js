const PushNotifications = require('node-pushnotifications');
const http = require("http");
var url = require('url');

const { pushSettings, defaultPaymentAlert, appBundleID, host, port } = require('./settings');

const push = new PushNotifications(pushSettings);
const fancyDb = {};
const fancyGuid = () => {
    let firstPart = (Math.random() * 46656) | 0;
    let secondPart = (Math.random() * 46656) | 0;
    firstPart = ("000" + firstPart.toString(36)).slice(-3);
    secondPart = ("000" + secondPart.toString(36)).slice(-3);
    return firstPart + secondPart;
}

const blockData = {
    height: 364,
    header: '00000030d6060261674709d9d6e63031dc7e9f5f2e98fe16d10f7e300a3fbb03122ca33ef5f8ca628bc2aeb6803c1427664c5fd76a1f9652c9f693c868913a3a8c084a2c11967a63ffff7f2000000000'
};

const payload = {
    type: 'payment', //"payment" or "channel"
    ...blockData
}

const pushData = {
    topic: appBundleID,
    title: defaultPaymentAlert.title,
    body: defaultPaymentAlert.body,
    alert: { // iOS only
        ...defaultPaymentAlert,
        payload
    },
    priority: 'high',
    contentAvailable: 12,
    mutableContent: 1, // tells iOS to spin up app extension with LDK
    badge: 1,
    sound: 'ping.aiff',
};

const requestListener = (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    console.log('Request...');
    const parts = url.parse(req.url, true);
    const query = parts.query;

    if (parts.pathname == "/register" && query.token) {
        const guid = fancyGuid();

        //TODO validate token
        fancyDb[guid] = query.token;//'c83520b3522858a13b945ecaeb7db2bc6faa24e997d5f1bedd20d89bc7d00dc4';

        res.writeHead(200);
        res.end(JSON.stringify({result: `http://${host}:${port}/${guid}`}));
        return;
    }
    
    const guid = req.url.replace('/', '');
    const deviceToken = fancyDb[guid];

    if (!deviceToken) {
        console.log('guid not found in DB');
        res.writeHead(404);
        res.end(JSON.stringify({error: 'invalid token'}));
        return;
    }

    if (deviceToken) {
        push.send([deviceToken], pushData)
            .then((results) => { 
                delete fancyDb[guid];

                if (results.success) {
                    console.log('SENT!');
                    res.writeHead(200);
                    res.end(JSON.stringify({result: 'notified'}));
                    return;
                }

                res.writeHead(500);
                res.end(JSON.stringify({error: 'failed to notify'}));
                
            })
            .catch((err) => { 
                res.writeHead(500);
                console.error(err);
                res.end(JSON.stringify({error: err}));
            });
    }
};

const server = http.createServer(requestListener);
server.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`);
});