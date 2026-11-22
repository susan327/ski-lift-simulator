export function createRideAudio(button, chime, jointClip, announcementFiles, speakers = {}) {
  let engine, enabled=false, lastUpdate=-Infinity;
  let previousJointPhase = null;
  const announcements = new Map();
  const loadingAnnouncements = new Set();
  const AudioEngine=window.AudioContext || window.webkitAudioContext;
  button.hidden=!AudioEngine;

  function setup() {
    const context=new AudioEngine();
    const buffer=context.createBuffer(1,context.sampleRate*3,context.sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++) data[i]=Math.random()*2-1;
    const master=context.createGain();
    master.gain.value=0;
    master.connect(context.destination);

    function noise(type, frequency) {
      const source=context.createBufferSource();
      source.buffer=buffer;
      source.loop=true;
      const filter=context.createBiquadFilter();
      filter.type=type;
      filter.frequency.value=frequency;
      filter.Q.value=.55;
      const gain=context.createGain();
      gain.gain.value=0;
      source.connect(filter).connect(gain).connect(master);
      source.start();
      return {gain,filter};
    }

    const wind=noise('lowpass',490);
    const rollers=noise('bandpass',165);
    const snow=noise('highpass',990);
    const motor=context.createOscillator();
    motor.type='triangle';
    motor.frequency.value=47;
    const motorGain=context.createGain();
    motorGain.gain.value=0;
    motor.connect(motorGain).connect(master);
    motor.start();
    const motorHum = context.createOscillator();
    motorHum.type = 'sine';
    motorHum.frequency.value = 96;
    const humGain = context.createGain();
    humGain.gain.value = 0;
    motorHum.connect(humGain).connect(master);
    motorHum.start();
    return {context,buffer,master,wind,rollers,snow,motor,motorGain,motorHum,humGain};
  }

  button.addEventListener('click', async () => {
    if(!AudioEngine)return;
    try{
      engine??=setup();
      await engine.context.resume();
      enabled=!enabled;
      if (enabled && announcementFiles) {
        for (const [name, url] of Object.entries(announcementFiles)) {
          if (!announcements.has(name) && !loadingAnnouncements.has(name)) loadAnnouncement(name, url);
        }
      }

      button.setAttribute('aria-pressed',String(enabled));
      button.textContent=enabled?'環境音を切る':'環境音を聴く';
      engine.master.gain.setTargetAtTime(enabled?.65:0,engine.context.currentTime,.07);
    } catch {
      button.disabled=true;
      button.textContent='環境音を再生できません';
    }
  });

  async function loadAnnouncement(name, url) {
    loadingAnnouncements.add(name);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(String(response.status));
      announcements.set(name, await engine.context.decodeAudioData(await response.arrayBuffer()));
    } catch (error) {
      console.warn('案内放送を読み込めませんでした', name, error);
    } finally {
      loadingAnnouncements.delete(name);
    }
  }

  function update({zone,speed,quad,quiet,motorLevel,jointPhase}) {
    if(!engine||!enabled)return;
    const t=engine.context.currentTime;
    const activeJointPhase = quiet ? null : jointPhase;
    const jointActive = Boolean(activeJointPhase);
    if (activeJointPhase && activeJointPhase !== previousJointPhase) playClip(jointClip);
    previousJointPhase = activeJointPhase;
    if (t-lastUpdate<.07) return;
    lastUpdate=t;
    const station=zone==='station'&&!quiet;
    const flying=zone==='line'&&!quiet;
    const skiing=zone==='ski'&&!quiet;
    engine.wind.gain.gain.setTargetAtTime(flying?.09+speed*.018:skiing?speed*.012:0,t,.22);
    engine.wind.filter.frequency.setTargetAtTime(440+speed*65,t,.22);
    engine.rollers.gain.gain.setTargetAtTime(station?(quad?(jointActive?.075:.19):.12):0,t,.19);
    engine.rollers.filter.frequency.setTargetAtTime(130+speed*38,t,.14);
    const motorVolume = quiet ? 0 : motorLevel;
    engine.motorGain.gain.setTargetAtTime(motorVolume * (jointActive ? .069 : .105),t,.16);
    engine.humGain.gain.setTargetAtTime(motorVolume * .026,t,.16);
    const motorHz = quad ? 49 : 43;
    engine.motor.frequency.setTargetAtTime(motorHz,t,.14);
    engine.motorHum.frequency.setTargetAtTime(motorHz * 2.03,t,.14);
    engine.snow.gain.gain.setTargetAtTime(skiing?speed*.015:0,t,.16);
  }

  function clack(at, frequency, volume, duration) {
    const { context, buffer, master } = engine;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = 1.2;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + .004);
    gain.gain.exponentialRampToValueAtTime(.001, at + duration);
    source.connect(filter).connect(gain).connect(master);
    source.start(at, Math.random() * 2);
    source.stop(at + duration + .01);
  }

  function towerPass(speed) {
    if (!engine || !enabled) return;
    const spacing = .46 / Math.max(speed, 1);
    for (let i = 0; i < 4; i++) {
      clack(engine.context.currentTime + i * spacing, i % 2 === 0 ? 460 : 720,
        i === 0 ? .34 : .22, .09);
    }
  }

  const clipBuffers = new Map();
  const panners = new Map();
  function speakerOutput(name) {
    const speaker = speakers[name];
    if (!speaker) return engine.master;
    if (!panners.has(name)) {
      const { position, direction } = speaker;
      const panner = engine.context.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 5;
      panner.rolloffFactor = .85;
      panner.coneInnerAngle = 110;
      panner.coneOuterAngle = 250;
      panner.coneOuterGain = .50;
      panner.positionX.value = position.x;
      panner.positionY.value = position.y;
      panner.positionZ.value = position.z;
      panner.orientationX.value = direction.x;
      panner.orientationY.value = direction.y;
      panner.orientationZ.value = direction.z;
      panner.connect(engine.master);
      panners.set(name, panner);
    }
    return panners.get(name);
  }

  function setListener(position, forward, up) {
    if (!engine || !enabled) return;
    const { listener, currentTime } = engine.context;
    listener.positionX.setValueAtTime(position.x, currentTime);
    listener.positionY.setValueAtTime(position.y, currentTime);
    listener.positionZ.setValueAtTime(position.z, currentTime);
    listener.forwardX.setValueAtTime(forward.x, currentTime);
    listener.forwardY.setValueAtTime(forward.y, currentTime);
    listener.forwardZ.setValueAtTime(forward.z, currentTime);
    listener.upX.setValueAtTime(up.x, currentTime);
    listener.upY.setValueAtTime(up.y, currentTime);
    listener.upZ.setValueAtTime(up.z, currentTime);
  }

  function playClip(clip, speaker) {
    if (!engine || !enabled || !clip) return;
    const { context, master } = engine;
    let buffer = clipBuffers.get(clip);
    if (!buffer) {
      const samples = clip.createSamples();
      buffer = context.createBuffer(1, samples.length, clip.sampleRate);
      buffer.copyToChannel(samples, 0);
      clipBuffers.set(clip, buffer);
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(speaker ? speakerOutput(speaker) : master);
    source.start();
    return buffer.duration;
  }

  function boardingChime() {
    const duration = playClip(chime, 'boarding');
    if (duration !== undefined) announce('boarding', duration + .06);
  }

  function announce(name, delay = 0) {
    const buffer = announcements.get(name);
    if (!enabled || !buffer) return;
    const { context } = engine;
    const source = context.createBufferSource();
    const lowCut = context.createBiquadFilter();
    const highCut = context.createBiquadFilter();
    const presence = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    lowCut.type = 'highpass';
    lowCut.frequency.value = 310;
    highCut.type = 'lowpass';
    highCut.frequency.value = 3950;
    presence.type = 'peaking';
    presence.frequency.value = 1550;
    presence.Q.value = .85;
    presence.gain.value = 3.5;
    gain.gain.value = .86;
    source.connect(lowCut).connect(highCut).connect(presence).connect(gain).connect(speakerOutput(name));
    source.start(context.currentTime + delay);
  }

  return {update,towerPass,boardingChime,announce,setListener};
}
