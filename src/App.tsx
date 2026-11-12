import { useEffect, useMemo, useState, type ReactNode } from "react";
import QRCode from "qrcode";

type IconName =
  | "air"
  | "grid"
  | "pulse"
  | "history"
  | "sliders"
  | "wifi"
  | "settings"
  | "info"
  | "sun"
  | "moon"
  | "bell"
  | "menu"
  | "x"
  | "chevron"
  | "thermo"
  | "drop"
  | "fan"
  | "volume"
  | "light"
  | "download"
  | "search"
  | "refresh"
  | "phone"
  | "monitor"
  | "cpu"
  | "check"
  | "alert"
  | "clock"
  | "shield"
  | "arrow"
  | "power"
  | "qr"
  | "signal";

function Icon({
  name,
  size = 20,
  strokeWidth = 1.8,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
}) {
  const paths: Record<IconName, ReactNode> = {
    air: (
      <>
        <path d="M4 8.5h9.5a2.5 2.5 0 1 0-2.2-3.7" />
        <path d="M3 12h15.5a2.5 2.5 0 1 1-2.2 3.7" />
        <path d="M4 15.5h7" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    pulse: (
      <>
        <path d="M3 12h4l2.3-6 4.2 12 2.2-6H21" />
      </>
    ),
    history: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    sliders: (
      <>
        <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
        <circle cx="16" cy="7" r="2" />
        <circle cx="8" cy="17" r="2" />
      </>
    ),
    wifi: (
      <>
        <path d="M4.5 9.5a11 11 0 0 1 15 0M7.5 13a6.7 6.7 0 0 1 9 0M10.5 16.5a2.3 2.3 0 0 1 3 0" />
        <circle cx="12" cy="19" r=".5" fill="currentColor" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7.5v.2" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>
    ),
    moon: <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z" />,
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
    menu: (
      <>
        <path d="M4 7h16M4 12h16M4 17h16" />
      </>
    ),
    x: (
      <>
        <path d="m6 6 12 12M18 6 6 18" />
      </>
    ),
    chevron: <path d="m9 18 6-6-6-6" />,
    thermo: (
      <>
        <path d="M10 5a2 2 0 1 1 4 0v8.2a4 4 0 1 1-4 0Z" />
        <path d="M12 7v8" />
      </>
    ),
    drop: <path d="M12 3s6 6.2 6 11a6 6 0 0 1-12 0c0-4.8 6-11 6-11Z" />,
    fan: (
      <>
        <circle cx="12" cy="12" r="1.5" />
        <path d="M12 10.5c-1-5 1-7.5 3.2-6.5 2.3 1 .8 4.7-3.2 6.5ZM10.7 12.8c-3.8 3.4-6.8 2.9-7-.3-.1-2.5 3.8-2.8 7-.8M13.2 12.8c4.9 1.5 5.9 4.3 3.4 5.8-2.2 1.3-4.6-1.9-4.5-5.8" />
      </>
    ),
    volume: (
      <>
        <path d="M5 10v4h3l4 3V7L8 10Z" />
        <path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a8 8 0 0 1 0 11" />
      </>
    ),
    light: (
      <>
        <path d="M9 18h6M10 22h4" />
        <path d="M8.5 15.5a6 6 0 1 1 7 0c-.7.5-.5 1.5-.5 2.5H9c0-1 .2-2-.5-2.5Z" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12M7 10l5 5 5-5" />
        <path d="M4 21h16" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 7v5h-5M4 17v-5h5" />
        <path d="M18 12a6 6 0 0 0-10.5-4M6 12a6 6 0 0 0 10.5 4" />
      </>
    ),
    phone: (
      <>
        <rect x="6.5" y="2" width="11" height="20" rx="3" />
        <path d="M10 5h4M11 19h2" />
      </>
    ),
    monitor: (
      <>
        <rect x="2.5" y="3.5" width="19" height="14" rx="2" />
        <path d="M8 21h8M12 17.5V21" />
      </>
    ),
    cpu: (
      <>
        <rect x="7" y="7" width="10" height="10" rx="2" />
        <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    alert: (
      <>
        <path d="M12 3 2.7 20h18.6Z" />
        <path d="M12 9v4M12 17h.01" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 4.5 6v5.5c0 4.7 3.2 8 7.5 9.5 4.3-1.5 7.5-4.8 7.5-9.5V6Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14M14 7l5 5-5 5" />
      </>
    ),
    power: (
      <>
        <path d="M12 2v10" />
        <path d="M6.3 5.7a8 8 0 1 0 11.4 0" />
      </>
    ),
    qr: (
      <>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <path d="M15 14h2v2h-2zM19 14h2v4h-2zM14 19h4v2h-4zM20 20h1v1" />
      </>
    ),
    signal: (
      <>
        <path d="M5 20v-3M10 20v-7M15 20V9M20 20V4" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

const navItems = [
  ["Overview", "grid"],
  ["Live Monitoring", "pulse"],
  ["Historical Data", "history"],
  ["Device Controls", "sliders"],
  ["Wi-Fi & Connectivity", "wifi"],
  ["Settings", "settings"],
  ["About AirWatch", "info"],
] as const;

const historyRows = [
  ["10:42:18 AM", 742, 27.4, 54, "Excellent"],
  ["10:41:48 AM", 756, 27.3, 54, "Excellent"],
  ["10:41:18 AM", 781, 27.3, 55, "Excellent"],
  ["10:40:48 AM", 826, 27.2, 55, "Good"],
  ["10:40:18 AM", 843, 27.1, 56, "Good"],
  ["10:39:48 AM", 811, 27.0, 55, "Good"],
  ["10:39:18 AM", 786, 26.9, 54, "Excellent"],
  ["10:38:48 AM", 768, 26.8, 54, "Excellent"],
];

const co2Points = [32, 37, 31, 42, 40, 52, 48, 61, 58, 67, 61, 55, 50, 45, 48, 41, 44, 37, 40, 34];
const tempPoints = [72, 70, 73, 68, 66, 64, 62, 59, 60, 57, 54, 52, 50, 51, 48, 46, 47, 44, 43, 42];
const humPoints = [52, 50, 53, 54, 52, 48, 46, 48, 44, 42, 43, 40, 42, 39, 38, 40, 37, 36, 38, 35];

function Sparkline({
  points,
  color = "#38bdf8",
  fill = false,
}: {
  points: number[];
  color?: string;
  fill?: boolean;
}) {
  const coords = points.map((v, i) => `${(i / (points.length - 1)) * 100},${v}`).join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="sparkline" aria-hidden="true">
      {fill && <polygon points={`0,100 ${coords} 100,100`} fill={color} opacity=".09" />}
      <polyline
        points={coords}
        fill="none"
        stroke={color}
        strokeWidth="2.2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="logo-wrap">
      <div className="logo-mark">
        <Icon name="air" size={24} strokeWidth={2.3} />
      </div>
      {!compact && (
        <div>
          <div className="logo-name">AirWatch</div>
          <div className="logo-sub">Wireless Air Tracking</div>
        </div>
      )}
    </div>
  );
}

function StatusDot({ online = true, label }: { online?: boolean; label?: string }) {
  return (
    <span className={`status-pill ${online ? "online" : "offline"}`}>
      <i />
      {label ?? (online ? "Connected" : "Disconnected")}
    </span>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      className={`toggle ${checked ? "on" : ""}`}
      onClick={onChange}
      aria-label={label}
      aria-pressed={checked}
    >
      <span />
    </button>
  );
}

function MetricCard({
  type,
  title,
  value,
  unit,
  note,
  color,
  icon,
}: {
  type: "co2" | "temp" | "humidity";
  title: string;
  value: string;
  unit: string;
  note: string;
  color: string;
  icon: IconName;
}) {
  return (
    <article className={`metric-card ${type}`}>
      <div className="metric-head">
        <span className="metric-label">
          <span className="metric-icon" style={{ color }}>
            <Icon name={icon} size={18} />
          </span>
          {title}
        </span>
        <button className="more-btn">•••</button>
      </div>
      {type === "co2" ? (
        <div className="co2-body">
          <div
            className="gauge"
            style={{ "--progress": "67%", "--gauge": color } as React.CSSProperties}
          >
            <div>
              <strong>{value}</strong>
              <span>{unit}</span>
            </div>
          </div>
          <div className="quality-copy">
            <span className="quality-tag">
              <i style={{ background: color }} />
              Excellent
            </span>
            <p>Fresh, well-ventilated air</p>
            <small>
              <Icon name="clock" size={13} /> Updated 8 sec ago
            </small>
          </div>
        </div>
      ) : (
        <div className="standard-metric">
          <div>
            <div className="metric-value">
              {value}
              <span>{unit}</span>
            </div>
            <span className="trend-up">↗ 0.3 {unit} today</span>
          </div>
          <div className="mini-chart">
            <Sparkline points={type === "temp" ? tempPoints : humPoints} color={color} fill />
          </div>
        </div>
      )}
      {type !== "co2" && (
        <div className="metric-foot">
          <span>{note}</span>
          <span>
            {type === "temp" ? (
              <>
                <Icon name="fan" size={14} /> Fan off
              </>
            ) : (
              "Ideal: 40–60%"
            )}
          </span>
        </div>
      )}
    </article>
  );
}

function MonitorChart({ compact = false }: { compact?: boolean }) {
  const [metrics, setMetrics] = useState({ co2: true, temp: true, hum: true });
  const [range, setRange] = useState("15 min");
  return (
    <section className={`panel chart-panel ${compact ? "compact-chart" : ""}`}>
      <div className="panel-title-row">
        <div>
          <h2>{compact ? "CO₂ trend" : "Real-time monitoring"}</h2>
          <p>{compact ? "Last 15 minutes" : "Live sensor readings · demonstration data"}</p>
        </div>
        {!compact && (
          <div className="range-select">
            {["5 min", "15 min", "30 min", "1 hr"].map((r) => (
              <button key={r} className={range === r ? "active" : ""} onClick={() => setRange(r)}>
                {r}
              </button>
            ))}
          </div>
        )}
      </div>
      {!compact && (
        <div className="chart-legend">
          <button
            onClick={() => setMetrics({ ...metrics, co2: !metrics.co2 })}
            className={!metrics.co2 ? "muted" : ""}
          >
            <i className="cyan" />
            CO₂ <b>742 ppm</b>
          </button>
          <button
            onClick={() => setMetrics({ ...metrics, temp: !metrics.temp })}
            className={!metrics.temp ? "muted" : ""}
          >
            <i className="amber" />
            Temperature <b>27.4°C</b>
          </button>
          <button
            onClick={() => setMetrics({ ...metrics, hum: !metrics.hum })}
            className={!metrics.hum ? "muted" : ""}
          >
            <i className="blue" />
            Humidity <b>54%</b>
          </button>
        </div>
      )}
      <div className="chart-area">
        <div className="y-labels">
          <span>1,200</span>
          <span>900</span>
          <span>600</span>
          <span>300</span>
          <span>0</span>
        </div>
        <div className="chart-grid">
          {metrics.co2 && <Sparkline points={co2Points} color="#06b6d4" fill />}
          {!compact && metrics.temp && <Sparkline points={tempPoints} color="#f59e0b" />}
          {!compact && metrics.hum && <Sparkline points={humPoints} color="#3b82f6" />}
          <div className="chart-hover">
            <span>10:39 AM</span>
            <b>781 ppm</b>
          </div>
        </div>
      </div>
      <div className="x-labels">
        <span>10:28</span>
        <span>10:31</span>
        <span>10:34</span>
        <span>10:37</span>
        <span>10:40</span>
        <span>Now</span>
      </div>
    </section>
  );
}

function Overview() {
  return (
    <>
      <div className="demo-banner">
        <Icon name="info" size={17} />
        <div>
          <b>Preview mode</b>
          <span>
            Showing realistic demonstration data. Connect an AirWatch device to display live
            readings.
          </span>
        </div>
        <button>Learn about connection</button>
      </div>
      <div className="section-intro">
        <div>
          <span className="eyebrow">Environment overview</span>
          <h1>
            Your indoor air is <em>excellent</em>
          </h1>
          <p>All monitored conditions are within comfortable ranges.</p>
        </div>
        <div className="air-score">
          <span>Air score</span>
          <strong>94</strong>
          <small>/ 100</small>
        </div>
      </div>
      <div className="metric-grid">
        <MetricCard
          type="co2"
          title="CO₂ concentration"
          value="742"
          unit="ppm"
          note=""
          color="#22c55e"
          icon="air"
        />
        <MetricCard
          type="temp"
          title="Temperature"
          value="27.4"
          unit="°C"
          note="Comfortable"
          color="#f59e0b"
          icon="thermo"
        />
        <MetricCard
          type="humidity"
          title="Relative humidity"
          value="54"
          unit="%"
          note="Optimal range"
          color="#3b82f6"
          icon="drop"
        />
      </div>
      <div className="overview-lower">
        <MonitorChart />
        <aside className="panel health-panel">
          <div className="panel-title-row">
            <div>
              <h2>System health</h2>
              <p>AirWatch-S3 · Online</p>
            </div>
            <span className="health-check">
              <Icon name="check" size={18} />
            </span>
          </div>
          <div className="health-list">
            <div>
              <span className="health-icon">
                <Icon name="cpu" />
              </span>
              <p>
                <b>SCD41 sensor</b>
                <small>Reading normally</small>
              </p>
              <StatusDot label="Active" />
            </div>
            <div>
              <span className="health-icon">
                <Icon name="fan" />
              </span>
              <p>
                <b>Cooling fan</b>
                <small>Automatic · 30°C</small>
              </p>
              <span className="neutral-tag">Standby</span>
            </div>
            <div>
              <span className="health-icon">
                <Icon name="volume" />
              </span>
              <p>
                <b>Alert buzzer</b>
                <small>Threshold · 2,000 ppm</small>
              </p>
              <span className="neutral-tag">Armed</span>
            </div>
            <div>
              <span className="health-icon">
                <Icon name="light" />
              </span>
              <p>
                <b>Status light</b>
                <small>Showing excellent</small>
              </p>
              <i className="led-dot" />
            </div>
          </div>
          <button className="full-link">
            Open device controls <Icon name="arrow" size={16} />
          </button>
        </aside>
      </div>
      <section className="classification">
        <div>
          <span className="eyebrow">Project thresholds</span>
          <h2>CO₂ air-quality guide</h2>
          <p>
            Ventilation indicators configured for this AirWatch project. These are not official
            medical exposure limits.
          </p>
        </div>
        <div className="scale">
          <div className="scale-bar">
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="scale-labels">
            <span>
              <b>Excellent</b>&lt; 800 ppm
            </span>
            <span>
              <b>Good</b>800–1,199
            </span>
            <span>
              <b>Poor</b>1,200–1,999
            </span>
            <span>
              <b>Unhealthy</b>2,000+
            </span>
          </div>
        </div>
      </section>
    </>
  );
}

function HistoryPage() {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"table" | "chart">("table");
  const filtered = historyRows.filter((r) =>
    r.join(" ").toLowerCase().includes(query.toLowerCase()),
  );
  const download = () => {
    const csv = [
      "Timestamp,CO2 ppm,Temperature C,Humidity %,Classification",
      ...historyRows.map((r) => r.join(",")),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "airwatch-session.csv";
    a.click();
  };
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="Session records"
        title="Historical measurements"
        description="Review and export readings captured during this device session."
      />
      <div className="session-note">
        <Icon name="clock" />
        <div>
          <b>Session storage only</b>
          <span>
            Measurements will be cleared if the device restarts or loses power. Persistent storage
            is not configured.
          </span>
        </div>
      </div>
      <section className="panel table-panel">
        <div className="toolbar">
          <label className="search-box">
            <Icon name="search" size={17} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search measurements"
            />
          </label>
          <div className="view-toggle">
            <button onClick={() => setView("table")} className={view === "table" ? "active" : ""}>
              Table
            </button>
            <button onClick={() => setView("chart")} className={view === "chart" ? "active" : ""}>
              Chart
            </button>
          </div>
          <button className="secondary-btn" onClick={download}>
            <Icon name="download" size={17} />
            Export CSV
          </button>
        </div>
        {view === "chart" ? (
          <div className="history-chart">
            <MonitorChart />
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>CO₂</th>
                  <th>Temperature</th>
                  <th>Humidity</th>
                  <th>Classification</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <b>Today</b>
                      <span>{r[0]}</span>
                    </td>
                    <td>
                      {r[1]} <small>ppm</small>
                    </td>
                    <td>
                      {r[2]} <small>°C</small>
                    </td>
                    <td>
                      {r[3]} <small>%RH</small>
                    </td>
                    <td>
                      <span className={`quality-cell ${r[4].toString().toLowerCase()}`}>
                        <i />
                        {r[4]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="table-footer">
          <span>
            Showing {filtered.length} of {historyRows.length} readings
          </span>
          <span>Session started today at 9:14 AM</span>
        </div>
      </section>
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

function SettingRow({
  icon,
  title,
  description,
  control,
}: {
  icon: IconName;
  title: string;
  description: string;
  control: ReactNode;
}) {
  return (
    <div className="setting-row">
      <span className="setting-icon">
        <Icon name={icon} />
      </span>
      <div>
        <b>{title}</b>
        <span>{description}</span>
      </div>
      <div className="setting-control">{control}</div>
    </div>
  );
}

function ControlsPage({ toast }: { toast: (text: string) => void }) {
  const [monitoring, setMonitoring] = useState(true);
  const [fanMode, setFanMode] = useState("Automatic");
  const [buzzer, setBuzzer] = useState(true);
  const [led, setLed] = useState(true);
  const command = (fn: () => void, message: string) => {
    toast("Sending command to AirWatch…");
    setTimeout(() => {
      fn();
      toast(message);
    }, 700);
  };
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="Remote management"
        title="Device controls"
        description="Commands change state only after confirmation from the connected ESP32."
        action={<StatusDot label="Device ready" />}
      />
      <div className="control-grid">
        <section className="panel control-card">
          <div className="control-card-head">
            <span className="control-main-icon">
              <Icon name="power" />
            </span>
            <div>
              <h2>Monitoring system</h2>
              <p>Sensor acquisition and web interface</p>
            </div>
            <Toggle
              checked={monitoring}
              onChange={() =>
                command(
                  () => setMonitoring(!monitoring),
                  `Monitoring ${!monitoring ? "enabled" : "disabled"}`,
                )
              }
              label="Toggle monitoring"
            />
          </div>
          <div className="control-status">
            <StatusDot
              online={monitoring}
              label={monitoring ? "System operational" : "System paused"}
            />
            <span>Uptime 01d 04h 28m</span>
          </div>
        </section>
        <section className="panel control-card">
          <div className="control-card-head">
            <span className="control-main-icon amber-bg">
              <Icon name="fan" />
            </span>
            <div>
              <h2>Cooling fan</h2>
              <p>
                Current status: <b>Standby</b>
              </p>
            </div>
            <span className="neutral-tag">27.4°C</span>
          </div>
          <div className="segmented">
            {["Automatic", "Manual on", "Manual off"].map((mode) => (
              <button
                key={mode}
                onClick={() => command(() => setFanMode(mode), `Fan mode confirmed: ${mode}`)}
                className={fanMode === mode ? "active" : ""}
              >
                {mode}
              </button>
            ))}
          </div>
          <div className="thresholds">
            <label>
              Turn on at{" "}
              <span>
                <input type="number" defaultValue="30" />
                °C
              </span>
            </label>
            <label>
              Turn off at{" "}
              <span>
                <input type="number" defaultValue="28" />
                °C
              </span>
            </label>
          </div>
        </section>
        <section className="panel control-card">
          <div className="control-card-head">
            <span className="control-main-icon red-bg">
              <Icon name="volume" />
            </span>
            <div>
              <h2>Audible warning</h2>
              <p>CO₂ threshold alarm</p>
            </div>
            <Toggle
              checked={buzzer}
              onChange={() =>
                command(
                  () => setBuzzer(!buzzer),
                  `Audible warnings ${!buzzer ? "enabled" : "muted"}`,
                )
              }
              label="Toggle buzzer"
            />
          </div>
          <div className="thresholds">
            <label>
              Activate at{" "}
              <span>
                <input type="number" defaultValue="2000" />
                ppm
              </span>
            </label>
            <label>
              Clear below{" "}
              <span>
                <input type="number" defaultValue="1800" />
                ppm
              </span>
            </label>
          </div>
          <button
            className="secondary-btn wide"
            onClick={() => toast("No active alarm to acknowledge")}
          >
            <Icon name="check" size={17} />
            Acknowledge active alarm
          </button>
        </section>
        <section className="panel control-card">
          <div className="control-card-head">
            <span className="control-main-icon green-bg">
              <Icon name="light" />
            </span>
            <div>
              <h2>NeoPixel indicator</h2>
              <p>Air-quality status light</p>
            </div>
            <Toggle
              checked={led}
              onChange={() =>
                command(() => setLed(!led), `Status light ${!led ? "enabled" : "disabled"}`)
              }
              label="Toggle LED"
            />
          </div>
          <div className="color-preview">
            <span className="big-led" />
            <div>
              <b>Excellent air quality</b>
              <span>Current output · Emerald green</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function WifiPage({ toast, qrUrl }: { toast: (text: string) => void; qrUrl: string }) {
  const address = window.location.origin;
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="Local network"
        title="Wi-Fi & connectivity"
        description="Manage local access to your AirWatch monitoring device."
        action={
          <button
            className="secondary-btn"
            onClick={() => {
              toast("Reconnecting to local network…");
              setTimeout(() => toast("Network connection confirmed"), 800);
            }}
          >
            <Icon name="refresh" size={17} />
            Reconnect
          </button>
        }
      />
      <div className="wifi-layout">
        <div className="wifi-main">
          <section className="panel network-hero">
            <div className="signal-orb">
              <Icon name="wifi" size={32} />
            </div>
            <div>
              <span className="eyebrow">Connection status</span>
              <h2>Connected to AirWatch Lab</h2>
              <p>Strong signal · Local network access</p>
            </div>
            <StatusDot label="Online" />
          </section>
          <section className="panel network-details">
            <h2>Network details</h2>
            <div className="detail-grid">
              <div>
                <span>Network name (SSID)</span>
                <b>AirWatch Lab</b>
              </div>
              <div>
                <span>Local IP address</span>
                <b>{window.location.hostname}</b>
              </div>
              <div>
                <span>Signal strength</span>
                <b className="signal-value">
                  <Icon name="signal" size={17} />
                  −42 dBm
                </b>
              </div>
              <div>
                <span>Device hostname</span>
                <b>airwatch.local</b>
              </div>
              <div>
                <span>Access Point mode</span>
                <b>Available on fallback</b>
              </div>
              <div>
                <span>Setup network</span>
                <b>AirWatch-Setup</b>
              </div>
            </div>
          </section>
          <section className="panel setup-steps">
            <h2>First-time setup</h2>
            <p>
              If AirWatch cannot join your network, it starts its own secure setup access point.
            </p>
            <ol>
              <li>
                <i>1</i>
                <span>
                  <b>Join the setup network</b>Open Wi-Fi settings and connect to{" "}
                  <code>AirWatch-Setup</code>.
                </span>
              </li>
              <li>
                <i>2</i>
                <span>
                  <b>Open the setup portal</b>Visit <code>http://192.168.4.1</code> in your browser.
                </span>
              </li>
              <li>
                <i>3</i>
                <span>
                  <b>Choose your Wi-Fi</b>Enter network credentials and wait for AirWatch to
                  reconnect.
                </span>
              </li>
            </ol>
          </section>
        </div>
        <aside className="panel qr-card">
          <span className="eyebrow">Quick access</span>
          <h2>Open this dashboard</h2>
          <p>
            Connect your smartphone to the same network as your AirWatch device, then scan the QR
            code to access your monitoring dashboard.
          </p>
          <div className="qr-frame">
            {qrUrl ? (
              <img src={qrUrl} alt={`QR code for ${address}`} />
            ) : (
              <div className="qr-loading">Generating…</div>
            )}
          </div>
          <div className="url-chip">
            <Icon name="shield" size={16} />
            <span>{address}</span>
          </div>
          <small>Generated from the device’s current reachable address.</small>
        </aside>
      </div>
    </div>
  );
}

function SettingsPage() {
  const [darkAuto, setDarkAuto] = useState(false),
    [sounds, setSounds] = useState(true),
    [alerts, setAlerts] = useState(true);
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="Preferences"
        title="Settings"
        description="Personalize monitoring behavior and display preferences."
      />
      <section className="panel settings-card">
        <h2>General preferences</h2>
        <SettingRow
          icon="monitor"
          title="Device name"
          description="Friendly name shown across AirWatch interfaces"
          control={<input className="small-input" defaultValue="AirWatch Lab" />}
        />
        <SettingRow
          icon="moon"
          title="Follow system appearance"
          description="Automatically match your device theme"
          control={
            <Toggle
              checked={darkAuto}
              onChange={() => setDarkAuto(!darkAuto)}
              label="System theme"
            />
          }
        />
        <SettingRow
          icon="volume"
          title="Interface sounds"
          description="Play subtle confirmation sounds for controls"
          control={<Toggle checked={sounds} onChange={() => setSounds(!sounds)} label="Sounds" />}
        />
      </section>
      <section className="panel settings-card">
        <h2>CO₂ warnings</h2>
        <SettingRow
          icon="bell"
          title="Environmental alerts"
          description="Show alerts when readings pass configured thresholds"
          control={<Toggle checked={alerts} onChange={() => setAlerts(!alerts)} label="Alerts" />}
        />
        <SettingRow
          icon="alert"
          title="Warning threshold"
          description="Project-defined ventilation warning level"
          control={
            <label className="number-input">
              <input type="number" defaultValue="2000" />
              <span>ppm</span>
            </label>
          }
        />
      </section>
    </div>
  );
}

function AboutPage() {
  return (
    <div className="about-page">
      <div className="about-mark">
        <Icon name="air" size={42} />
      </div>
      <span className="eyebrow">University capstone project</span>
      <h1>AirWatch</h1>
      <h2>Wireless Air Tracking & CO₂ Handling</h2>
      <p>
        An indoor environmental monitoring platform powered by ESP32-S3 and Sensirion SCD41.
        Designed to make air quality visible, understandable, and actionable without cloud
        connectivity.
      </p>
      <div className="architecture">
        <span>SCD41 sensor</span>
        <Icon name="arrow" />
        <span>ESP32-S3</span>
        <Icon name="arrow" />
        <span>Local Wi-Fi</span>
        <Icon name="arrow" />
        <span>Web & mobile</span>
      </div>
      <div className="tech-cards">
        <div>
          <Icon name="cpu" />
          <b>ESP32-S3-N16R8</b>
          <span>Local processing and web server</span>
        </div>
        <div>
          <Icon name="air" />
          <b>SCD41</b>
          <span>CO₂, temperature and humidity</span>
        </div>
        <div>
          <Icon name="shield" />
          <b>Local-first</b>
          <span>No cloud connection required</span>
        </div>
      </div>
    </div>
  );
}

function MobileApp({ onExit }: { onExit: () => void }) {
  const [tab, setTab] = useState("Home");
  const [fan, setFan] = useState("Auto");
  return (
    <div className="showcase-screen">
      <div className="showcase-top">
        <div>
          <span className="eyebrow">Companion experience</span>
          <h1>AirWatch Mobile</h1>
          <p>Native-feeling access to your local monitoring device.</p>
        </div>
        <button className="secondary-btn" onClick={onExit}>
          <Icon name="monitor" size={17} />
          Return to web console
        </button>
      </div>
      <div className="phone-wrap">
        <div className="phone-frame">
          <div className="phone-status">
            <span>9:41</span>
            <span>● ◒ ▰</span>
          </div>
          <div className="phone-content">
            <div className="mobile-head">
              <Logo compact />
              <div>
                <b>AirWatch Lab</b>
                <StatusDot label="Connected" />
              </div>
              <button>
                <Icon name="bell" size={20} />
              </button>
            </div>
            {tab === "Home" && (
              <div className="mobile-scroll">
                <div className="mobile-greeting">
                  <span>Good morning</span>
                  <h2>Your air looks excellent.</h2>
                </div>
                <div className="mobile-co2">
                  <div className="mobile-score-ring">
                    <span>
                      <b>742</b>ppm
                    </span>
                  </div>
                  <div>
                    <span className="quality-tag">
                      <i />
                      Excellent
                    </span>
                    <p>CO₂ concentration</p>
                    <small>Updated just now</small>
                  </div>
                </div>
                <div className="mobile-minis">
                  <div>
                    <span>
                      <Icon name="thermo" />
                      Temperature
                    </span>
                    <b>
                      27.4<small>°C</small>
                    </b>
                    <em>Comfortable</em>
                  </div>
                  <div>
                    <span>
                      <Icon name="drop" />
                      Humidity
                    </span>
                    <b>
                      54<small>%</small>
                    </b>
                    <em>Optimal range</em>
                  </div>
                </div>
                <MonitorChart compact />
                <div className="mobile-device-status">
                  <h3>Device status</h3>
                  <div>
                    <span>
                      <Icon name="fan" />
                      Cooling fan
                    </span>
                    <b>Automatic</b>
                  </div>
                  <div>
                    <span>
                      <Icon name="volume" />
                      Air alarm
                    </span>
                    <b>Armed</b>
                  </div>
                </div>
              </div>
            )}
            {tab === "Analytics" && (
              <div className="mobile-scroll mobile-subpage">
                <span className="eyebrow">Live sensor data</span>
                <h2>Analytics</h2>
                <p>Measurement trends from this session.</p>
                <MonitorChart />
                <div className="period-cards">
                  <button className="active">15m</button>
                  <button>30m</button>
                  <button>1h</button>
                  <button>Session</button>
                </div>
              </div>
            )}
            {tab === "Controls" && (
              <div className="mobile-scroll mobile-subpage">
                <span className="eyebrow">Remote management</span>
                <h2>Device controls</h2>
                <p>Changes require ESP32 confirmation.</p>
                <div className="mobile-control-card">
                  <span>
                    <Icon name="fan" />
                  </span>
                  <div>
                    <b>Cooling fan</b>
                    <small>Currently on standby</small>
                  </div>
                </div>
                <div className="segmented">
                  {["Auto", "On", "Off"].map((x) => (
                    <button onClick={() => setFan(x)} className={fan === x ? "active" : ""}>
                      {x}
                    </button>
                  ))}
                </div>
                <div className="mobile-control-card">
                  <span>
                    <Icon name="volume" />
                  </span>
                  <div>
                    <b>Audible alerts</b>
                    <small>Alarm threshold: 2,000 ppm</small>
                  </div>
                  <Toggle checked={true} onChange={() => {}} label="Alerts" />
                </div>
                <div className="mobile-control-card">
                  <span>
                    <Icon name="light" />
                  </span>
                  <div>
                    <b>Status indicator</b>
                    <small>Showing excellent</small>
                  </div>
                  <Toggle checked={true} onChange={() => {}} label="LED" />
                </div>
              </div>
            )}
            {tab === "Alerts" && (
              <div className="mobile-scroll mobile-subpage">
                <span className="eyebrow">Activity</span>
                <h2>Alerts</h2>
                <p>Recent environmental and system events.</p>
                <div className="alert-empty">
                  <span>
                    <Icon name="shield" size={28} />
                  </span>
                  <b>All clear</b>
                  <p>No active warnings on AirWatch Lab.</p>
                </div>
                <div className="event-list">
                  <div>
                    <i className="blue-event" />
                    <span>
                      <b>Device reconnected</b>
                      <small>Today, 9:14 AM</small>
                    </span>
                  </div>
                  <div>
                    <i className="amber-event" />
                    <span>
                      <b>CO₂ returned to normal</b>
                      <small>Yesterday, 4:42 PM</small>
                    </span>
                  </div>
                </div>
                <small className="push-note">
                  Background push notifications are not enabled in this prototype.
                </small>
              </div>
            )}
          </div>
          <nav className="mobile-nav">
            {[
              ["Home", "grid"],
              ["Analytics", "pulse"],
              ["Controls", "sliders"],
              ["Alerts", "bell"],
            ].map(([t, i]) => (
              <button key={t} onClick={() => setTab(t)} className={tab === t ? "active" : ""}>
                <Icon name={i as IconName} />
                <span>{t}</span>
              </button>
            ))}
          </nav>
          <div className="home-indicator" />
        </div>
        <div className="mobile-notes">
          <span className="eyebrow">Included flows</span>
          <h2>Everything important, close at hand.</h2>
          <p>
            The mobile companion shares AirWatch’s core visual language while prioritizing
            glanceable readings and one-handed controls.
          </p>
          <ul>
            <li>
              <Icon name="check" />
              Primary CO₂ monitoring
            </li>
            <li>
              <Icon name="check" />
              Live session analytics
            </li>
            <li>
              <Icon name="check" />
              Confirmed remote commands
            </li>
            <li>
              <Icon name="check" />
              Environmental event history
            </li>
          </ul>
          <div className="prototype-note">
            <Icon name="info" />
            <span>
              <b>Prototype behavior</b>Data and device responses are simulated and clearly
              identified until a live ESP32 API is configured.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeviceUI({ onExit, qrUrl }: { onExit: () => void; qrUrl: string }) {
  const [page, setPage] = useState(2);
  return (
    <div className="showcase-screen device-showcase">
      <div className="showcase-top">
        <div>
          <span className="eyebrow">Physical interface</span>
          <h1>ILI9341 Touchscreen</h1>
          <p>320 × 240 landscape layout with swipe navigation.</p>
        </div>
        <button className="secondary-btn" onClick={onExit}>
          <Icon name="monitor" size={17} />
          Return to web console
        </button>
      </div>
      <div className="device-stage">
        <div className="device-shell">
          <div className="device-screen">
            {page === 0 && (
              <div className="device-page device-live">
                <header>
                  <Logo compact />
                  <b>AIRWATCH</b>
                  <StatusDot label="LIVE" />
                </header>
                <div className="device-main-reading">
                  <span>CO₂</span>
                  <b>742</b>
                  <small>PPM</small>
                  <em>EXCELLENT</em>
                </div>
                <footer>
                  <div>
                    <Icon name="thermo" />
                    <span>
                      <b>27.4°</b>TEMP
                    </span>
                  </div>
                  <div>
                    <Icon name="drop" />
                    <span>
                      <b>54%</b>HUMIDITY
                    </span>
                  </div>
                </footer>
              </div>
            )}
            {page === 1 && (
              <div className="device-page device-uptime">
                <header>
                  <Logo compact />
                  <b>SYSTEM UPTIME</b>
                </header>
                <div className="uptime-clock">
                  <span>01</span>
                  <i>:</i>
                  <span>04</span>
                  <i>:</i>
                  <span>28</span>
                </div>
                <div className="uptime-labels">
                  <span>DAYS</span>
                  <span>HOURS</span>
                  <span>MINUTES</span>
                </div>
                <p>System operating normally</p>
                <StatusDot label="ALL SYSTEMS ACTIVE" />
              </div>
            )}
            {page === 2 && (
              <div className="device-page device-qr">
                <header>
                  <span>
                    <Icon name="wifi" size={16} /> CONNECTED
                  </span>
                  <b>AIRWATCH LAB</b>
                </header>
                <div className="device-qr-body">
                  <div className="device-qr-box">
                    {qrUrl && <img src={qrUrl} alt="Dashboard QR" />}
                  </div>
                  <div>
                    <span>SCAN TO OPEN</span>
                    <b>DASHBOARD</b>
                    <p>{window.location.hostname}</p>
                    <small>Same Wi-Fi required</small>
                  </div>
                </div>
              </div>
            )}
            <button className="screen-arrow left" onClick={() => setPage((page + 2) % 3)}>
              ‹
            </button>
            <button className="screen-arrow right" onClick={() => setPage((page + 1) % 3)}>
              ›
            </button>
            <div className="screen-dots">
              {[0, 1, 2].map((x) => (
                <i key={x} className={page === x ? "active" : ""} />
              ))}
            </div>
          </div>
        </div>
        <div className="device-copy">
          <span className="eyebrow">Page {page + 1} of 3</span>
          <h2>{["Live air quality", "Device uptime", "Wi-Fi & QR access"][page]}</h2>
          <p>Use the on-screen arrows to preview the swipe-left and swipe-right interaction.</p>
          <div className="dimension-chip">320 px × 240 px · landscape</div>
        </div>
      </div>
    </div>
  );
}

function ApiPage() {
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="Live data"
        title="Monitoring & API readiness"
        description="Interactive live charts now; ESP32 REST integration when firmware is connected."
      />
      <MonitorChart />
      <section className="panel api-panel">
        <div>
          <span className="eyebrow">Firmware contract</span>
          <h2>Local REST API</h2>
          <p>Recommended endpoints and response fields for production integration.</p>
        </div>
        <div className="endpoint-list">
          <code>
            <b>GET</b> /api/status{" "}
            <span>co2, temperature, humidity, classification, fan, buzzer, updatedAt</span>
          </code>
          <code>
            <b>GET</b> /api/history <span>measurements[], sessionStartedAt, storageMode</span>
          </code>
          <code>
            <b>GET</b> /api/network <span>connected, ssid, ip, rssi, hostname, apMode</span>
          </code>
          <code>
            <b>POST</b> /api/control <span>commandId, target, action, value</span>
          </code>
        </div>
        <div className="api-note">
          <Icon name="shield" />
          <p>
            <b>Confirmation-first controls</b>
            <span>
              POST commands remain pending until the ESP32 responds with <code>applied: true</code>{" "}
              and the confirmed device state.
            </span>
          </p>
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const [active, setActive] = useState("Overview");
  const [dark, setDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showcase, setShowcase] = useState<"web" | "mobile" | "device">("web");
  const [toast, setToast] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const now = useMemo(
    () =>
      new Intl.DateTimeFormat("en", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date()),
    [],
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  useEffect(() => {
    QRCode.toDataURL(window.location.origin, {
      width: 360,
      margin: 1,
      color: { dark: "#102A43", light: "#FFFFFF" },
    }).then(setQrUrl);
  }, []);
  const notify = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(""), 2400);
  };
  if (showcase === "mobile") return <MobileApp onExit={() => setShowcase("web")} />;
  if (showcase === "device") return <DeviceUI onExit={() => setShowcase("web")} qrUrl={qrUrl} />;
  const go = (name: string) => {
    setActive(name);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="sidebar-top">
          <Logo />
          <button className="mobile-close" onClick={() => setMenuOpen(false)}>
            <Icon name="x" />
          </button>
        </div>
        <nav className="main-nav">
          <span className="nav-label">Monitoring</span>
          {navItems.slice(0, 3).map(([name, icon]) => (
            <button key={name} onClick={() => go(name)} className={active === name ? "active" : ""}>
              <Icon name={icon} />
              <span>{name}</span>
              {name === "Overview" && <i className="nav-live" />}
            </button>
          ))}
          <span className="nav-label">Management</span>
          {navItems.slice(3).map(([name, icon]) => (
            <button key={name} onClick={() => go(name)} className={active === name ? "active" : ""}>
              <Icon name={icon} />
              <span>{name}</span>
            </button>
          ))}
        </nav>
        <div className="experience-switch">
          <span className="nav-label">Interface previews</span>
          <button onClick={() => setShowcase("mobile")}>
            <Icon name="phone" />
            <span>Mobile app</span>
            <Icon name="chevron" size={15} />
          </button>
          <button onClick={() => setShowcase("device")}>
            <Icon name="cpu" />
            <span>Device screen</span>
            <Icon name="chevron" size={15} />
          </button>
        </div>
        <div className="sidebar-device">
          <div>
            <span className="device-avatar">
              <Icon name="cpu" />
            </span>
            <p>
              <b>AirWatch Lab</b>
              <small>
                <i /> Demo connected
              </small>
            </p>
            <button>•••</button>
          </div>
          <span>ESP32-S3 · 192.168.1.86</span>
        </div>
      </aside>
      {menuOpen && (
        <button
          className="sidebar-backdrop"
          onClick={() => setMenuOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <div className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="menu-button" onClick={() => setMenuOpen(true)}>
              <Icon name="menu" />
            </button>
            <div>
              <span className="breadcrumb">AirWatch /</span>
              <b>{active}</b>
            </div>
          </div>
          <div className="topbar-right">
            <div className="top-time">
              <Icon name="clock" size={17} />
              <span>{now}</span>
            </div>
            <div className="last-sync">
              <i />
              Last update <b>8s ago</b>
            </div>
            <button className="icon-button" onClick={() => notify("No new alerts")}>
              <Icon name="bell" />
              <i />
            </button>
            <button className="theme-button" onClick={() => setDark(!dark)}>
              <Icon name={dark ? "sun" : "moon"} />
              <span>{dark ? "Light" : "Dark"} mode</span>
            </button>
          </div>
        </header>
        <main className="content">
          {active === "Overview" && <Overview />}
          {active === "Live Monitoring" && <ApiPage />}
          {active === "Historical Data" && <HistoryPage />}
          {active === "Device Controls" && <ControlsPage toast={notify} />}
          {active === "Wi-Fi & Connectivity" && <WifiPage toast={notify} qrUrl={qrUrl} />}
          {active === "Settings" && <SettingsPage />}
          {active === "About AirWatch" && <AboutPage />}
        </main>
        <footer className="site-footer">
          <span>AirWatch · Wireless Air Tracking & CO₂ Handling</span>
          <span>Local-only monitoring · Preview data</span>
        </footer>
      </div>
      {toast && (
        <div className="toast">
          <span>
            <Icon
              name={
                toast.includes("Sending") || toast.includes("Reconnecting") ? "refresh" : "check"
              }
              size={17}
            />
          </span>
          {toast}
        </div>
      )}
    </div>
  );
}
