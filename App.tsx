import React, {useState} from 'react';
import {SafeAreaView, StyleSheet, View, Button} from 'react-native';

import {
  RTCView,
  mediaDevices,
  MediaStream,
  MediaStreamConstraints,
  RTCPeerConnection,
  MediaStreamTrack,
} from 'react-native-webrtc';

const App = () => {
  const [localStream, setLocalStream] = useState<MediaStream | boolean>(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | boolean>(
    false,
  );
  const [cachedLocalPC, setCachedLocalPC] = useState<RTCPeerConnection>();
  const [cachedRemotePC, setCachedRemotePC] = useState<RTCPeerConnection>();
  const [isMuted, setIsMuted] = useState(false);

  const startLocalStream = async () => {
    const isFrontCamera = true;
    const devices = await mediaDevices.enumerateDevices();

    const facing = isFrontCamera ? 'front' : 'environment';
    const videoSourceId = devices.find(
      (device: any) => device.kind === 'videoinput' && device.facing === facing,
    );
    const facingMode = isFrontCamera ? 'user' : 'environment';
    const constraints: MediaStreamConstraints = {
      audio: true,
      video: {
        mandatory: {
          minWidth: 500,
          minHeight: 300,
          minFrameRate: 30,
        },
        facingMode,
        optional: videoSourceId ? [{sourceId: videoSourceId}] : [],
      },
    };
    const newStream: MediaStream | boolean = await mediaDevices.getUserMedia(
      constraints,
    );
    setLocalStream(newStream);
  };

  const startCall = async () => {
    const configuration = {iceServers: [{url: 'stun:stun.l.google.com:19302'}]};
    const localPC = new RTCPeerConnection(configuration);
    const remotePC = new RTCPeerConnection(configuration);

    localPC.onicecandidate = (e) => {
      try {
        console.log('localPC icecandidate:', e);
        if (e.candidate) {
          // Adım 4: Yerel cihazdan ICE adayını al ve çalıştır. Devamında oluşturulan ICE adayını yerel cihaza ilet
          remotePC.addIceCandidate(e.candidate);
        }
      } catch (err) {
        console.error(`Error adding remotePC iceCandidate: ${err}`);
      }
    };
    remotePC.onicecandidate = (e) => {
      try {
        console.log('remotePC icecandidate:', e);
        if (e.candidate) {
          // Adım 5: Uzak cihazdan ICE adayını al ve çalıştır.
          localPC.addIceCandidate(e.candidate);
        }
      } catch (err) {
        console.error(`Error adding localPC iceCandidate: ${err}`);
      }
    };
    remotePC.onaddstream = (e) => {
      console.log('remotePC tracking with ', e);
      if (e.stream && remoteStream !== e.stream) {
        console.log('RemotePC received the stream', e.stream);
        setRemoteStream(e.stream);
      }
    };

    localPC.addStream(localStream as MediaStream);

    try {
      // Adım 1: Peer Connection oluşturulur ve uzak cihaza arama isteği (SDP) gönderilir.
      const offerSDP = await localPC.createOffer();
      console.log('Yerel cihaz üzerinden SDP isteği oluşturuldu:', offerSDP);
      await localPC.setLocalDescription(offerSDP);
      console.log('Uzak cihaza SDP isteği iletiliyor...');
      await remotePC.setRemoteDescription(localPC.localDescription);
      // Adım 2: Yerel cihazdan arama isteği (SDP) alındı. Yerel cihaza cevap gönderiliyor.
      console.log('Uzak cihazda cevap oluşturuluyor...');
      const answer = await remotePC.createAnswer();
      console.log('Uzak cihazda üretilen SDP cevabı:', answer.sdp);
      console.log('SDP cevabı yerel cihaza iletiliyor...');
      await remotePC.setLocalDescription(answer);
      // Adım 3: Uzak cihazın SDP yanıtı alınarak startIce() metodu çalıştırılıyor.
      await localPC.setRemoteDescription(remotePC.localDescription);
    } catch (err) {
      console.error(err);
    }
    setCachedLocalPC(localPC);
    setCachedRemotePC(remotePC);
  };

  const switchCamera = () => {
    (localStream as MediaStream)
      .getVideoTracks()
      // @ts-ignore
      .forEach((track: MediaStreamTrack) => track._switchCamera());
  };

  // Mutes the local's outgoing audio
  const toggleMute = () => {
    if (!remoteStream) {
      return;
    }
    (localStream as MediaStream).getAudioTracks().forEach((track) => {
      console.log(track.enabled ? 'muting' : 'unmuting', ' local track', track);
      track.enabled = !track.enabled;
      setIsMuted(!track.enabled);
    });
  };

  const closeStreams = () => {
    if (cachedLocalPC) {
      cachedLocalPC.removeStream(localStream as MediaStream);
      cachedLocalPC.close();
    }
    if (cachedRemotePC) {
      cachedRemotePC.removeStream(remoteStream as MediaStream);
      cachedRemotePC.close();
    }
    setLocalStream(false);
    setRemoteStream(false);
    setCachedRemotePC(undefined);
    setCachedLocalPC(undefined);
  };

  return (
    <SafeAreaView style={styles.container}>
      {!localStream && (
        <Button title="Kamerayı aç ve akışa başla" onPress={startLocalStream} />
      )}
      {localStream && (
        <Button
          title="Arama yap"
          onPress={startCall}
          disabled={!!remoteStream}
        />
      )}

      {localStream && (
        <View style={styles.toggleButtons}>
          <Button title="Diğer kamerayı aç" onPress={switchCamera} />
          <Button
            title={`Sesi ${isMuted ? 'aç' : 'kapat'}`}
            onPress={toggleMute}
            disabled={!remoteStream}
          />
        </View>
      )}
      <View style={styles.rtcview}>
        {localStream && (
          <RTCView
            style={styles.rtc}
            streamURL={(localStream as MediaStream).toURL()}
          />
        )}
      </View>
      <View style={styles.rtcview}>
        {remoteStream && (
          <RTCView
            style={styles.rtc}
            streamURL={(localStream as MediaStream).toURL()}
          />
        )}
      </View>
      <Button
        title="Aramayı sonlandır"
        onPress={closeStreams}
        disabled={!remoteStream}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#333',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: '100%',
  },
  text: {
    fontSize: 30,
  },
  rtcview: {
    justifyContent: 'center',
    alignItems: 'center',
    height: '40%',
    width: '80%',
    backgroundColor: 'black',
  },
  rtc: {
    width: '80%',
    height: '100%',
  },
  toggleButtons: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
});

export default App;
