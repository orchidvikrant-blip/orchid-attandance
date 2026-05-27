import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, Dimensions, Image, StatusBar, StyleSheet, Text, View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Speech from 'expo-speech';
import {
  initTensorFlow, isTfReady, recognizeWithLuxand, type ProgressFn, type LuxandMatch,
} from '../services/faceRecognition';
import { getAllEmployees, getLastAttendanceType, markAttendance } from '../services/attendanceService';
import type { Employee } from '../services/attendanceService';

const { width: W } = Dimensions.get('window');
const CAM_W = W * 0.70;
const CAM_H = W * 0.86;

// Delay after no face recognised before next scan (ms)
const IDLE_DELAY   = 800;
// Delay after showing result before scanning again
const RESULT_DELAY = 3200;

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

  const [status,    setStatus]   = useState<Status>('idle');
  const [employee,  setEmployee] = useState<Employee | null>(null);
  const [attType,   setAttType]  = useState<'IN' | 'OUT'>('IN');
  const [timeStr,   setTimeStr]  = useState('');
  const [initMsg,   setInitMsg]  = useState('Initializing...');
  const [debugMsg,  setDebugMsg] = useState('');

  const employeesRef = useRef<Employee[]>([]);
  const locked       = useRef(false);
  const isMounted    = useRef(true);
  const scanRef      = useRef<(() => Promise<void>) | undefined>(undefined);
  const [employees,  setEmployees] = useState<Employee[]>([]);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => { return () => { isMounted.current = false; }; }, []);

  const scheduleNext = useCallback((delay: number) => {
    if (!isMounted.current) return;
    setTimeout(() => { if (isMounted.current) scanRef.current?.(); }, delay);
  }, []);

  const showResult = useCallback((
    s: Status, emp?: Employee, type?: 'IN' | 'OUT', time?: string
  ) => {
    setStatus(s);
    if (emp)  setEmployee(emp);
    if (type) setAttType(type);
    if (time) setTimeStr(time);

    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 0, duration: 350, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.85, duration: 250, useNativeDriver: true }),
      ]).start(() => {
        if (!isMounted.current) return;
        setStatus('idle');
        setEmployee(null);
        setTimeStr('');
        locked.current = false;
        scheduleNext(IDLE_DELAY);
      });
    }, 3000);
  }, [fadeAnim, scaleAnim, scheduleNext]);

  const scan = useCallback(async () => {
    if (!cameraRef.current || locked.current || !isTfReady()) {
      scheduleNext(500);
      return;
    }
    locked.current = true;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5, exif: false,
      });
      if (!photo?.uri) { locked.current = false; scheduleNext(IDLE_DELAY); return; }

      setStatus('scanning');

      const luxand = await Promise.race([
        recognizeWithLuxand(photo.uri),
        new Promise<null>(r => setTimeout(() => r(null), 15000)),
      ]) as LuxandMatch | null;

      if (!luxand) {
        setDebugMsg('No face / no match');
        setStatus('idle');
        locked.current = false;
        scheduleNext(IDLE_DELAY);
        return;
      }

      setDebugMsg(`Luxand: ${luxand.name} (${luxand.uuid.slice(0,8)}) sim:${luxand.similarity}`);

      // Match by luxandPersonId (UUID) or by name as fallback
      const match =
        employeesRef.current.find(e => e.luxandPersonId === luxand.uuid) ??
        employeesRef.current.find(e => e.name.toLowerCase() === luxand.name.toLowerCase()) ??
        null;

      if (!match) {
        Speech.speak('Please try again', { language: 'en-IN', rate: 0.9 });
        showResult('unknown');
        return;
      }

      const lastType = await getLastAttendanceType(match.id);
      const nextType: 'IN' | 'OUT' = lastType === 'IN' ? 'OUT' : 'IN';
      await markAttendance(match, nextType);
      const t = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      Speech.speak(
        `Thank you ${match.name}, checked ${nextType === 'IN' ? 'in' : 'out'}`,
        { language: 'en-IN', rate: 0.9 }
      );
      showResult('marked', match, nextType, t);

    } catch (e) {
      console.error(e);
      setStatus('idle');
      locked.current = false;
      scheduleNext(IDLE_DELAY);
    }
  }, [scheduleNext, showResult]);

  useEffect(() => { scanRef.current = scan; });

  const [serviceReady, setServiceReady] = useState(false);

  useEffect(() => {
    (async () => {
      await requestPermission();
      const onProgress: ProgressFn = (msg) => setInitMsg(msg);
      setInitMsg('Starting...');
      try {
        await initTensorFlow(onProgress);
      } catch (e: any) {
        setInitMsg('ERROR: ' + String(e?.message ?? e));
        return;
      }
      setInitMsg('');
      const emps = await getAllEmployees();
      employeesRef.current = emps;
      setEmployees(emps);
      setServiceReady(true);
    })();
  }, []);

  useEffect(() => {
    if (serviceReady) scheduleNext(500);
  }, [serviceReady, scheduleNext]);

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

      {/* Header */}
      <View style={s.header}>
        <Image source={require('../../assets/logo.png')} style={s.logo} resizeMode="contain" />
        <View style={s.headerDivider} />
        <Text style={s.headerDate}>{today}</Text>
      </View>

      {/* Camera */}
      <View style={s.camWrap}>
        <Animated.View style={[s.camBorder, { borderColor, transform: [{ scale: pulseAnim }] }]}>
          <CameraView ref={cameraRef} style={s.cam} facing="front" />

          {/* Corner brackets */}
          {(['tl','tr','bl','br'] as const).map(p => (
            <View key={p} style={[s.corner, s[p], { borderColor }]} />
          ))}
        </Animated.View>

        <View style={s.smileWrap}>
          {status === 'scanning'
            ? <View style={s.scanLabel}><Text style={s.scanText}>⏳  Recognizing...</Text></View>
            : <Text style={s.smileText}>😊  Smile! Look straight into the camera</Text>
          }
        </View>
      </View>

      {/* Status area */}
      <View style={s.statusWrap}>
        {initMsg ? (
          <Text style={{ color: C.gold, fontSize: 14 }}>{initMsg}</Text>
        ) : status === 'idle' || status === 'scanning' ? (
          <View style={{ alignItems: 'center' }}>
            <Text style={s.idleMain}>Place your face in front of the camera</Text>
            <Text style={s.idleSub}>Attendance will be marked automatically</Text>
          </View>
        ) : (
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
                <Text style={s.thankYou}>🙏  Thank You!</Text>
                <Text style={s.empName}>{employee.name}</Text>
                <Text style={s.empDept}>{employee.department}</Text>
                <View style={[s.typeBadge, {
                  backgroundColor: attType === 'IN' ? '#166534' : '#7c3200',
                  borderColor:     attType === 'IN' ? C.green   : C.gold,
                }]}>
                  <Text style={[s.typeText, { color: attType === 'IN' ? C.green : C.gold }]}>
                    {attType === 'IN' ? '✅  CHECKED IN' : '👋  CHECKED OUT'}
                  </Text>
                </View>
                <Text style={s.timeText}>{timeStr}</Text>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 38, marginBottom: 6 }}>🔄</Text>
                <Text style={s.unknownText}>Please Try Again</Text>
                <Text style={s.unknownSub}>Move closer · Look straight at camera</Text>
              </>
            )}
          </Animated.View>
        )}
      </View>

      {/* Debug bar */}
      {!!debugMsg && (
        <View style={{ backgroundColor: '#111', paddingHorizontal: 12, paddingVertical: 4 }}>
          <Text style={{ color: '#facc15', fontSize: 10, fontFamily: 'monospace' }}>{debugMsg}</Text>
        </View>
      )}

      {/* Footer */}
      <View style={s.footer}>
        <View style={s.footerDot} />
        <Text style={s.footerText}>
          {serviceReady
            ? `${employees.length} employees  •  Luxand Cloud  •  Active`
            : 'Connecting...'}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  header: {
    paddingTop: 36, paddingBottom: 14, alignItems: 'center',
    backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  logo:          { width: W * 0.38, height: 52 },
  headerDivider: { width: 40, height: 2, backgroundColor: C.gold, marginTop: 10, borderRadius: 1 },
  headerDate:    { color: C.textSub, fontSize: 12, marginTop: 8, letterSpacing: 0.3 },

  camWrap:   { flex: 1, justifyContent: 'center', alignItems: 'center' },
  camBorder: {
    width: CAM_W, height: CAM_H,
    borderRadius: 20, borderWidth: 2.5, overflow: 'hidden',
  },
  cam: { flex: 1 },

  corner: { position: 'absolute', width: 20, height: 20, borderWidth: 3 },
  tl: { top: -1,    left: -1,  borderRightWidth: 0,  borderBottomWidth: 0, borderTopLeftRadius: 18 },
  tr: { top: -1,    right: -1, borderLeftWidth: 0,   borderBottomWidth: 0, borderTopRightRadius: 18 },
  bl: { bottom: -1, left: -1,  borderRightWidth: 0,  borderTopWidth: 0,    borderBottomLeftRadius: 18 },
  br: { bottom: -1, right: -1, borderLeftWidth: 0,   borderTopWidth: 0,    borderBottomRightRadius: 18 },

  smileWrap: { marginTop: 14, alignItems: 'center' },
  smileText: { color: C.gold, fontSize: 13, fontWeight: '500', letterSpacing: 0.3 },
  scanLabel: { backgroundColor: '#e8a82033', paddingHorizontal: 20, paddingVertical: 6, borderRadius: 20 },
  scanText:  { color: C.gold, fontSize: 14, fontWeight: '600' },

  statusWrap: { height: 150, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  idleMain:   { color: '#c8d8f0', fontSize: 16, fontWeight: '500', textAlign: 'center' },
  idleSub:    { color: C.textSub, fontSize: 12, marginTop: 6 },

  resultCard: {
    width: '100%', borderRadius: 16, padding: 18, alignItems: 'center', borderWidth: 1,
  },
  thankYou:  { color: C.gold, fontSize: 20, fontWeight: '700', marginBottom: 6 },
  empName:   { color: C.white, fontSize: 22, fontWeight: '800' },
  empDept:   { color: C.textSub, fontSize: 13, marginTop: 2 },
  typeBadge: {
    marginTop: 12, paddingHorizontal: 28, paddingVertical: 7, borderRadius: 22, borderWidth: 1,
  },
  typeText:    { fontSize: 15, fontWeight: '800', letterSpacing: 1.5 },
  timeText:    { color: '#4a6fa5', fontSize: 12, marginTop: 10 },
  unknownText: { color: '#fca5a5', fontSize: 20, fontWeight: '700' },
  unknownSub:  { color: '#94a3b8', fontSize: 13, marginTop: 6 },

  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 11, backgroundColor: C.card,
    borderTopWidth: 1, borderTopColor: C.border, gap: 8,
  },
  footerDot:  { width: 7, height: 7, borderRadius: 4, backgroundColor: C.green },
  footerText: { color: C.textSub, fontSize: 11, letterSpacing: 0.3 },
});
