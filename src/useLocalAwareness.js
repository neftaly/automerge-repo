import { useRepo } from "automerge-repo-react-hooks";
import { useEffect } from "react";
import useStateRef from "react-usestateref";
import { peerEvents, CHANNEL_ID_PREFIX } from "./useRemoteAwareness";

/**
 * This hook maintains state for the local client.
 * It takes a userId, a channelId, and optionally an initial state.
 * Like React.useState, it returns a [state, setState] array.
 *
 * When the state is changed, it broadcasts the changes to all clients.
 * It also broadcasts a heartbeat to let other clients know it is online.
 *
 * Note that userIds aren't secure (yet). Any client can lie about theirs.
 * ChannelID is usually just your documentID with some extra characters.
 *
 * @param {string} userId Unique user ID. Clients can lie about this.
 * @param {string} channelId Which channel to send messages on. This *must* be unique.
 * @param {any} initialState Initial state object/primitive
 * @param {object?} options
 * @param {number?1500} options.heartbeatTime How often to send a heartbeat (in ms)
 * @returns [state, setState]
 */
export const useLocalAwareness = (
  userId,
  channelIdUnprefixed,
  initialState,
  { heartbeatTime = 15000 } = {}
) => {
  const channelId = CHANNEL_ID_PREFIX + channelIdUnprefixed;
  const [localState, setLocalState, localStateRef] = useStateRef(initialState);
  const { ephemeralData } = useRepo();

  const setState = (stateOrUpdater) => {
    const state =
      typeof stateOrUpdater === "function"
        ? stateOrUpdater(localStateRef.current)
        : stateOrUpdater;
    setLocalState(state);
    // TODO: Send deltas
    ephemeralData.broadcast(channelId, [userId, state]);
  };

  useEffect(() => {
    // Send periodic heartbeats
    const heartbeat = () =>
      void ephemeralData.broadcast(channelId, [userId, localStateRef.current]);
    heartbeat(); // Initial heartbeat
    // TODO: we don't need to send a heartbeat if we've changed state recently; use recursive setTimeout instead of setInterval
    const heartbeatIntervalId = setInterval(heartbeat, heartbeatTime);
    return () => void clearInterval(heartbeatIntervalId);
  }, [ephemeralData]);

  useEffect(() => {
    // Send entire state to new peers
    let broadcastTimeoutId;
    const newPeerEvents = peerEvents.on("new_peer", (e) => {
      if (e.channelId !== channelId) return;
      broadcastTimeoutId = setTimeout(
        () =>
          void ephemeralData.broadcast(channelId, [
            userId,
            localStateRef.current,
          ]),
        500 // Wait for the peer to be ready
      );
    });
    return () => {
      newPeerEvents.off();
      broadcastTimeoutId && clearTimeout(broadcastTimeoutId);
    };
  }, [peerEvents]);

  // TODO: Send an "offline" message on unmount
  // useEffect(
  //   () => () => void ephemeralData.broadcast(channelId, userId), // UserID as a string = offline signal
  //   []
  // );

  return [localState, setState];
};
