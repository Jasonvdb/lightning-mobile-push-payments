//
//  NotificationService.swift
//  LnPushNotifications
//
//  Created by Jason van den Berg on 2022/11/15.
//

import UserNotifications

class NotificationService: UNNotificationServiceExtension {

  var contentHandler: ((UNNotificationContent) -> Void)?
  var bestAttemptContent: UNMutableNotificationContent?
  var ldk = LdkReceive()

  override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
    self.contentHandler = contentHandler
    bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)

    guard let bestAttemptContent = bestAttemptContent else {
      return
    }

    //TODO accept channels or payments depending on the payload
    
    guard let aps = request.content.userInfo["aps"] as? AnyObject,
        let alert = aps["alert"] as? AnyObject,
        let payload = alert["payload"] as? AnyObject,
        let type = payload["type"] as? String, //"payment" or "channel"
        let header = payload["header"] as? String,
        let height = payload["height"] as? Int else {
      //No blockdata, just give up
      bestAttemptContent.body = "missing block data"
      return contentHandler(bestAttemptContent)
    }
    
    var complete = false
    ldk.start(header: header, height: height) { channelId in
      bestAttemptContent.title = "Channel opened"
      bestAttemptContent.body = "\(channelId)"
      complete = true
    } onPayment: { sats in
      bestAttemptContent.title = "Payment received"
      bestAttemptContent.body = "\(sats) sats ⚡"
      complete = true
    } onError: { errorMessage in
      bestAttemptContent.title = "Lightning error"
      bestAttemptContent.body = "\(errorMessage)"
      complete = true
    }
    
    //Keep checking state, once complete wait a few seconds for LDK to complete any persistance and then shutdown to deliver notification
    var timeout = 25
    while true {
      sleep(1)
      if complete {
        sleep(3)
        ldk.reset()
        contentHandler(bestAttemptContent)
        break
      }
      timeout -= 1
      if timeout < 0 {
        break
      }
    }
    
    ldk.reset()
    contentHandler(bestAttemptContent)
  }
  
  override func serviceExtensionTimeWillExpire() {
    ldk.reset()

    if let contentHandler = contentHandler, let bestAttemptContent =  bestAttemptContent {
        contentHandler(bestAttemptContent)
    }
  }
}
