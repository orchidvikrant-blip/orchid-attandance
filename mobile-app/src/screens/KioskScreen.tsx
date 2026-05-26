import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Dimensions, StatusBar,
  Animated, Image,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  initTensorFlow, isTfReady, base64ToTensor, detectFaces, matchFace,
} from '../services/faceRecognition';
import {
  getAllEmployees, markAttendance, getLastAttendanceType,
} from '../services/attendanceService';
import type { Employee } from '../services/attendanceService';
import * as tf from '@tensorflow/tfjs';

const { width: W } = Dimensions.get('window');
const SCAN_INTERVAL = 3000;

// Brand colors from Orchid logo
const C = {
  bg:      '#071022',
  card:    '#0a1628',
  border:  '#1e3a78',
  navy:    '#1e3a78',
  gold:    '#e8a820',
  white:   '#ffffff',
  textSub: '#4a6fa5',
  green:   '#22c55e',
  red:     '#ef4444',
};

type Status = 'idle' | 'scanning' | 'marked' | 'unknown';

export default function KioskScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [status, setStatus]       = useState<Status>('idle');
  const [employee, setEmployee]   = useState<Employee | null>(null);
  const [attType, setAttType]     = useState<'IN' | 'OUT'>('IN');
  const [timeStr, setTimeStr]     = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [initMsg, setInitMsg]     = useState('Initializing...');
  const locked    = useRef(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    (async () => {
      await requestPermission();
      setInitMsg('Loading AI model...');
      await initTensorFlow();
      setInitMsg('');
      const emps = await getAllEmployees();
      setEmployees(emps);
    })();
  }, []);

  // Gold border pulse when idle/scanning
  useEffect(() => {
    if (status === 'idle' || status === 'scanning') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.04, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [status]);

  const showResult = useCallback((
    s: Status, emp?: Employee, type?: 'IN' | 'OUT', time?: string
  ) => {
    setStatus(s);
    if (emp)  setEmployee(emp);
    if (type) setAttType(type);
    if (time) setTimeStr(time);

    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1,    duration: 300, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true }),
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 0,    duration: 400, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.85, duration: 300, useNativeDriver: true }),
      ]).start(() => {
        setStatus('idle');
        setEmployee(null);
        setTimeStr('');
        locked.current = false;
      });
    }, 4000);
  }, [fadeAnim, scaleAnim]);

  const scanOnce = useCallback(async () => {
    if (!cameraRef.current || locked.current || !isTfReady()) return;
    locked.current = true;
    setStatus('scanning');

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.6,
        base64: true,
        exif: false,
      });
      if (!photo?.base64) { locked.current = false; setStatus('idle'); return; }

      const tensor = await base64ToTensor(photo.base64);
      if (!tensor) { locked.current = false; setStatus('idle'); return; }

      const faces = await detectFaces(tensor);
      tf.dispose(tensor);

      if (faces.length === 0) { locked.current = false; setStatus('idle'); return; }

      const match = matchFace(faces[0], employees, photo.width ?? 640, photo.height ?? 480);
      if (!match) { showResult('unknown'); return; }

      const lastType = await getLastAttendanceType(match.employee.id);
      const nextType: 'IN' | 'OUT' = lastType === 'IN' ? 'OUT' : 'IN';
      await markAttendance(match.employee, nextType);
      const t = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      showResult('marked', match.employee, nextType, t);
    } catch (err) {
      console.error(err);
      locked.current = false;
      setStatus('idle');
    }
  }, [employees, showResult]);

  useEffect(() => {
    if (!isTfReady()) return;
    const id = setInterval(() => { if (status === 'idle') scanOnce(); }, SCAN_INTERVAL);
    return () => clearInterval(id);
  }, [status, scanOnce]);

  if (!permission?.granted) {
    return (
      <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: C.gold, fontSize: 16 }}>Camera permission required</Text>
      </View>
    );
  }

  const borderColor =
    status === 'marked'   ? C.green :
    status === 'unknown'  ? C.red   :
    status === 'scanning' ? C.gold  : C.navy;

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <View style={s.root}>
      <StatusBar hidden />

      {/* Header with logo */}
      <View style={s.header}>
        <Image
          source={require('../../assets/logo.png')}
          style={s.logo}
          resizeMode="contain"
        />
        <View style={s.headerDivider} />
        <Text style={s.headerDate}>{today}</Text>
      </View>

      {/* Camera frame */}
      <View style={s.camWrap}>
        <Animated.View style={[s.camBorder, { borderColor, transform: [{ scale: pulseAnim }] }]}>
          <CameraView ref={cameraRef} style={s.cam} facing="front" />
          {/* Corner marks */}
          {(['tl','tr','bl','br'] as const).map(p => (
            <View key={p} style={[s.corner, s[p], { borderColor }]} />
          ))}
        </Animated.View>

        {/* Smile message below camera */}
        <View style={s.smileWrap}>
          {status === 'scanning' ? (
            <View style={s.scanLabel}>
              <Text style={s.scanText}>⏳  Scanning face...</Text>
            </View>
          ) : (
            <Text style={s.smileText}>😊  Smile! Look straight into the camera</Text>
          )}
        </View>
      </View>

      {/* Status / Result overlay */}
      <View style={s.statusWrap}>
        {initMsg ? (
          <Text style={{ color: C.gold, fontSize: 14, letterSpacing: 0.5 }}>{initMsg}</Text>
        ) : status === 'idle' ? (
          <View style={{ alignItems: 'center' }}>
            <Text style={s.idleMain}>Place your face in front of the camera</Text>
            <Text style={s.idleSub}>Attendance will be marked automatically</Text>
          </View>
        ) : status === 'scanning' ? null : (
          <Animated.View style={[
            s.resultCard,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
              backgroundColor: status === 'marked' ? '#0a2a18' : '#1a0a0a',
              borderColor: status === 'marked' ? C.green : C.red,
            },
          ]}>
            {status === 'marked' && employee ? (
              <>
                {/* Thank You message */}
                <Text style={s.thankYou}>🙏  Thank You!</Text>
                <Text style={s.empName}>{employee.name}</Text>
                <Text style={s.empDept}>{employee.department}</Text>

                <View style={[s.typeBadge, {
                  backgroundColor: attType === 'IN' ? '#166534' : '#7c3200',
                  borderColor: attType === 'IN' ? C.green : C.gold,
                }]}>
                  <Text style={[s.typeText, { color: attType === 'IN' ? C.green : C.gold }]}>
                    {attType === 'IN' ? '✅  CHECKED IN' : '👋  CHECKED OUT'}
                  </Text>
                </View>

                <Text style={s.timeText}>{timeStr}</Text>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>❌</Text>
                <Text style={s.unknownText}>Face not recognized</Text>
                <Text style={s.unknownSub}>Please contact the administrator</Text>
              </>
            )}
          </Animated.View>
        )}
      </View>

      {/* Footer */}
      <View style={s.footer}>
        <View style={s.footerDot} />
        <Text style={s.footerText}>
          {isTfReady()
            ? `${employees.length} employees registered  •  System Active`
            : 'Loading AI model...'}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    paddingTop: 36, paddingBottom: 14, alignItems: 'center',
    backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  logo:   { width: W * 0.38, height: 52 },
  headerDivider: { width: 40, height: 2, backgroundColor: C.gold, marginTop: 10, borderRadius: 1 },
  headerDate: { color: C.textSub, fontSize: 12, marginTop: 8, letterSpacing: 0.3 },

  // Camera
  camWrap:   { flex: 1, justifyContent: 'center', alignItems: 'center' },
  camBorder: {
    width: W * 0.70, height: W * 0.86,
    borderRadius: 20, borderWidth: 2.5, overflow: 'hidden',
  },
  cam: { flex: 1 },

  corner:  { position: 'absolute', width: 20, height: 20, borderWidth: 3 },
  tl: { top: -1, left: -1,   borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 18 },
  tr: { top: -1, right: -1,  borderLeftWidth: 0,  borderBottomWidth: 0, borderTopRightRadius: 18 },
  bl: { bottom: -1, left: -1,  borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 18 },
  br: { bottom: -1, right: -1, borderLeftWidth: 0,  borderTopWidth: 0, borderBottomRightRadius: 18 },

  scanLabel: { position: 'absolute', bottom: 16, alignSelf: 'center',
    backgroundColor: '#e8a82033', paddingHorizontal: 20, paddingVertical: 6, borderRadius: 20 },
  scanText:  { color: C.gold, fontSize: 14, fontWeight: '600' },

  // Status
  statusWrap: { height: 150, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  idleMain:   { color: '#c8d8f0', fontSize: 16, fontWeight: '500', textAlign: 'center' },
  idleSub:    { color: C.textSub, fontSize: 12, marginTop: 6 },

  resultCard: {
    width: '100%', borderRadius: 16, padding: 18,
    alignItems: 'center', borderWidth: 1,
  },
  thankYou:  { color: C.gold, fontSize: 20, fontWeight: '700', marginBottom: 6, letterSpacing: 0.5 },
  empName:   { color: C.white, fontSize: 22, fontWeight: '800' },
  empDept:   { color: C.textSub, fontSize: 13, marginTop: 2 },
  typeBadge: {
    marginTop: 12, paddingHorizontal: 28, paddingVertical: 7,
    borderRadius: 22, borderWidth: 1,
  },
  typeText:  { fontSize: 15, fontWeight: '800', letterSpacing: 1.5 },
  timeText:  { color: '#4a6fa5', fontSize: 12, marginTop: 10 },

  unknownText: { color: '#fca5a5', fontSize: 17, fontWeight: '700' },
  unknownSub:  { color: '#4a6fa5', fontSize: 12, marginTop: 6 },

  // Footer
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 11, backgroundColor: C.card,
    borderTopWidth: 1, borderTopColor: C.border, gap: 8,
  },
  footerDot:  { width: 7, height: 7, borderRadius: 4, backgroundColor: C.green },
  footerText: { color: C.textSub, fontSize: 11, letterSpacing: 0.3 },

  smileWrap:  { marginTop: 14, alignItems: 'center' },
  smileText:  { color: C.gold, fontSize: 13, fontWeight: '500', letterSpacing: 0.3 },
});
