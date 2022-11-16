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

    //TODO accept channels and payments
    
    guard let aps = request.content.userInfo["aps"] as? AnyObject,
        let alert = aps["alert"] as? AnyObject,
        let payload = alert["payload"] as? AnyObject,
        let hash = payload["hash"] as? String,
        let height = payload["height"] as? Int else {
      //No blockdata, just give up
      return contentHandler(bestAttemptContent)
    }
    
    //TODO check we have a channel
    
    //Spin up LDK
    ldk.start { [weak self] satsReceived, errorMessage in
      guard let self = self else { return }

      if let error = errorMessage {
        bestAttemptContent.title = "Channel opened"
        bestAttemptContent.body = "\(error)"
        return contentHandler(bestAttemptContent)
      }
      
      self.ldk.reset()

      //Deliver final notification
      bestAttemptContent.title = "Payment received"
      bestAttemptContent.body = "\(satsReceived) sats ⚡"

      contentHandler(bestAttemptContent)
    }
  }
  
  override func serviceExtensionTimeWillExpire() {
    ldk.reset()

    if let contentHandler = contentHandler, let bestAttemptContent =  bestAttemptContent {
        bestAttemptContent.title = "\(bestAttemptContent.title) [Payment failed]"
        contentHandler(bestAttemptContent)
    }
  }
}
