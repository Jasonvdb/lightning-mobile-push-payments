const PushNotifications = require('node-pushnotifications');
const http = require("http");
const url = require('url');

const { pushSettings, host, port } = require('./settings');
const { justTheTip, fancyGuid, createPushData } = require('./helpers');

const push = new PushNotifications(pushSettings);
const fancyDb = {};

let currentBlockData = {
    height: 0,
    header: ''
};

//Keep current block header up to date
justTheTip(({hex, height}) => {
    currentBlockData = {
        header: hex,
        height
    };
    console.log(`New block: ${height}`);
});

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
        const data = createPushData({
            type: 'payment', //"payment" or "channel"
            ...currentBlockData
        });

        push.send(deviceToken, data)
            .then((results) => { 
                delete fancyDb[guid];

                if (results[0].success) {
                    console.log('SENT!');
                    res.writeHead(200);
                    res.end(JSON.stringify({result: 'notified', delay: 15000}));
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