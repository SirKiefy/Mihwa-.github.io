// live sky: sun, sunrise/sunset, moon, weather.
// sun maths is the NOAA low precision formula, good to a fraction of a degree
const RAD = Math.PI / 180;
const wrap180 = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
const daysJ2000 = (ms) => ms / 86400000 + 2440587.5 - 2451545.0;

// lat/lon where the sun is straight overhead
export function sunPosition(date) {
  const d = daysJ2000(date.getTime());
  const g = (357.529 + 0.98560028 * d) * RAD;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RAD;
  const e = (23.439 - 0.00000036 * d) * RAD;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)) / RAD;
  const dec = Math.asin(Math.sin(e) * Math.sin(L)) / RAD;
  const eqt = wrap180(q - ra); // equation of time, in degrees
  const utcH = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  return { lat: dec, lon: wrap180(-15 * (utcH - 12) - eqt) };
}

// degrees above the horizon
export function sunAltitude(lat, lon, date) {
  const s = sunPosition(date);
  const c = Math.sin(lat * RAD) * Math.sin(s.lat * RAD) + Math.cos(lat * RAD) * Math.cos(s.lat * RAD) * Math.cos((lon - s.lon) * RAD);
  return Math.asin(Math.max(-1, Math.min(1, c))) / RAD;
}

// day/twilight/night, plus ms until the next sunrise or sunset
export function skyAt(lat, lon, date) {
  const H0 = -0.833; // sun's radius + refraction
  const alt = sunAltitude(lat, lon, date);
  const up = alt > H0;
  const state = up ? 'day' : alt > -6 ? 'twilight' : 'night';
  const t0 = date.getTime();
  const step = 10 * 60000;
  for (let t = t0; t < t0 + 26 * 3600000; t += step) {
    if ((sunAltitude(lat, lon, new Date(t + step)) > H0) !== up) {
      let a = t, b = t + step;
      for (let k = 0; k < 14; k++) {
        const m = (a + b) / 2;
        if ((sunAltitude(lat, lon, new Date(m)) > H0) === up) a = m; else b = m;
      }
      return { alt, state, next: up ? 'set' : 'rise', in: b - t0 };
    }
  }
  return { alt, state, next: null, in: 0 };
}

// 0 new, .25 first quarter, .5 full, .75 last quarter
export function moonPhase(date) {
  const days = date.getTime() / 86400000 + 2440587.5 - 2451550.1;
  return (((days / 29.530588853) % 1) + 1) % 1;
}

export const MOON_NAMES = {
  en: ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'],
  fr: ['Nouvelle lune', 'Premier croissant', 'Premier quartier', 'Lune gibbeuse croissante', 'Pleine lune', 'Lune gibbeuse décroissante', 'Dernier quartier', 'Dernier croissant'],
  ko: ['신월', '초승달', '상현달', '차오르는 달', '보름달', '기우는 달', '하현달', '그믐달'],
};
export const moonIndex = (p) => Math.round(p * 8) % 8;

// open-meteo weather codes
const WX = [
  [[0], 'clear'], [[1, 2], 'cloudy'], [[3], 'overcast'], [[45, 48], 'fog'],
  [[51, 53, 55, 56, 57], 'drizzle'], [[61, 63, 65, 66, 67, 80, 81, 82], 'rain'],
  [[71, 73, 75, 77, 85, 86], 'snow'], [[95, 96, 99], 'storm'],
];
export const WEATHER_NAMES = {
  en: { clear: 'clear', cloudy: 'a few clouds', overcast: 'overcast', fog: 'fog', drizzle: 'drizzle', rain: 'rain', snow: 'snow', storm: 'thunderstorm' },
  fr: { clear: 'ciel dégagé', cloudy: 'quelques nuages', overcast: 'couvert', fog: 'brouillard', drizzle: 'bruine', rain: 'pluie', snow: 'neige', storm: 'orage' },
  ko: { clear: '맑음', cloudy: '구름 조금', overcast: '흐림', fog: '안개', drizzle: '이슬비', rain: '비', snow: '눈', storm: '뇌우' },
};

export async function fetchWeather(places, { timeout = 6000 } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const lat = places.map((p) => p.lat.toFixed(2)).join(',');
    const lon = places.map((p) => p.lon.toFixed(2)).join(',');
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`, { signal: ctl.signal });
    if (!r.ok) return null;
    const j = await r.json();
    return (Array.isArray(j) ? j : [j]).map((x) => {
      const code = x.current?.weather_code;
      const kind = (WX.find(([codes]) => codes.includes(code)) || [null, 'cloudy'])[1];
      return { temp: x.current?.temperature_2m, kind };
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
