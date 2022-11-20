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
        let header = payload["header"] as? String,
        let height = payload["height"] as? Int else {
      //No blockdata, just give up
      return contentHandler(bestAttemptContent)
    }
//    bestAttemptContent.title = "Block data"
//    bestAttemptContent.body = "\(height) : \(header)"
//    contentHandler(bestAttemptContent)
//
//    return
    
    ldk.start(header: header, height: height) { channelId in
      bestAttemptContent.title = "Channel opened"
      bestAttemptContent.body = "\(channelId)"
      sleep(3)
//      self.ldk.reset()
      contentHandler(bestAttemptContent)
    } onPayment: { sats in
      bestAttemptContent.title = "Payment received"
      bestAttemptContent.body = "\(sats) sats ⚡"
      sleep(5)
//      self.ldk.reset()
      contentHandler(bestAttemptContent)
    } onError: { errorMessage in
      bestAttemptContent.title = "Lightning error"
      bestAttemptContent.body = "\(errorMessage)"
      sleep(5)
//      self.ldk.reset()
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
