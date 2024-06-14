import React, { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import Client from '../components/Client';
import Editor from '../components/Editor';
import { initSocket } from '../socket';
import ACTIONS from '../Actions';
import { useLocation, useNavigate, Navigate, useParams } from 'react-router-dom';
import peer from '../service/peer';
import ReactPlayer from 'react-player'



const EditorPage = () => {
  const socketRef = useRef(null);
  const location = useLocation();
  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const reactNavigator = useNavigate();
  const { roomId } = useParams();
  const codeRef = useRef(null);
  const [myStream, setMyStream] = useState();
  const [remoteStream, setRemoteStream] = useState();
  const [clients, setClients] = useState([]);


  const handleCallUser = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    const offer = await peer.getOffer();
    socketRef.current.emit("user-call", {to: remoteSocketId, offer});
    setMyStream(stream);

  }, [remoteSocketId, socketRef.current]);



  const handleIncommingCall = useCallback( async({from, offer})=>{
    setRemoteSocketId(from);
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    console.log(stream);
    setMyStream(stream);
    const ans = await peer.getAnswer(offer);

    socketRef.current.emit('call-accepted', {to:from, ans});
  }, [socketRef.current]);


  // const sendStreams = useCallback(() =>{
  //   if(myStream){
  //     for (const track of myStream.getTracks()){
  //       peer.peer.addTrack(track, myStream);
  //     }
  //   }
  // }, [myStream]);

  const sendStreams = useCallback( async() => {
    // Get existing senders from the peer connection
    if(myStream){
      const existingSenders = peer.peer.getSenders();
      console.log("My Stream: ", myStream)
    
      for (const track of myStream.getTracks()) {
        // Check if this track is already being sent
        const senderExists = existingSenders.find(sender => sender.track === track);
        
        if (!senderExists) {
          console.log("Added Tracks", track)
          peer.peer.addTrack(track, myStream);
        }
      }
    }
  }, [myStream]);


  const handleCallAccepted = useCallback (async ({from, ans})=>{
    await peer.setLocalDescription(ans);
    sendStreams();
  }, [sendStreams]);

  const handleNegoNeeded = useCallback (async ()=>{
    // console.log("Nogo Running!")
    const offer = await peer.getOffer();
    socketRef.current.emit('peer-nego-needed', {offer, to:remoteSocketId});
  }, [remoteSocketId, socketRef.current])

  const handleNegoIncomming = useCallback (async ({from, offer})=>{
    const ans = await peer.getAnswer(offer);
    console.log(ans);
    socketRef.current.emit('peer-nego-done', {to:from, ans});
  }, [socketRef.current])

  const handleNegoFinal = useCallback (async ({from, ans})=>{
    await peer.setLocalDescription(ans);
  }, [])


  


  useEffect(()=>{
    // console.log("At Nego")
    
    peer.peer.addEventListener('negotiationneeded', handleNegoNeeded);

    return ()=>{
      peer.peer.removeEventListener('negotiationneeded', handleNegoNeeded)
    }
  }, [handleNegoNeeded]);


  useEffect(()=>{
    peer.peer.addEventListener('track', async (ev) =>{
      const remoteStreams = ev.streams;
      console.log("GOT TRACKS!!", remoteStreams[0]);
      setRemoteStream(remoteStreams[0]);
    });
  }, [])




  useEffect(() => {
    
    const init = async () => {
      socketRef.current = await initSocket();
      

      socketRef.current.on('connect_error', handleErrors);
      socketRef.current.on('connect_failed', handleErrors);

      function handleErrors(e) {
        console.error('Socket error', e);
        toast.error('Socket connection failed, try again later.');
        reactNavigator('/');
      }

      socketRef.current.emit(ACTIONS.JOIN, {
        roomId,
        userName: location.state?.userName,
      });

      socketRef.current.on(ACTIONS.JOINED, ({clients, userName, socketId})=>{
        if(userName !== location.state?.userName){
          toast.success(`${userName} joined the room.`);
          // console.log(`${userName} joined`);
          setRemoteSocketId(socketId);

        }

        setClients(clients);

        socketRef.current.emit(ACTIONS.SYNC_CODE, {
          code: codeRef.current,
          socketId,
        });
      });

      socketRef.current.on(ACTIONS.DISCONNECTED, ({socketId, userName})=>{
        toast.success(`${userName} left the room.`);
        setClients((prev)=>{
          return prev.filter(
            (client) => client.socketId !== socketId
            );
        });
      });


    
    
    socketRef.current.on('incomming-call', handleIncommingCall);

    socketRef.current.on('call-accepted', handleCallAccepted);

    
    socketRef.current.on("peer-nego-needed", handleNegoIncomming);

    socketRef.current.on('peer-nego-final', handleNegoFinal);

    };

    


    
    // Clean up function to disconnect socket when component unmounts
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      init();

      return () => {
        socketRef.current.disconnect();
        socketRef.current.off(ACTIONS.JOINED);
        socketRef.current.off(ACTIONS.DISCONNECTED);
        socketRef.current.off('incomming-call', handleIncommingCall);
        socketRef.current.off('call-accepted', handleCallAccepted);
        
        socketRef.current.off('peer-nego-needed', handleNegoIncomming);
        socketRef.current.off('peer-nego-final', handleNegoFinal);
      }
    };

  }, [reactNavigator, location.state?.userName, roomId]);




  async function copyRoomID(){
    try {
      await navigator.clipboard.writeText(roomId);
      toast.success('Room ID copied')
    } catch (error) {
      toast.error('Could not copy Room ID')
    }
  }

  async function leaveRoom(){
    reactNavigator('/');
    window.location.reload();
  }
  

  if (!location.state) {
    return <Navigate to="/" />;
  }

  return (
    <div className='mainWrap'>
      <div className="aside">
        <div className="asideInner">
          <div className="logo">
            <img src="/Code Collab copy.png" alt="Code Collab Logo" />
          </div>
          <h3>Connected</h3>
          <div className="clientList">
            {clients.map((client) => (
              <Client
                key={client.socketId}
                userName={client.userName}
              />
            ))}
          </div>
        </div>
        {/* {remoteSocketId && <button className='btn' onClick={handleCallUser}>CALL</button>} */}
        
        
        <button className='btn copyBtn' onClick={copyRoomID}>Copy ROOM ID</button>
        <button className='btn leaveBtn' onClick={leaveRoom}>Leave ROOM</button>
      </div>
      <div className="editorWrap">
        <div className="editorContainer">
          <Editor socketRef = {socketRef} rooId = {roomId} onCodeChange = {(code)=>{codeRef.current = code;}}/>
          <div className="player">
            <div className="btnDiv">
              <button className='btn opnBtn' onClick={handleCallUser}>Open Call</button>
              <button className='btn sndBtn' onClick={sendStreams}>Send Call</button>
            </div>
            <div className="playerWrapper">
              <ReactPlayer
                className='reactPlayer'
                playing
                muted
                url={myStream}
                width="100%"
                height="100%"
              />
            </div>  
            <div className="playerWrapper">
              <ReactPlayer
                className='reactPlayer'
                playing
                muted
                url={remoteStream}
                width="100%"
                height="100%"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EditorPage;
