# lightning-mobile-push-payments

## tl;dr

One of the largest UX barriers to non-custodial mobile lightning payments is only being able to receive payments while having your app open.

LnPush allows recipients to add a webhook to their invoices which enables senders to wake up the recipient's app in the background to come online and receive the payment.

![image info](https://github.com/Jasonvdb/lightning-mobile-push-payments/blob/main/screenshot.jpg)

## How it works
1. Mobile lightning wallet user wants to receive a payment but doesn't want to coordinate with the sender to be online at the same time.
2. App requests permission to enable remote push notifications and keeps authorization token. 
3. Recipient calls `https://mypushserver.com/register?token=<token>` and receives back a webhook which authorizes someone with the ability to trigger 1 push notification to this receivers phone.
4. Recipient creates an invoice with a description that includes the webhook in brackets. e.g. `Coffee date {https://mypushserver.com/abc123}`
5. Invoice is shared with sender as you would any regular payment request via a string or QR.
6. Sender (could be same wallet or different wallet provider) sees the webhook encoded in the invoice and knows to trigger it before attempting the payment.
7. In the webhook response the sender will have the number of milliseconds to delay before attempting the payment. This will vary between wallet providers as different lightning implementations can take a different amount of time to start up and be in a state ready to receive payments.
8. The notification to the receiver is sent with all latest block data (and any other values the node needs to sync) included as part of the notification payload as well as `mutableContent: 1` which tells the device it needs to intercept the notification with its [notification extension on iOS](https://developer.apple.com/documentation/usernotifications/unnotificationserviceextension) or [pending intent on Android](https://developer.android.com/reference/android/app/PendingIntent).
9. The extension or intent then spins up a lightning node that shares the state with the main app and gets into the correct state for receiving.
10. On the sender side once delay has passed it will pay the invoice just as they would any other.
11. Once the recipient's phone has received the transaction (or timed out) in the background the notification is delivered to the user informing them of the sats they received or of the failed payment.

## Interoperability between different wallet providers
As long as the format of the invoice description remains the same any lightning wallet should be able to send to a wallet that supports background receiving. While there is an [example push server](https://github.com/Jasonvdb/lightning-mobile-push-payments/tree/main/server) and [mobile app](https://github.com/Jasonvdb/lightning-mobile-push-payments/tree/main/mobile), the implementation details will be specific to each wallet provider.

## Tips
- Instead of making the background node sync and perform network calls for block data rather include everything in the push notification payload to save time as extensions are limited in operation time and memory use.
- Benchmark the node startup time to set an appropriate delay for senders between triggering webhook and attempting the payment.
