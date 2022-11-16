//
//  NotificationService.swift
//  LnPushNotifications
//
//  Created by Jason van den Berg on 2022/11/15.
//

import LightningDevKit
import UserNotifications

class NotificationService: UNNotificationServiceExtension {

    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?

    override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
      self.contentHandler = contentHandler
      bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)

      guard let bestAttemptContent = bestAttemptContent else {
        return
      }

      guard let aps = request.content.userInfo["aps"] as? AnyObject,
          let alert = aps["alert"] as? AnyObject,
          let payload = alert["payload"] as? AnyObject,
          let hash = payload["hash"] as? String,
          let height = payload["height"] as? Int else {
        //No blockdata, just give up
        return contentHandler(bestAttemptContent)
      }
      

      //TODO Spin up LDK
      bestAttemptContent.title = "height=\(height) hash=\(hash)"

      //Deliver final notification
      contentHandler(bestAttemptContent)
    }
    
    override func serviceExtensionTimeWillExpire() {
        // Called just before the extension will be terminated by the system.
        // Use this as an opportunity to deliver your "best attempt" at modified content, otherwise the original push payload will be used.
        if let contentHandler = contentHandler, let bestAttemptContent =  bestAttemptContent {
//          bestAttemptContent.title = "\(bestAttemptContent.title) [modified in background]"
            contentHandler(bestAttemptContent)
        }
    }

}
