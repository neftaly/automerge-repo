import EventEmitter from "eventemitter3"
import { WebSocket, WebSocketServer } from "isomorphic-ws"
import { NetworkAdapter, NetworkAdapterEvents } from "automerge-repo"

import { receiveMessageServer } from "./WSShared.js"

export class NodeWSServerAdapter
  extends EventEmitter<NetworkAdapterEvents>
  implements NetworkAdapter
{
  peerId?: string
  server: WebSocketServer
  openSockets: WebSocket[] = []

  constructor(server: WebSocketServer) {
    super()
    this.server = server
  }

  connect(peerId: string) {
    this.peerId = peerId
    this.server.on("connection", (socket) => {
      this.openSockets.push(socket)

      // When a socket closes, or disconnects, remove it from the array.
      socket.on("close", () => {
        this.openSockets = this.openSockets.filter((s) => s !== socket)
      })

      socket.on("message", (message) =>
        receiveMessageServer(message as Uint8Array, socket, this)
      )
    })
  }

  join(docId: string) {
    // throw new Error("The server doesn't join channels.")
  }

  leave(docId: string) {
    // throw new Error("The server doesn't join channels.")
  }
}
