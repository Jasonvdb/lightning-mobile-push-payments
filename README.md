# lightning-mobile-push-payments

## tl;dr

One of the largest UX barriers to non-custodial mobile lightning payments is only being able to receive payments while having your app open.

LnPush allows recipients to add a webhook to their invoices which enables senders to wake up the recipient's app in the background to come online and receive the payment.


## How it works
1. Mobile lightning wallet user wants to receive a payment but doesn't want to coordinate with the sender to be online at the same time.
2. App requests permission to enable remote push notifications and keeps authorization token. 

## Interoperability between different wallet providers
