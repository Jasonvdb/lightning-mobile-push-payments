//
//  Ldk.swift
//  LnPushNotifications
//
//  Created by Jason van den Berg on 2022/11/16.
//

import LightningDevKit
import Foundation

class LdkReceive {
  lazy var feeEstimator = {LdkFeeEstimator()}()
  lazy var logger = {LdkLogger()}()
  lazy var broadcaster = {LdkBroadcaster()}()
  lazy var persister = {LdkPersister()}()
  lazy var filter = {LdkFilter()}()
  lazy var channelManagerPersister = {LdkChannelManagerPersister()}()
  
  //Config required to setup below objects
  var chainMonitor: ChainMonitor? //TODO lazy load chainMonitor
  var keysManager: KeysManager?
  var channelManager: ChannelManager?
  var userConfig: UserConfig?
  var networkGraph: NetworkGraph?
  var rapidGossipSync: RapidGossipSync?
  var peerManager: PeerManager?
  var peerHandler: TCPPeerHandler?
  var channelManagerConstructor: ChannelManagerConstructor?
  var invoicePayer: InvoicePayer?
  var ldkNetwork: LDKNetwork?
  var ldkCurrency: LDKCurrency?
  
  static var onChannel: ((String) -> Void)!
  static var onPayment: ((Int) -> Void)!
  static var onError: ((String) -> Void)!
  static var sharedDirectory: URL!

  func start(onChannel: @escaping (String) -> Void, onPayment: @escaping (Int) -> Void, onError: @escaping (String) -> Void) {
    LdkReceive.sharedDirectory = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.LnPushPayments")?.appendingPathComponent("ldk").appendingPathComponent("wallet0")
    
    var isDir: ObjCBool = false
    guard FileManager.default.fileExists(atPath: LdkReceive.sharedDirectory.path, isDirectory: &isDir) else  {
      return onError("No existing wallet directory found found")
    }
    
    LdkReceive.onChannel = onChannel
    LdkReceive.onPayment = onPayment
    LdkReceive.onError = onError
    
    //Check we have all files we need to startup LDK
    let seedFile = LdkReceive.sharedDirectory.appendingPathComponent("seed")
    let channelManagerFile = LdkReceive.sharedDirectory.appendingPathComponent("channel_manager.bin")
    
    guard FileManager.default.fileExists(atPath: seedFile.path) else  {
      return onError("No existing seed found")
    }
    guard FileManager.default.fileExists(atPath: channelManagerFile.path) else  {
      return onError("No channel manager found")
    }
        
    let seed = [UInt8](try! Data(contentsOf: seedFile))
    
    chainMonitor = ChainMonitor(
        chain_source: Option_FilterZ(value: filter),
        broadcaster: broadcaster,
        logger: logger,
        feeest: feeEstimator,
        persister: persister
    )

    print("Creating new channel manager")
    let blockHash = "2223513fd485a4459804fe6c9b6a2b1ed73e025dfb968e28db2a2e4e0caaf3ec"
    let blockHeight = 155
    ldkNetwork = LDKNetwork_Regtest
    let minChannelHandshakeDepth = 1
    let announcedChannels = false
    
    //Polar node
    let pubKey = "0242c4451deb6266c2cf4593b891597529b73b1d2f98f7994a0ef420bfe1fd9b6c"
    let address = "192.168.0.105"
    let port = 9735
    
    let seconds = UInt64(NSDate().timeIntervalSince1970)
    let nanoSeconds = UInt32.init(truncating: NSNumber(value: seconds * 1000 * 1000))

    guard seed.count == 32 else {
        return onError("Invalid node seed")
    }

    keysManager = KeysManager(seed: seed, starting_time_secs: seconds, starting_time_nanos: nanoSeconds)
    
    userConfig = UserConfig()
    userConfig!.set_accept_inbound_channels(val: true) //Accept channels if BT is trying to open it
    userConfig!.set_manually_accept_inbound_channels(val: false)

    let channelConfig = ChannelConfig()
    userConfig!.set_channel_config(val: channelConfig)
    
    let channelHandshakeConfig = ChannelHandshakeConfig()
    channelHandshakeConfig.set_minimum_depth(val: UInt32(minChannelHandshakeDepth))
    channelHandshakeConfig.set_announced_channel(val: announcedChannels)
    userConfig!.set_channel_handshake_config(val: channelHandshakeConfig)

    let channelHandshakeLimits = ChannelHandshakeLimits()
    channelHandshakeLimits.set_force_announced_channel_preference(val: true)
    channelHandshakeLimits.set_max_minimum_depth(val: UInt32(minChannelHandshakeDepth))
    userConfig!.set_channel_handshake_limits(val: channelHandshakeLimits)
    
    do {
      let storedChannelManager = try Data(contentsOf: LdkReceive.sharedDirectory.appendingPathComponent("channel_manager.bin").standardizedFileURL)
      
      var channelMonitorsSerialized: Array<[UInt8]> = []
      let channelFiles = try FileManager.default.contentsOfDirectory(at: LdkReceive.sharedDirectory.appendingPathComponent("channels"), includingPropertiesForKeys: nil)
      for channelFile in channelFiles {
          print("Loading channel from file \(channelFile.lastPathComponent)")
          channelMonitorsSerialized.append([UInt8](try Data(contentsOf: channelFile.standardizedFileURL)))
      }
      
      channelManagerConstructor = try ChannelManagerConstructor(
          channel_manager_serialized: [UInt8](storedChannelManager),
          channel_monitors_serialized: channelMonitorsSerialized,
          keys_interface: keysManager!.as_KeysInterface(),
          fee_estimator: feeEstimator,
          chain_monitor: chainMonitor!,
          filter: filter,
          net_graph_serialized: nil,
          tx_broadcaster: broadcaster,
          logger: logger,
          enableP2PGossip: false
      )
      
      channelManager = channelManagerConstructor!.channelManager
      channelManagerConstructor!.chain_sync_completed(persister: channelManagerPersister, scorer: nil)
  //    peerManager = channelManagerConstructor!.peerManager
      peerHandler = channelManagerConstructor!.getTCPPeerHandler()
      
      let res = peerHandler!.connect(address: String(address), port: UInt16(port), theirNodeId: String(pubKey).hexaBytes)
      if !res {
        return onError("Failed to connect to peer")
      }
      
      let ourNodeId = Data(channelManager!.get_our_node_id()).hexEncodedString()
      
      print("Our node ID \(ourNodeId)")
      
      if let channel = channelManager!.list_channels().first {
        return onError("Channel ready: \(channel.get_is_channel_ready()) \nChannel Usable: \(channel.get_is_usable())")
      }
//      onError("No channels yet")
      
  //    sleep(20)
  //    completion(101, "Peers: \(peerManager!.get_peer_node_ids().map { Data($0).hexEncodedString() })")
    } catch {
      onError(error.localizedDescription)
    }
  }
  
  func reset() {
    print("LDK reset")
    
//    channelManagerConstructor?.interrupt()
    channelManagerConstructor = nil
    chainMonitor = nil
    keysManager = nil
    channelManager = nil
    userConfig = nil
    networkGraph = nil
    peerManager = nil
    peerHandler = nil
    ldkNetwork = nil
    ldkCurrency = nil
  }
}

class LdkLogger: Logger {
    override func free() {}
  
    override func log(record: Record) {
      let level = record.get_level().rawValue
      if level != 0 && level != 1 { //Ignore gossip and debug
        print(record.get_args())
      }
    }
}

class LdkFeeEstimator: FeeEstimator {
    override func free() {}
    
    override func get_est_sat_per_1000_weight(confirmation_target: LDKConfirmationTarget) -> UInt32 {
      //TODO fees set from push notification payload
      return 10000
    }
}

class LdkBroadcaster: BroadcasterInterface {
    override func free() {}
    
    override func broadcast_transaction(tx: [UInt8]) {
        //TODO save to file for main app to broadcast
    }
}

class LdkPersister: Persist {
    override func free() {}
    
    private func handleChannel(_ channel_id: OutPoint, _ data: ChannelMonitor) -> LDKChannelMonitorUpdateStatus {
      let channelId = Data(channel_id.to_channel_id()).hexEncodedString()
      

      do {
        let channelStoragePath = LdkReceive.sharedDirectory.appendingPathComponent("channels").appendingPathComponent("\(channelId).bin")
        
        if !FileManager().fileExists(atPath: channelStoragePath.path) {
          LdkReceive.onChannel?(channelId)
        }
        
        try Data(data.write()).write(to: channelStoragePath)
        
        return LDKChannelMonitorUpdateStatus_Completed
      } catch {
        //TODO force close channel if this fails
        return LDKChannelMonitorUpdateStatus_PermanentFailure
      }
    }
    
    override func persist_new_channel(channel_id: Bindings.OutPoint, data: Bindings.ChannelMonitor, update_id: Bindings.MonitorUpdateId) -> LDKChannelMonitorUpdateStatus {
        return handleChannel(channel_id, data)
    }
    
    override func update_persisted_channel(channel_id: Bindings.OutPoint, update: Bindings.ChannelMonitorUpdate, data: Bindings.ChannelMonitor, update_id: Bindings.MonitorUpdateId) -> LDKChannelMonitorUpdateStatus {
        return handleChannel(channel_id, data)
    }
}

class LdkFilter: Filter {
    override func free() {}
    
    override func register_tx(txid: [UInt8]?, script_pubkey: [UInt8]) {
      let body = [
        "txid": Data(Data(txid ?? []).reversed()).hexEncodedString(),
        "script_pubkey": Data(script_pubkey).hexEncodedString()
      ]
      //TODO write this to file
    }
    
    override func register_output(output: Bindings.WatchedOutput) {
//      let body = [
//        "block_hash": Data(output.get_block_hash()).hexEncodedString(),
//        "index": output.get_outpoint()!.get_index(),
//        "script_pubkey": Data(output.get_script_pubkey()).hexEncodedString(),
//      ]
      //TODO write to file
    }
}

class LdkChannelManagerPersister: Persister, ExtendedChannelManagerPersister {
    override func free() {
        //TODO find out what this is for
    }
    
    func handle_event(event: Event) {
        // Follows ldk-sample event handling structure
        // https://github.com/lightningdevkit/ldk-sample/blob/c0a722430b8fbcb30310d64487a32aae839da3e8/src/main.rs#L600
        switch event.getValueType() {
        case .PaymentReceived:
          let paymentReceived = event.getValueAsPaymentReceived()!
          
          let paymentPreimage = paymentReceived.getPurpose().getValueAsInvoicePayment()?.getPayment_preimage()
          let paymentSecret = paymentReceived.getPurpose().getValueAsInvoicePayment()?.getPayment_secret()
          let spontaneousPayment = paymentReceived.getPurpose().getValueAsSpontaneousPayment()
            
//            let body = [
//              "payment_hash": Data(paymentReceived.getPayment_hash()).hexEncodedString(),
//              "amount_sat": paymentReceived.getAmount_msat() / 1000,
//              "payment_preimage": Data(paymentPreimage ?? []).hexEncodedString(),
//              "payment_secret": Data(paymentSecret ?? []).hexEncodedString(),
//              "spontaneous_payment_preimage": Data(spontaneousPayment ?? []).hexEncodedString(),
//            ]
          
          //TODO end service
            return
        
        case .PaymentForwarded:
          return
        case .PendingHTLCsForwardable:
          let pendingHTLCsForwardable = event.getValueAsPendingHTLCsForwardable()!
                      
          //MARK: accept payment
          return
        
        case .PaymentClaimed:
          let paymentClaimed = event.getValueAsPaymentClaimed()!
            
          let paymentPreimage = paymentClaimed.getPurpose().getValueAsInvoicePayment()?.getPayment_preimage()
          let paymentSecret = paymentClaimed.getPurpose().getValueAsInvoicePayment()?.getPayment_secret()
          let spontaneousPayment = paymentClaimed.getPurpose().getValueAsSpontaneousPayment()
            
//            let body = [
//              "payment_hash": Data(paymentClaimed.getPayment_hash()).hexEncodedString(),
//              "amount_sat": paymentClaimed.getAmount_msat() / 1000,
//              "payment_preimage": Data(paymentPreimage ?? []).hexEncodedString(),
//              "payment_secret": Data(paymentSecret ?? []).hexEncodedString(),
//              "spontaneous_payment_preimage": Data(spontaneousPayment ?? []).hexEncodedString(),
//            ]
          
          //TODO end service
        
          //Unused channel events
        case .PaymentSent: break
        case .OpenChannelRequest: break
        case .PaymentPathSuccessful: break
        case .PaymentPathFailed: break
        case .PaymentFailed: break
        case .SpendableOutputs: break  //TODO not sure if this will be required
        case .ChannelClosed: break
        case .DiscardFunding: break
        default:
            print("ERROR: unknown LdkChannelManagerPersister.handle_event type")
        }
    }
    
    override func persist_manager(channel_manager: ChannelManager) -> Result_NoneErrorZ {
      let managerStorage = LdkReceive.sharedDirectory.appendingPathComponent("channel_manager.bin")

      do {
          try Data(channel_manager.write()).write(to: managerStorage)
          print("Persisted channel manager to disk")

          return Result_NoneErrorZ.ok()
      } catch {
          print("Error. Failed to persist channel manager to disk Error \(error.localizedDescription).")
          return Result_NoneErrorZ.err(e: LDKIOError_Other)
      }
    }
    
    override func persist_graph(network_graph: NetworkGraph) -> Result_NoneErrorZ {
      return Result_NoneErrorZ.ok()
    }
    
    override func persist_scorer(scorer: WriteableScore) -> Bindings.Result_NoneErrorZ {
      return Result_NoneErrorZ.ok()
    }
}
