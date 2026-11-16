import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import QRCode from "qrcode";
import { useAirWatch } from "./hooks/useAirWatch";
import { saveWiFiCredentials, setBuzzerMuted, setDisplayTheme, setFanMode } from "./services/airwatchApi";

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

function Sparkline({
  points,
  color = "#38bdf8",
  fill = false,
}: {
  points: number[];
  color?: string;
  fill?: boolean;
}) {
  const min = Math.min(...points);
  const span = Math.max(1, Math.max(...points) - min);
  const plotted = points.map((value, i) => ({ value, x: (i / Math.max(1, points.length - 1)) * 100, y: 95 - ((value - min) / span) * 85 }));
  const coords = plotted.map(({ x, y }) => `${x},${y}`).join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="sparkline" role="img" aria-label="Sensor measurement history">
      {fill && <polygon points={`0,100 ${coords} 100,100`} fill={color} opacity=".09" />}
      <polyline
        points={coords}
        fill="none"
        stroke={color}
        strokeWidth="2.2"
        vectorEffect="non-scaling-stroke"
      />
      {plotted.map(({ value, x, y }, i) => <circle key={i} cx={x} cy={y} r="1.7" fill={color}><title>{value}</title></circle>)}
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
  points,
  quality,
  updated,
}: {
  type: "co2" | "temp" | "humidity";
  title: string;
  value: string;
  unit: string;
  note: string;
  color: string;
  icon: IconName;
  points: number[];
  quality: string;
  updated: string;
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
              {quality}
            </span>
            <p>ESP32 sensor classification</p>
            <small>
              <Icon name="clock" size={13} /> {updated}
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
            <span className="trend-up">Live device samples</span>
          </div>
          <div className="mini-chart">
            {points.length > 1 && <Sparkline points={points} color={color} fill />}
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
  const { samples, status } = useAirWatch();
  const [metric, setMetric] = useState<"co2" | "temp" | "hum">("co2");
  const [range, setRange] = useState("15 min");
  const rangeSeconds: Record<string, number> = { "5 min": 300, "15 min": 900, "30 min": 1800, "1 hr": 3600 };
  const recent = samples.slice(-20);
  const newest = recent[recent.length - 1];
  const chartSamples = newest ? recent.filter((sample) => newest.epoch && sample.epoch ? newest.epoch - sample.epoch <= rangeSeconds[range] : newest.uptime - sample.uptime <= rangeSeconds[range]) : [];
  const co2Values = chartSamples.map((s) => s.co2);
  const tempValues = chartSamples.map((s) => s.temp);
  const humidityValues = chartSamples.map((s) => s.hum);
  const selectedValues = metric === "co2" ? co2Values : metric === "temp" ? tempValues : humidityValues;
  const selectedColor = metric === "co2" ? "#06b6d4" : metric === "temp" ? "#f59e0b" : "#3b82f6";
  const selectedMin = selectedValues.length ? Math.min(...selectedValues) : 0;
  const selectedMax = selectedValues.length ? Math.max(...selectedValues) : 0;
  const unit = metric === "co2" ? "ppm" : metric === "temp" ? "°C" : "%";
  return (
    <section className={`panel chart-panel ${compact ? "compact-chart" : ""}`}>
      <div className="panel-title-row">
        <div>
          <h2>{compact ? "CO₂ trend" : "Real-time monitoring"}</h2>
          <p>{compact ? "Device sample history" : status?.valid ? "Live sensor readings from the ESP32" : "Waiting for live ESP32 readings"}</p>
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
            onClick={() => setMetric("co2")}
            className={metric !== "co2" ? "muted" : ""}
          >
            <i className="cyan" />
            CO₂ <b>{status?.valid ? `${status.co2} ppm` : "-- ppm"}</b>
          </button>
          <button
            onClick={() => setMetric("temp")}
            className={metric !== "temp" ? "muted" : ""}
          >
            <i className="amber" />
            Temperature <b>{status?.valid ? `${status.temperature.toFixed(1)}°C` : "-- °C"}</b>
          </button>
          <button
            onClick={() => setMetric("hum")}
            className={metric !== "hum" ? "muted" : ""}
          >
            <i className="blue" />
            Humidity <b>{status?.valid ? `${status.humidity.toFixed(1)}%` : "-- %"}</b>
          </button>
        </div>
      )}
      <div className="chart-area">
        <div className="y-labels">
          {[1, 0.75, 0.5, 0.25, 0].map((fraction) => <span key={fraction}>{(selectedMin + (selectedMax - selectedMin) * fraction).toFixed(metric === "co2" ? 0 : 1)} {unit}</span>)}
        </div>
        <div className="chart-grid">
          {selectedValues.length > 1 && <Sparkline points={selectedValues} color={selectedColor} fill />}
          <div className="chart-hover">
            <span>{chartSamples.length ? chartSamples[chartSamples.length - 1].epoch ? new Date(chartSamples[chartSamples.length - 1].epoch * 1000).toLocaleTimeString() : `Uptime ${chartSamples[chartSamples.length - 1].uptime}s` : "No samples"}</span>
            <b>{status?.valid ? `${metric === "co2" ? status.co2 : metric === "temp" ? status.temperature.toFixed(1) : status.humidity.toFixed(1)} ${unit}` : "Sensor unavailable"}</b>
          </div>
        </div>
      </div>
      <div className="x-labels">
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const sample = chartSamples[Math.min(chartSamples.length - 1, Math.floor((chartSamples.length - 1) * fraction))];
          return <span key={fraction}>{sample ? sample.epoch ? new Date(sample.epoch * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : `${Math.floor(sample.uptime / 60)}m` : "--"}</span>;
        })}
        <span>Now</span>
      </div>
    </section>
  );
}

function Overview({ onConnectionClick }: { onConnectionClick: () => void }) {
  const { status, error, samples } = useAirWatch();
  const updated = status?.valid ? `${Math.max(0, status.uptimeSeconds - Math.floor(status.lastReadingUptime / 1000))} sec ago` : "No sensor reading";
  return (
    <>
      <div className="demo-banner">
        <Icon name="info" size={17} />
        <div>
            <b>{status ? "Live device" : "Device offline"}</b>
          <span>
            {error || (status?.valid ? "Showing sensor readings received from the ESP32." : "Waiting for a valid SCD41 reading.")}
          </span>
        </div>
        <button onClick={onConnectionClick}>Open connection settings</button>
      </div>
      <div className="section-intro">
        <div>
          <span className="eyebrow">Environment overview</span>
          <h1>
            Your indoor air is <em>{status?.valid ? status.quality.toLowerCase() : "waiting"}</em>
          </h1>
          <p>{status?.valid ? `Current classification: ${status.quality}.` : "No valid sensor readings are available."}</p>
        </div>
        <div className="air-score">
          <span>Air score</span>
          <strong>{status?.valid ? status.quality : "--"}</strong>
          <small>sensor quality</small>
        </div>
      </div>
      <div className="metric-grid">
        <MetricCard
          type="co2"
          title="CO₂ concentration"
          value={status?.valid ? String(status.co2) : "--"}
          unit="ppm"
          note=""
          color="#22c55e"
          icon="air"
          points={samples.slice(-20).map((sample) => sample.co2)}
          quality={status?.valid ? status.quality : "Waiting"}
          updated={updated}
        />
        <MetricCard
          type="temp"
          title="Temperature"
          value={status?.valid ? status.temperature.toFixed(1) : "--"}
          unit="°C"
          note="Comfortable"
          color="#f59e0b"
          icon="thermo"
          points={samples.slice(-20).map((sample) => sample.temp)}
          quality={status?.valid ? status.quality : "Waiting"}
          updated={updated}
        />
        <MetricCard
          type="humidity"
          title="Relative humidity"
          value={status?.valid ? status.humidity.toFixed(1) : "--"}
          unit="%"
          note="Optimal range"
          color="#3b82f6"
          icon="drop"
          points={samples.slice(-20).map((sample) => sample.hum)}
          quality={status?.valid ? status.quality : "Waiting"}
          updated={updated}
        />
      </div>
      <div className="overview-lower">
        <MonitorChart />
        <aside className="panel health-panel">
          <div className="panel-title-row">
            <div>
              <h2>System health</h2>
              <p>ESP32-S3 · {status ? "Online" : "Offline"}</p>
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
                <small>{status?.valid ? "Reading normally" : "No sensor reading"}</small>
              </p>
              <StatusDot online={!!status?.valid} label={status?.valid ? "Active" : "Unavailable"} />
            </div>
            <div>
              <span className="health-icon">
                <Icon name="fan" />
              </span>
              <p>
                <b>Cooling fan</b>
                <small>{status ? `Mode · ${status.fanMode}` : "State unavailable"}</small>
              </p>
              <span className="neutral-tag">{status ? status.fanOn ? "On" : "Off" : "Unknown"}</span>
            </div>
            <div>
              <span className="health-icon">
                <Icon name="volume" />
              </span>
              <p>
                <b>Alert buzzer</b>
                <small>{status?.alarmActive ? "Alarm active" : "No active alarm"}</small>
              </p>
              <span className="neutral-tag">{status ? status.muted ? "Muted" : "Enabled" : "Unknown"}</span>
            </div>
            <div>
              <span className="health-icon">
                <Icon name="light" />
              </span>
              <p>
                <b>Status light</b>
                <small>{status?.valid ? `Showing ${status.quality.toLowerCase()}` : "Waiting for sensor"}</small>
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
  const { samples } = useAirWatch();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"table" | "chart">("table");
  const rows = samples.slice().reverse().map((s) => [s.epoch ? new Date(s.epoch * 1000).toLocaleString() : `Uptime ${Math.floor(s.uptime / 60)}m ${s.uptime % 60}s`, s.co2, s.temp, s.hum, s.co2 < 800 ? "Excellent" : s.co2 < 1200 ? "Good" : s.co2 < 2000 ? "Poor" : "Unhealthy"] as (string | number)[]);
  const filtered = rows.filter((r) =>
    r.join(" ").toLowerCase().includes(query.toLowerCase()),
  );
  const download = () => {
    const csv = [
      "Timestamp,CO2 ppm,Temperature C,Humidity %,Classification",
      ...rows.map((r) => r.join(",")),
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
            Showing {filtered.length} of {rows.length} readings
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
  const { status, refresh, error, accessKey: deviceKey, setAccessKey: setDeviceKey } = useAirWatch();
  const [controlError, setControlError] = useState("");
  const [pending, setPending] = useState(false);
  const command = async (action: "auto" | "on" | "off" | "mute" | "unmute") => {
    if (!deviceKey.trim()) { setControlError("Enter the device access key shown on TFT Page 3."); return; }
    setPending(true); setControlError("");
    try {
      if (action === "mute" || action === "unmute") await setBuzzerMuted(action === "mute", deviceKey.trim());
      else await setFanMode(action, deviceKey.trim());
      await refresh(); toast("AirWatch confirmed the command");
    } catch (e) { setControlError(e instanceof Error ? e.message : "Command failed"); if (e instanceof Error && (e.message.includes("403") || e.message.includes("Incorrect device access key"))) setDeviceKey(""); }
    finally { setPending(false); }
  };
  return <div className="page-stack">
    <PageHeading eyebrow="Remote management" title="Device controls" description="Fan and buzzer commands require confirmation from the connected ESP32." action={<StatusDot online={!!status} label={status ? "Device online" : "Device offline"} />} />
    <section className="panel settings-card">
      <label>Device access key (shown on TFT Page 3)<input type="password" autoComplete="off" value={deviceKey} onChange={(e) => setDeviceKey(e.target.value)} /></label>
      {(error || controlError) && <p role="alert">{controlError || error}</p>}
    </section>
    <div className="control-grid">
      <section className="panel control-card"><div className="control-card-head"><span className="control-main-icon"><Icon name="power" /></span><div><h2>Monitoring system</h2><p>System power state reported by device</p></div></div><div className="control-status"><StatusDot online={!!status?.systemOn} label={status?.systemOn ? "System operational" : "Unavailable or off"} /><span>{status ? `Uptime ${Math.floor(status.uptimeSeconds / 3600)}h ${Math.floor(status.uptimeSeconds % 3600 / 60)}m` : "Uptime unavailable"}</span></div></section>
      <section className="panel control-card"><div className="control-card-head"><span className="control-main-icon amber-bg"><Icon name="fan" /></span><div><h2>Cooling fan</h2><p>Current status: <b>{status ? status.fanOn ? "On" : "Off" : "Unavailable"}</b></p></div><span className="neutral-tag">{status?.valid ? `${status.temperature.toFixed(1)} C` : "--"}</span></div><div className="segmented">{([["Automatic", "auto"], ["Manual on", "on"], ["Manual off", "off"]] as const).map(([label, mode]) => <button key={mode} disabled={pending || !status} onClick={() => void command(mode)} className={status?.fanMode === mode ? "active" : ""}>{label}</button>)}</div><p>Fan mode: {status?.fanMode ?? "unknown"}</p></section>
      <section className="panel control-card"><div className="control-card-head"><span className="control-main-icon red-bg"><Icon name="volume" /></span><div><h2>Audible warning</h2><p>{status?.alarmActive ? "Alarm active" : "CO2 threshold alarm"}</p></div><Toggle checked={!!status && !status.muted} onChange={() => void command(status?.muted ? "unmute" : "mute")} label="Toggle buzzer" /></div><p>{status ? status.muted ? "Buzzer muted" : "Buzzer enabled" : "Buzzer state unavailable"}</p></section>
      <section className="panel control-card"><div className="control-card-head"><span className="control-main-icon green-bg"><Icon name="light" /></span><div><h2>NeoPixel indicator</h2><p>Air-quality status light</p></div></div><div className="color-preview"><span className="big-led" /><div><b>{status?.valid ? status.quality : "Waiting for sensor"}</b><span>Indicator behavior is automatic</span></div></div></section>
    </div>
  </div>;
}
function WifiPage({ toast, qrUrl }: { toast: (text: string) => void; qrUrl: string }) {
  const { status, error, refresh, accessKey: key, setAccessKey: setKey } = useAirWatch();
  const [ssid, setSSID] = useState(""); const [password, setPassword] = useState(""); const [message, setMessage] = useState(""); const [saving, setSaving] = useState(false);
  const address = window.location.origin;
  const saveNetwork = async (event: FormEvent) => {
    event.preventDefault(); setMessage("");
    if (!key.trim()) { setMessage("Enter the access key shown on TFT Page 3."); return; }
    setSaving(true);
    try { await saveWiFiCredentials(ssid.trim(), password, key.trim()); setPassword(""); setMessage("Credentials accepted. The device is attempting to join this 2.4 GHz network."); toast("Wi-Fi credentials sent to AirWatch"); window.setTimeout(() => void refresh(), 3000); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Could not configure Wi-Fi"); if (e instanceof Error && e.message.includes("Incorrect device access key")) setKey(""); }
    finally { setSaving(false); }
  };
  return <div className="page-stack">
    <PageHeading eyebrow="Local network" title="Wi-Fi & connectivity" description="Device network status and 2.4 GHz network setup." action={<button className="secondary-btn" onClick={() => void refresh()}><Icon name="refresh" size={17} />Reconnect</button>} />
    <div className="wifi-layout"><div className="wifi-main">
      <section className="panel network-hero"><div className="signal-orb"><Icon name="wifi" size={32} /></div><div><span className="eyebrow">Connection status</span><h2>{status?.wifi.connected ? `Connected to ${status.wifi.ssid}` : "Router disconnected"}</h2><p>{status?.wifi.connected ? `Device IP ${status.wifi.ip}` : error || "Check device or connect to its setup access point"}</p></div><StatusDot online={!!status} label={status ? status.wifi.connected ? "Online" : "Setup mode" : "Offline"} /></section>
      <section className="panel network-details"><h2>Network details</h2><div className="detail-grid"><div><span>Router SSID</span><b>{status?.wifi.ssid || "Not connected"}</b></div><div><span>Device IP address</span><b>{status?.wifi.ip || "—"}</b></div><div><span>Setup access point</span><b>{status?.wifi.apSSID || "Unavailable"}</b></div><div><span>Setup AP address</span><b>{status?.wifi.apIP || "192.168.4.1"}</b></div><div><span>Dashboard address</span><b>{address}</b></div><div><span>Sensor</span><b>{status?.valid ? "SCD41 available" : "Waiting for SCD41"}</b></div></div></section>
      <section className="panel setup-steps"><h2>Configure Wi-Fi</h2><p>The device supports 2.4 GHz Wi-Fi. If it is offline, connect your browser to its setup access point first.</p><form onSubmit={saveNetwork} className="wifi-form"><label>AirWatch access key<input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} required /></label><label>Network name (SSID)<input value={ssid} onChange={(e) => setSSID(e.target.value)} maxLength={32} required /></label><label>Network password<input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={63} /></label><button className="secondary-btn" type="submit" disabled={saving}>{saving ? "Sending…" : "Save Wi-Fi credentials"}</button>{message && <p role="status">{message}</p>}</form></section>
    </div><aside className="panel qr-card"><span className="eyebrow">Quick access</span><h2>Open this dashboard</h2><p>Scan while connected to the same network as the device.</p><div className="qr-frame">{qrUrl ? <img src={qrUrl} alt={`QR code for ${address}`} /> : <div className="qr-loading">Generating…</div>}</div><div className="url-chip"><Icon name="shield" size={16} /><span>{address}</span></div><small>For device-served offline use, this URL is the ESP32 address.</small></aside></div>
  </div>;
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
  const { status, accessKey, setAccessKey, refresh } = useAirWatch();
  const [tab, setTab] = useState("Home");
  const [controlError, setControlError] = useState("");
  const setFan = async (mode: "auto" | "on" | "off") => {
    let key = accessKey;
    if (!key) { key = window.prompt("Enter the AirWatch access key shown on TFT Page 3") || ""; if (!key) return; setAccessKey(key); }
    try { await setFanMode(mode, key); await refresh(); setControlError(""); }
    catch (e) { setControlError(e instanceof Error ? e.message : "Fan command failed"); }
  };
  const setMute = async (muted: boolean) => {
    let key = accessKey;
    if (!key) { key = window.prompt("Enter the AirWatch access key shown on TFT Page 3") || ""; if (!key) return; setAccessKey(key); }
    try { await setBuzzerMuted(muted, key); await refresh(); setControlError(""); }
    catch (e) { setControlError(e instanceof Error ? e.message : "Buzzer command failed"); }
  };
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
                <b>AirWatch Device</b>
                <StatusDot online={!!status} label={status ? "Connected" : "Offline"} />
              </div>
              <button>
                <Icon name="bell" size={20} />
              </button>
            </div>
            {tab === "Home" && (
              <div className="mobile-scroll">
                <div className="mobile-greeting">
                  <span>Good morning</span>
                  <h2>{status?.valid ? `Your air looks ${status.quality.toLowerCase()}.` : "Waiting for sensor readings."}</h2>
                </div>
                <div className="mobile-co2">
                  <div className="mobile-score-ring">
                    <span>
                      <b>{status?.valid ? status.co2 : "--"}</b>ppm
                    </span>
                  </div>
                  <div>
                    <span className="quality-tag">
                      <i />
                      {status?.valid ? status.quality : "Waiting"}
                    </span>
                    <p>CO₂ concentration</p>
                    <small>{status?.valid ? "Live device reading" : "No sensor reading"}</small>
                  </div>
                </div>
                <div className="mobile-minis">
                  <div>
                    <span>
                      <Icon name="thermo" />
                      Temperature
                    </span>
                    <b>
                      {status?.valid ? status.temperature.toFixed(1) : "--"}<small>°C</small>
                    </b>
                    <em>{status?.valid ? "Live reading" : "Unavailable"}</em>
                  </div>
                  <div>
                    <span>
                      <Icon name="drop" />
                      Humidity
                    </span>
                    <b>
                      {status?.valid ? status.humidity.toFixed(1) : "--"}<small>%</small>
                    </b>
                    <em>{status?.valid ? "Live reading" : "Unavailable"}</em>
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
                    <b>{status?.fanMode || "Unknown"}</b>
                  </div>
                  <div>
                    <span>
                      <Icon name="volume" />
                      Air alarm
                    </span>
                    <b>{status ? status.muted ? "Muted" : "Enabled" : "Unknown"}</b>
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
                    <small>{status ? status.fanOn ? "Currently on" : "Currently off" : "State unavailable"}</small>
                  </div>
                </div>
                <div className="segmented">
                  {["Auto", "On", "Off"].map((x) => {
                    const mode = x === "Auto" ? "auto" : x.toLowerCase() as "on" | "off";
                    return <button key={x} disabled={!status} onClick={() => void setFan(mode)} className={status?.fanMode === mode ? "active" : ""}>{x}</button>;
                  })}
                </div>
                {controlError && <p role="alert">{controlError}</p>}
                <div className="mobile-control-card">
                  <span>
                    <Icon name="volume" />
                  </span>
                  <div>
                    <b>Audible alerts</b>
                    <small>Alarm threshold: 2,000 ppm</small>
                  </div>
                  <Toggle checked={!!status && !status.muted} onChange={() => void setMute(!!status && !status.muted)} label="Alerts" />
                </div>
                <div className="mobile-control-card">
                  <span>
                    <Icon name="light" />
                  </span>
                  <div>
                    <b>Status indicator</b>
                    <small>{status?.valid ? `Showing ${status.quality.toLowerCase()}` : "Waiting for sensor"}</small>
                  </div>
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
                  <b>{status?.alarmActive ? "Alarm active" : status ? "No active alarm" : "Device offline"}</b>
                  <p>{status?.alarmActive ? "The device reports an active CO2 alarm." : "Alarm state is clear or unavailable."}</p>
                </div>
                <small className="push-note">Event history and background push notifications are not exposed by the ESP32 API.</small>
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
              <b>Live companion view</b>Measurements and supported hardware commands use the connected AirWatch device.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeviceUI({ onExit, qrUrl }: { onExit: () => void; qrUrl: string }) {
  const { status } = useAirWatch();
  const [page, setPage] = useState(2);
  const uptime = status?.uptimeSeconds ?? 0;
  const deviceEpoch = status?.lastReadingEpoch && status.lastReadingUptime
    ? status.lastReadingEpoch + Math.max(0, status.uptimeSeconds - status.lastReadingUptime / 1000)
    : 0;
  const deviceTime = deviceEpoch ? new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(deviceEpoch * 1000)) : "Syncing time";
  const deviceDate = deviceEpoch ? new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", weekday: "long", month: "short", day: "numeric", year: "numeric" }).format(new Date(deviceEpoch * 1000)) : "Connect the device to Wi-Fi";
  return (
    <div className="showcase-screen device-showcase">
      <div className="showcase-top">
        <div>
          <span className="eyebrow">Physical interface</span>
          <h1>ILI9341 Touchscreen</h1>
          <p>240 x 320 portrait layout with vertical swipe navigation.</p>
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
                  <StatusDot online={!!status} label={status ? "LIVE" : "OFFLINE"} />
                </header>
                <div className="device-main-reading">
                  <span>CO₂</span>
                  <b>{status?.valid ? status.co2 : "--"}</b>
                  <small>PPM</small>
                  <em>{status?.valid ? status.quality : "WAITING"}</em>
                </div>
                <footer>
                  <div>
                    <Icon name="thermo" />
                    <span>
                      <b>{status?.valid ? `${status.temperature.toFixed(1)}°` : "--"}</b>TEMP
                    </span>
                  </div>
                  <div>
                    <Icon name="drop" />
                    <span>
                      <b>{status?.valid ? `${status.humidity.toFixed(1)}%` : "--"}</b>HUMIDITY
                    </span>
                  </div>
                </footer>
              </div>
            )}
            {page === 1 && (
              <div className="device-page device-uptime">
                <header>
                  <Logo compact />
                  <b>DEVICE UPTIME</b>
                </header>
                <div className="uptime-clock">
                  <span>{String(Math.floor(uptime / 3600)).padStart(2, "0")}</span>
                  <i>:</i>
                  <span>{String(Math.floor((uptime % 3600) / 60)).padStart(2, "0")}</span>
                  <i>:</i>
                  <span>{String(uptime % 60).padStart(2, "0")}</span>
                </div>
                <div className="uptime-labels">
                  <span>HOURS</span>
                  <span>MINUTES</span>
                  <span>SECONDS</span>
                </div>
                <p>{status?.systemOn ? "System operating normally" : "Device state unavailable"}</p>
                <StatusDot online={!!status?.systemOn} label={status?.systemOn ? "SYSTEM ACTIVE" : "SYSTEM OFFLINE"} />
              </div>
            )}
            {page === 2 && (
              <div className="device-page device-qr">
                <header>
                  <span>
                    <Icon name="wifi" size={16} /> {status?.wifi.connected ? "CONNECTED" : "SETUP MODE"}
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
                    <p>{status?.wifi.ip || status?.wifi.apIP || window.location.hostname}</p>
                    <small>Same Wi-Fi required</small>
                  </div>
                </div>
              </div>
            )}
            {page === 3 && (
              <div className="device-page device-time">
                <header><Logo compact /><b>TIME &amp; DATE</b></header>
                <div className="device-time-face">
                  <span>PHILIPPINE TIME</span>
                  <strong>{deviceTime}</strong>
                  <b>{deviceDate}</b>
                  <small>Asia/Manila · UTC+8</small>
                </div>
              </div>
            )}
            <button className="screen-arrow left" onClick={() => setPage((page + 3) % 4)}>
              ‹
            </button>
            <button className="screen-arrow right" onClick={() => setPage((page + 1) % 4)}>
              ›
            </button>
            <div className="screen-dots">
              {[0, 1, 2, 3].map((x) => (
                <i key={x} className={page === x ? "active" : ""} />
              ))}
            </div>
          </div>
        </div>
        <div className="device-copy">
          <span className="eyebrow">Page {page + 1} of 4</span>
          <h2>{["Live air quality", "Device uptime", "Wi-Fi & QR access", "Time & date"][page]}</h2>
          <p>Use the on-screen arrows to preview the swipe-left and swipe-right interaction.</p>
          <div className="dimension-chip">240 px x 320 px · portrait</div>
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
        description="Live SCD41 measurements and sample history received from the ESP32."
      />
      <MonitorChart />
      <section className="panel api-panel">
        <div>
          <span className="eyebrow">Firmware contract</span>
          <h2>Local REST API</h2>
            <p>Endpoints implemented by the supplied AirWatch v2.1 firmware.</p>
        </div>
        <div className="endpoint-list">
          <code>
            <b>GET</b> /api/status{" "}
            <span>valid, co2, temperature, humidity, quality, fanMode, muted, wifi, uptime</span>
          </code>
          <code><b>GET</b> /api/history <span>samples[]: uptime, epoch, co2, temp, hum</span></code>
          <code><b>POST</b> /api/control <span>fanMode, muted, displayTheme: light|dark</span></code>
          <code><b>POST</b> /api/wifi <span>ssid, password</span></code>
        </div>
        <div className="api-note">
          <Icon name="shield" />
          <p>
            <b>Confirmation-first controls</b>
            <span>
              Control requests require <code>X-AirWatch-Key</code> and succeed only after the ESP32 returns <code>{"{\"ok\":true}"}</code>.
            </span>
          </p>
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const { status, lastSuccess, accessKey, setAccessKey, refresh } = useAirWatch();
  const [active, setActive] = useState("Overview");
  const [dark, setDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showcase, setShowcase] = useState<"web" | "mobile" | "device">("web");
  const [toast, setToast] = useState("");
  const [themePending, setThemePending] = useState(false);
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
    if (status?.displayTheme) setDark(status.displayTheme === "dark");
  }, [status?.displayTheme]);
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
  const toggleTheme = async () => {
    const nextTheme = dark ? "light" : "dark";
    setDark(nextTheme === "dark");
    let key = accessKey.trim();
    if (!key) {
      key = window.prompt("Enter the AirWatch control key shown on the TFT Network page")?.trim() ?? "";
      if (!key) {
        notify(`Website changed to ${nextTheme}; enter the device key to sync the TFT`);
        return;
      }
      setAccessKey(key);
    }
    setThemePending(true);
    try {
      await setDisplayTheme(nextTheme, key);
      await refresh();
      notify(`Website and TFT switched to ${nextTheme} mode`);
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes("unauthorized")) setAccessKey("");
      notify(`Website changed to ${nextTheme}, but TFT sync failed: ${error instanceof Error ? error.message : "device unavailable"}`);
    } finally {
      setThemePending(false);
    }
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
              <b>AirWatch Device</b>
              <small>
                <i /> {status ? status.wifi.connected ? "Router connected" : "Setup access point" : "Disconnected"}
              </small>
            </p>
            <button>•••</button>
          </div>
          <span>ESP32-S3 · {status?.wifi.ip || status?.wifi.apIP || "No device address"}</span>
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
            <div className="last-sync"><i />{status ? <>Last response <b>{lastSuccess ? new Date(lastSuccess).toLocaleTimeString() : "just now"}</b></> : <b>Device offline</b>}</div>
            <button className="icon-button" onClick={() => notify("No new alerts")}>
              <Icon name="bell" />
              <i />
            </button>
            <button className="theme-button" onClick={() => void toggleTheme()} disabled={themePending}>
              <Icon name={dark ? "sun" : "moon"} />
              <span>{dark ? "Light" : "Dark"} mode</span>
            </button>
          </div>
        </header>
        <main className="content">
          {active === "Overview" && <Overview onConnectionClick={() => go("Wi-Fi & Connectivity")} />}
          {active === "Live Monitoring" && <ApiPage />}
          {active === "Historical Data" && <HistoryPage />}
          {active === "Device Controls" && <ControlsPage toast={notify} />}
          {active === "Wi-Fi & Connectivity" && <WifiPage toast={notify} qrUrl={qrUrl} />}
          {active === "Settings" && <SettingsPage />}
          {active === "About AirWatch" && <AboutPage />}
        </main>
        <footer className="site-footer">
          <span>AirWatch · Wireless Air Tracking & CO₂ Handling</span>
          <span>Local-only monitoring · Live data when connected</span>
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
