/* ============================================================
   box-box — Alpine.js page components
   ============================================================ */

// ---- Shared helpers ----

// Convert ISO 3166-1 alpha-2 country code → emoji flag (mirrors TUI countryFlag).
function flagEmoji(code) {
  if (!code || code.length !== 2) return '🏁';
  const offset = 0x1F1E6 - 65; // Regional Indicator A offset
  return String.fromCodePoint(
    code.toUpperCase().charCodeAt(0) + offset,
    code.toUpperCase().charCodeAt(1) + offset
  );
}

// Current F1 season year derived from today's date.
function currentSeason() {
  return new Date().getFullYear();
}

// ---- Root state: routing + live check ----

function appState() {
  return {
    page: 'home',
    isLive: false,
    staleWarning: false,

    init() {
      this.parseRoute();
      window.addEventListener('hashchange', () => this.parseRoute());
      this.checkLive();
      setInterval(() => this.checkLive(), 30000);
    },

    parseRoute() {
      const hash = window.location.hash || '#/';
      const path = hash.slice(1) || '/';
      if (path === '/' || path === '') {
        this.page = 'home';
      } else if (path.startsWith('/race/')) {
        this.page = 'race';
      } else if (path === '/live') {
        this.page = 'live';
      } else if (path === '/standings') {
        this.page = 'standings';
      } else {
        this.page = 'home';
      }
    },

    async checkLive() {
      try {
        const r = await fetch('/api/v1/live/state');
        if (!r.ok) return;
        const data = await r.json();
        this.isLive = !!data.is_live;
      } catch (_) {}
    },
  };
}

// ---- Home page ----

function homePage() {
  return {
    loading: true,
    meetings: [],
    champDrivers: [],
    nextRace: null,
    countdown: '',
    season: currentSeason(),
    _countdownTimer: null,

    async init() {
      this.loading = true;
      await Promise.all([
        this.loadMeetings(),
        this.loadChampionship(),
      ]);
      this.loading = false;
      this.startCountdown();
    },

    async loadMeetings() {
      try {
        const r = await fetch(`/api/v1/meetings?year=${this.season}`);
        const data = await r.json();
        this.meetings = Array.isArray(data) ? data : [];
        // Find next race
        const now = Date.now();
        this.nextRace = this.meetings.find(m => new Date(m.date_start).getTime() > now) || null;
      } catch (_) {}
    },

    async loadChampionship() {
      try {
        const r = await fetch(`/api/v1/championship/drivers?year=${this.season}`);
        const data = await r.json();
        this.champDrivers = Array.isArray(data)
          ? [...data].sort((a, b) => a.position_current - b.position_current)
          : [];
      } catch (_) {}
    },

    startCountdown() {
      if (!this.nextRace) return;
      const target = new Date(this.nextRace.date_start).getTime();
      const update = () => {
        const diff = target - Date.now();
        if (diff <= 0) { this.countdown = 'Race day!'; return; }
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        this.countdown = d > 0
          ? `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`
          : `${pad(h)}:${pad(m)}:${pad(s)}`;
      };
      update();
      this._countdownTimer = setInterval(update, 1000);
    },

    barWidth(pts) {
      if (!this.champDrivers.length) return 0;
      const max = this.champDrivers[0].points_current;
      return max > 0 ? Math.round((pts / max) * 100) : 0;
    },

    flagEmoji,
    isPast(m) { return new Date(m.date_start).getTime() < Date.now(); },
    fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-GB', {day:'numeric',month:'short'}) : ''; },

    destroy() { clearInterval(this._countdownTimer); },
  };
}

// ---- Race page ----

function racePage() {
  return {
    meetingKey: 0,
    meetingName: '',
    year: 2025,
    sessions: [],
    activeSession: null,
    tab: 'results',
    drivers: [],

    // Results
    results: [],
    resultsLoading: false,

    // Strategy
    strategyData: null,
    strategyLoading: false,
    strategyNote: '',

    // Laps comparison
    lapsData: null,
    lapsLoading: false,

    // Track
    trackData: null,
    trackLoading: false,

    // Telemetry
    telemetryDrivers: [],
    telemetryData: [],
    telemetryLoading: false,

    // Resize observers
    _observers: [],

    async init() {
      const hash = window.location.hash || '';
      const m = hash.match(/#\/race\/(\d+)/);
      if (!m) return;
      this.meetingKey = parseInt(m[1]);

      // Load sessions
      try {
        const r = await fetch(`/api/v1/sessions?meeting_key=${this.meetingKey}`);
        this.sessions = await r.json();
        if (this.sessions.length) {
          // Prefer Race session, else last session
          const race = this.sessions.find(s => s.session_type === 'Race')
                    || this.sessions[this.sessions.length - 1];
          await this.selectSession(race);
        }
      } catch (_) {}
    },

    async selectSession(sess) {
      this.activeSession = sess;
      // Extract year from date_start
      this.year = sess.date_start ? parseInt(sess.date_start.slice(0, 4)) : 2025;
      // Clear all lazy-loaded data
      this.strategyData = null;
      this.strategyNote = '';
      this.lapsData = null;
      this.trackData = null;
      this.telemetryData = [];
      this.telemetryDrivers = [];

      await Promise.all([
        this.loadResults(sess.session_key),
        this.loadDrivers(sess.session_key),
      ]);
    },

    async loadResults(sk) {
      this.resultsLoading = true;
      try {
        const r = await fetch(`/api/v1/results?session_key=${sk}`);
        const data = await r.json();
        this.results = Array.isArray(data)
          ? [...data].sort((a, b) => (a.position || 99) - (b.position || 99))
          : [];
        this.meetingName = '';
        if (this.sessions.length) {
          const sess = this.sessions.find(s => s.session_key === sk);
          this.meetingName = sess?.meeting_key ? `Round — Meeting ${this.meetingKey}` : '';
        }
      } catch (_) { this.results = []; }
      this.resultsLoading = false;
    },

    async loadDrivers(sk) {
      try {
        const r = await fetch(`/api/v1/drivers?session_key=${sk}`);
        this.drivers = await r.json();
        // Set default meeting name from sessions list
        const sess = this.sessions.find(s => s.session_key === sk);
        if (!this.meetingName && this.sessions.length) {
          this.meetingName = `Meeting ${this.meetingKey}`;
        }
      } catch (_) { this.drivers = []; }
    },

    async loadStrategy() {
      if (this.strategyData || this.strategyLoading || !this.activeSession) return;
      this.strategyLoading = true;
      try {
        const r = await fetch(`/api/v1/strategy?session_key=${this.activeSession.session_key}`);
        const data = await r.json();
        if (data.note) {
          this.strategyNote = data.note;
        } else {
          this.strategyData = data;
        }
      } catch (_) { this.strategyNote = 'Failed to load strategy data.'; }
      this.strategyLoading = false;
    },

    renderStrategy() {
      if (!this.strategyData) return;
      this.$nextTick(() => Charts.renderStrategy('strategy-chart', this.strategyData));
    },

    async loadLaps() {
      if (this.lapsData || this.lapsLoading || !this.activeSession) return;
      this.lapsLoading = true;
      try {
        const r = await fetch(`/api/v1/laps/comparison?session_key=${this.activeSession.session_key}`);
        this.lapsData = await r.json();
      } catch (_) {}
      this.lapsLoading = false;
    },

    renderLapTimes() {
      if (!this.lapsData) return;
      this.$nextTick(() => Charts.renderLapTimes('laps-chart', this.lapsData));
    },

    async loadTrack() {
      if (this.trackData || this.trackLoading || !this.activeSession) return;
      this.trackLoading = true;
      try {
        const ck = this.activeSession.circuit_key;
        const yr = this.year;
        const r = await fetch(`/api/v1/track-outline?circuit_key=${ck}&year=${yr}`);
        const data = await r.json();
        if (data.points && data.points.length > 0) {
          this.trackData = data;
        }
      } catch (_) {}
      this.trackLoading = false;
    },

    renderTrack() {
      if (!this.trackData) return;
      this.$nextTick(() => Track.render('track-chart', this.trackData.points, [], {}));
    },

    async toggleTelemetryDriver(driverNumber) {
      if (this.telemetryDrivers.includes(driverNumber)) {
        this.telemetryDrivers = this.telemetryDrivers.filter(n => n !== driverNumber);
      } else {
        if (this.telemetryDrivers.length >= 3) return; // max 3
        this.telemetryDrivers.push(driverNumber);
      }
      await this.loadTelemetry();
    },

    async loadTelemetry() {
      if (!this.activeSession || this.telemetryDrivers.length === 0) {
        this.telemetryData = [];
        return;
      }
      this.telemetryLoading = true;
      const sk = this.activeSession.session_key;
      const results = await Promise.all(
        this.telemetryDrivers.map(dn =>
          fetch(`/api/v1/telemetry?session_key=${sk}&driver_number=${dn}`)
            .then(r => r.json())
            .then(data => ({ driverNumber: dn, data: Array.isArray(data) ? data : [] }))
            .catch(() => ({ driverNumber: dn, data: [] }))
        )
      );
      this.telemetryData = results.map(r => {
        const driver = this.drivers.find(d => d.driver_number === r.driverNumber);
        return {
          driverNumber: r.driverNumber,
          nameAcronym: driver?.name_acronym || String(r.driverNumber),
          teamColour: driver?.team_colour || '888888',
          data: r.data,
        };
      });
      this.telemetryLoading = false;
    },

    renderTelemetry() {
      if (!this.telemetryData.length) return;
      this.$nextTick(() => Charts.renderTelemetry('telemetry-chart', this.telemetryData));
    },

    fmtDuration(v) {
      if (v === null || v === undefined) return '-';
      if (Array.isArray(v)) return v.map(t => fmtSecs(t)).join(' / ');
      return fmtSecs(v);
    },
  };
}

// ---- Live page ----

function livePage() {
  return {
    isLive: false,
    drivers: {},
    driverInfo: {},
    tyres: {},
    stints: {},
    rcMessages: [],
    trackStatus: '',
    currentLap: 0,
    totalLaps: 0,
    clock: '',
    clockRefTime: null,
    clockExtrapolating: false,
    session: {},
    _es: null,
    _clockTimer: null,
    clockDisplay: '',

    init() {
      this.connectSSE();
      this._clockTimer = setInterval(() => this.updateClock(), 1000);
    },

    cleanup() {
      if (this._es) this._es.close();
      clearInterval(this._clockTimer);
    },

    connectSSE() {
      const es = new EventSource('/api/v1/live/stream');
      this._es = es;

      es.addEventListener('snapshot', e => {
        try {
          const msg = JSON.parse(e.data);
          this.isLive = !!msg.is_live;
          if (msg.data) this.applySnapshot(msg.data);
        } catch (_) {}
      });

      es.addEventListener('heartbeat', () => {});

      es.onerror = () => {
        this.isLive = false;
        setTimeout(() => this.connectSSE(), 5000);
        es.close();
      };
    },

    applySnapshot(d) {
      if (d.Drivers)     this.drivers    = d.Drivers;
      if (d.DriverInfo)  this.driverInfo = d.DriverInfo;
      if (d.Tyres)       this.tyres      = d.Tyres;
      if (d.Stints)      this.stints     = d.Stints;
      if (d.RCMessages)  this.rcMessages = d.RCMessages;
      if (d.TrackStatus) this.trackStatus = d.TrackStatus;
      if (d.CurrentLap)  this.currentLap  = d.CurrentLap;
      if (d.TotalLaps)   this.totalLaps   = d.TotalLaps;
      if (d.Clock)       this.clock       = d.Clock;
      if (d.ClockRefTime) this.clockRefTime = new Date(d.ClockRefTime);
      if (d.ClockExtrapolating !== undefined) this.clockExtrapolating = d.ClockExtrapolating;
      if (d.Session)     this.session     = d.Session;
    },

    get sortedDrivers() {
      return Object.values(this.drivers)
        .filter(d => d.Position > 0)
        .sort((a, b) => a.Position - b.Position);
    },

    driverTla(num) {
      return this.driverInfo[num]?.Tla || num;
    },

    driverTeamColor(num) {
      return this.driverInfo[num]?.TeamColour || '666666';
    },

    tyreLabel(num) {
      const t = this.tyres[num];
      if (!t) return '?';
      return `${t.Compound?.charAt(0) || '?'} +${t.Age || 0}`;
    },

    tyreClass(num) {
      const t = this.tyres[num];
      if (!t) return 'tyre-unknown';
      return 'tyre-' + (t.Compound || 'unknown').toLowerCase();
    },

    posDelta(d) {
      if (!d.PrevPosition || d.PrevPosition === d.Position) return '';
      return d.PrevPosition > d.Position ? '▲' : '▼';
    },

    trackStatusText() {
      const map = {'1':'GREEN','2':'YELLOW','4':'SC','5':'RED','6':'VSC'};
      return map[this.trackStatus] || this.trackStatus;
    },

    trackStatusClass() {
      const map = {'1':'track-green','2':'track-yellow','4':'track-sc','5':'track-red','6':'track-vsc'};
      return map[this.trackStatus] || '';
    },

    updateClock() {
      if (!this.clock || !this.clockExtrapolating || !this.clockRefTime) {
        this.clockDisplay = this.clock || '';
        return;
      }
      // Extrapolate: remaining = clock - elapsed since clockRefTime
      const [h, m, s] = this.clock.split(':').map(Number);
      const totalSecs = h * 3600 + m * 60 + s;
      const elapsed = (Date.now() - this.clockRefTime.getTime()) / 1000;
      const remaining = Math.max(0, totalSecs - elapsed);
      const rh = Math.floor(remaining / 3600);
      const rm = Math.floor((remaining % 3600) / 60);
      const rs = Math.floor(remaining % 60);
      this.clockDisplay = `${pad(rh)}:${pad(rm)}:${pad(rs)}`;
    },
  };
}

// ---- Standings page ----

function standingsPage() {
  return {
    year: currentSeason(),
    view: 'drivers',
    loading: false,
    driverStandings: [],
    teamStandings: [],

    async init() {
      await this.load();
    },

    async setYear(y) {
      this.year = y;
      await this.load();
    },

    async load() {
      this.loading = true;
      await Promise.all([this.loadDrivers(), this.loadTeams()]);
      this.loading = false;
    },

    async loadDrivers() {
      try {
        const r = await fetch(`/api/v1/championship/drivers?year=${this.year}`);
        const data = await r.json();
        this.driverStandings = Array.isArray(data)
          ? [...data].sort((a, b) => a.position_current - b.position_current)
          : [];
      } catch (_) { this.driverStandings = []; }
    },

    async loadTeams() {
      try {
        const r = await fetch(`/api/v1/championship/teams?year=${this.year}`);
        const data = await r.json();
        this.teamStandings = Array.isArray(data)
          ? [...data].sort((a, b) => a.position_current - b.position_current)
          : [];
      } catch (_) { this.teamStandings = []; }
    },
  };
}

function pad(n) { return String(n).padStart(2, '0'); }

function fmtSecs(s) {
  if (!s) return '-';
  const m = Math.floor(s / 60);
  const rem = (s - m * 60).toFixed(3);
  return `${m}:${rem.padStart(6, '0')}`;
}
