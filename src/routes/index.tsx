import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Camera, Mic, FileText, Phone, Home, Map, ClipboardList, Users, Download, Mail, Linkedin,
  ShieldCheck, UserPlus, MapPin, Send, Upload, CloudSun, Droplets, Wind, Facebook, MessageCircle,
  GraduationCap, Briefcase, ChevronDown, X, Square, Sun, Thermometer, Bell, Brain, MessageSquare,
  Bot, ScanLine, Pill, ArrowLeft, Star, Settings, Cloud, CloudOff, Image as ImageIcon, Navigation,
  Search, PlayCircle, BookOpen, Lock, Unlock, Heart, CheckCircle2, Lightbulb, FileDown, Loader2,
} from "lucide-react";
import logo from "@/assets/logo.png.asset.json";
import leadImg from "@/assets/lead.png.asset.json";
import { T, type TT, type Lang } from "@/components/pm/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PoultryMedix — AI Poultry Triage & AMR Surveillance" },
      { name: "description", content: "AI diagnosis chat, prescription antibiotic scanner, outbreak map and daily tips for poultry farmers in Bangladesh." },
      { property: "og:title", content: "PoultryMedix — AI Poultry Triage" },
      { property: "og:description", content: "AI triage and antimicrobial resistance surveillance for poultry farmers in Bangladesh." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: App,
});

type Screen = "onboard" | "home" | "chat" | "rx" | "drug" | "hub" | "feedback" | "map" | "history" | "team" | "profile";
type Nav = (s: Screen) => void;

function App() {
  const [lang, setLang] = useState<Lang>("en");
  const [screen, setScreen] = useState<Screen>("onboard");
  const [points, setPoints] = useState(140);
  const [user, setUser] = useState({ name: T.en.defaultFarmer, loc: 0, photo: "" });
  const t = T[lang];
  const changeLanguage = (nextLang: Lang) => {
    setLang(nextLang);
    setUser((current) => current.name === T[lang].defaultFarmer
      ? { ...current, name: T[nextLang].defaultFarmer }
      : current);
  };
  const go: Nav = (s) => { setScreen(s); if (typeof window !== "undefined") window.scrollTo({ top: 0 }); };

  return (
    <div className="min-h-screen bg-app" lang={lang}>
      <div dir={lang === "ur" ? "rtl" : "ltr"} className="mx-auto flex min-h-screen max-w-md flex-col pb-28">
        <Header lang={lang} setLang={changeLanguage} t={t} authed={screen !== "onboard"} points={points} user={user} go={go} />
        <main key={screen + lang} className="flex-1 px-5 animate-in fade-in duration-300">
          {screen === "onboard" && <Onboard t={t} onDone={() => go("home")} />}
          {screen === "home" && <HomeScreen t={t} go={go} lang={lang} />}
          {screen === "chat" && <ChatScreen t={t} go={go} lang={lang} />}
          {screen === "rx" && <RxScreen t={t} go={go} />}
          {screen === "drug" && <DrugScreen t={t} go={go} />}
          {screen === "hub" && <HubScreen t={t} onPoints={() => setPoints((p) => p + 20)} />}
          {screen === "feedback" && <FeedbackScreen t={t} go={go} />}
          {screen === "map" && <MapScreen t={t} />}
          {screen === "history" && <HistoryScreen t={t} />}
          {screen === "team" && <TeamScreen t={t} />}
          {screen === "profile" && <ProfileScreen t={t} go={go} user={user} setUser={setUser} />}
        </main>
        {screen !== "onboard" && <p className="px-5 pt-6 text-center text-xs text-muted-foreground">{t.footer}</p>}
      </div>
      {screen !== "onboard" && <BottomNav screen={screen} go={go} t={t} />}
    </div>
  );
}

/* ---------- shared ---------- */
function Back({ t, go, to = "home", title }: { t: TT; go: Nav; to?: Screen; title: string }) {
  return (
    <div className="flex items-center gap-3 pt-5">
      <button onClick={() => go(to)} aria-label={t.back} className="glass grid h-11 w-11 shrink-0 place-items-center rounded-full"><ArrowLeft className="h-5 w-5" /></button>
      <h1 className="min-w-0 text-2xl font-black">{title}</h1>
    </div>
  );
}
const Card = ({ children, className = "" }: { children: ReactNode; className?: string }) => <div className={`glass rounded-3xl p-5 ${className}`}>{children}</div>;
const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={`min-h-12 w-full rounded-2xl border border-border bg-card px-4 font-semibold outline-none focus:ring-2 focus:ring-ring ${p.className ?? ""}`} />;
const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`min-h-12 w-full rounded-2xl border border-border bg-card px-4 outline-none focus:ring-2 focus:ring-ring ${p.className ?? ""}`} />;
const BtnPrimary = ({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button {...p} className={`flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-meadow font-bold text-primary-foreground shadow-soft transition active:scale-[0.98] disabled:opacity-40 ${p.className ?? ""}`}>{children}</button>
);

function Header({ lang, setLang, t, authed, points, user, go }: { lang: Lang; setLang: (l: Lang) => void; t: TT; authed: boolean; points: number; user: { photo: string }; go: Nav }) {
  return (
    <header className="sticky top-0 z-20 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-b-3xl px-4 py-3 glass">
      <div className="flex min-w-0 items-center gap-2">
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl">
          <img src={logo.url} alt="PoultryMedix logo" className="h-full w-full scale-150 object-cover object-[50%_40%]" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-black"><span className="text-primary">{t.brand1}</span><span className="text-info">{t.brand2}</span></p>
          {authed && <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><span className="h-2 w-2 animate-pulse rounded-full bg-success" /> {t.online}</p>}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {authed && (
          <span className="flex items-center gap-1 rounded-full bg-sunrise px-2.5 py-1.5 text-xs font-black text-accent-foreground shadow-soft" title={t.points}>
            <Star className="h-3.5 w-3.5" />{points}
          </span>
        )}
        <div className="flex rounded-full bg-muted p-1 text-xs font-bold">
          {(["en", "bn", "hi", "ur"] as Lang[]).map((l) => (
            <button key={l} onClick={() => setLang(l)}
              aria-label={`${t.language}: ${l === "en" ? "English" : l === "bn" ? "বাংলা" : l === "hi" ? "हिंदी" : "اردو"}`}
              aria-pressed={lang === l}
              className={`min-h-8 rounded-full px-1.5 text-[10px] transition ${lang === l ? "bg-primary text-primary-foreground shadow-soft" : "text-muted-foreground"}`}>
              {l === "en" ? "EN" : l === "bn" ? "বাংলা" : l === "hi" ? "हिंदी" : "اردو"}
            </button>
          ))}
        </div>
        {authed && (
          <button onClick={() => go("profile")} aria-label={t.profile} className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-secondary text-primary">
            {user.photo ? <img src={user.photo} alt="" className="h-full w-full object-cover" /> : <Settings className="h-4 w-4" />}
          </button>
        )}
      </div>
    </header>
  );
}

/* ---------- onboarding ---------- */
function Onboard({ t, onDone }: { t: TT; onDone: () => void }) {
  const [agree, setAgree] = useState(false);
  return (
    <section className="flex flex-col items-center pt-6 text-center">
      <div className="glass overflow-hidden rounded-[2rem] p-1.5"><img src={logo.url} alt="PoultryMedix" className="h-36 w-36 object-cover" /></div>
      <h1 className="mt-5 text-2xl font-black">{t.welcome}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t.tagline}</p>
      <Card className="mt-6 w-full space-y-3 text-left">
        <Input placeholder={t.phoneEmail} aria-label={t.phoneEmail} />
        <Input type="password" placeholder={t.password} aria-label={t.password} />
        <Select aria-label={t.country} defaultValue="">
          <option value="" disabled>📍 {t.country}</option>
          {t.countries.map((c, i) => <option key={i} value={i}>{c}</option>)}
        </Select>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" defaultChecked className="h-5 w-5 accent-[var(--primary)]" />{t.remember}</label>
        <label className="flex cursor-pointer items-start gap-2 rounded-2xl bg-secondary/60 p-3 text-xs">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--primary)]" />
          <span><ShieldCheck className="mr-1 inline h-4 w-4 text-primary" />{t.consent}</span>
        </label>
        <BtnPrimary disabled={!agree} onClick={onDone}>{t.signIn}</BtnPrimary>
        <p className="text-center text-xs text-muted-foreground">{t.or}</p>
        <div className="grid grid-cols-2 gap-2">
          <button disabled={!agree} onClick={onDone} className="flex min-h-12 items-center justify-center gap-1.5 rounded-2xl border-2 border-primary bg-card text-sm font-bold text-primary disabled:opacity-40"><Phone className="h-4 w-4" />{t.login}</button>
          <button disabled={!agree} onClick={onDone} className="flex min-h-12 items-center justify-center gap-1.5 rounded-2xl border-2 border-accent bg-card text-sm font-bold text-accent-foreground disabled:opacity-40"><UserPlus className="h-4 w-4" />{t.create}</button>
        </div>
      </Card>
    </section>
  );
}

/* ---------- profile ---------- */
function ProfileScreen({ t, go, user, setUser }: { t: TT; go: Nav; user: { name: string; loc: number; photo: string }; setUser: (u: { name: string; loc: number; photo: string }) => void }) {
  const [d, setD] = useState(user);
  const [saved, setSaved] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-5">
      <Back t={t} go={go} title={t.profile} />
      <Card className="flex flex-col items-center gap-3">
        <div className="grid h-28 w-28 place-items-center overflow-hidden rounded-full bg-sunrise p-1">
          {d.photo ? <img src={d.photo} alt="" className="h-full w-full rounded-full object-cover" /> : <Users className="h-12 w-12 text-accent-foreground" />}
        </div>
        <button onClick={() => ref.current?.click()} className="flex min-h-11 items-center gap-2 rounded-full bg-secondary px-4 text-sm font-bold text-primary"><Camera className="h-4 w-4" />{t.uploadPhoto}</button>
        <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setD({ ...d, photo: URL.createObjectURL(f) }); }} />
      </Card>
      <Card className="space-y-3">
        <label className="block text-sm font-bold">{t.displayName}<Input className="mt-1" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></label>
        <label className="block text-sm font-bold">{t.country}
          <Select className="mt-1" value={d.loc} onChange={(e) => setD({ ...d, loc: +e.target.value })}>{t.countries.map((c, i) => <option key={i} value={i}>{c}</option>)}</Select>
        </label>
        <BtnPrimary onClick={() => { setUser(d); setSaved(true); setTimeout(() => setSaved(false), 1500); }}>
          {saved ? <><CheckCircle2 className="h-5 w-5" />{t.saved}</> : t.save}
        </BtnPrimary>
      </Card>
      <a href="tel:16358" className="flex items-center gap-3 rounded-3xl bg-sos p-4 text-destructive-foreground">
        <Phone className="h-6 w-6 shrink-0" /><span><b className="block">{t.sos}</b><span className="text-xs opacity-90">{t.sosSub}</span></span>
      </a>
    </div>
  );
}

/* ---------- home ---------- */
function Weather({ t }: { t: TT }) {
  const [w, setW] = useState({ temp: 33, hum: 78, wind: 12, uv: 8, c: 0 });
  useEffect(() => {
    const id = setInterval(() => setW((p) => ({
      temp: Math.round(28 + Math.random() * 8), hum: Math.round(65 + Math.random() * 25),
      wind: Math.round(6 + Math.random() * 12), uv: Math.round(4 + Math.random() * 7), c: (p.c + 1) % 3,
    })), 7000);
    return () => clearInterval(id);
  }, []);
  const heat = w.temp >= 32 && w.hum >= 70;
  const Stat = ({ icon: I, label, value, cls }: { icon: typeof Sun; label: string; value: string; cls: string }) => (
    <div className="flex items-center gap-2 rounded-2xl bg-card/55 p-2.5">
      <I className={`h-5 w-5 shrink-0 ${cls}`} /><div className="min-w-0"><p className="truncate text-[10px] font-semibold opacity-80">{label}</p><p className="text-sm font-black">{value}</p></div>
    </div>
  );
  return (
    <div className="rounded-3xl bg-sunrise p-5 text-accent-foreground shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-xs font-bold"><Navigation className="h-3.5 w-3.5" />{t.location}<span className="rounded-full bg-card/60 px-2 py-0.5 text-[10px]">{t.gpsDetected}</span></p>
          <p className="mt-1 text-5xl font-black">{w.temp}°C</p>
          <p className="font-bold">{t.conditions[w.c]}</p>
        </div>
        <CloudSun className="h-16 w-16 shrink-0" strokeWidth={1.5} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat icon={Droplets} label={t.humidity} value={`${w.hum}%`} cls="text-info" />
        <Stat icon={Wind} label={t.wind} value={`${w.wind} km/h`} cls="text-primary" />
        <Stat icon={Sun} label={t.uv} value={`${w.uv}`} cls="text-destructive" />
      </div>
      <div className={`mt-3 flex items-center gap-2 rounded-2xl p-3 text-sm font-bold ${heat ? "bg-destructive text-destructive-foreground animate-pulse" : "bg-success text-primary-foreground"}`}>
        <Thermometer className="h-5 w-5 shrink-0" /><span>{t.heatStress}: {heat ? t.heatHigh : t.heatOk}</span>
      </div>
    </div>
  );
}

function Noticeboard({ t }: { t: TT }) {
  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-destructive/15 text-destructive"><Bell className="h-5 w-5" /></span>
        <div className="min-w-0"><h2 className="font-black">{t.notice}</h2><p className="text-[11px] text-muted-foreground">{t.noticeSub}</p></div>
      </div>
      <div className="space-y-2">
        {t.notices.map((n, i) => (
          <div key={i} className="flex gap-3 rounded-2xl bg-muted/60 p-3">
            <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${n.c}`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2"><span className="text-xs font-black">{n.tag}</span><span className="shrink-0 text-[10px] text-muted-foreground">{n.time}</span></div>
              <p className="text-sm">{n.text}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

type ExternalTip = { title: string; extract: string; url: string };
type WikipediaSearchResponse = {
  query?: { pages?: Record<string, { pageid: number; title: string; extract?: string }> };
};

function TipCard({ t, lang }: { t: TT; lang: Lang }) {
  const [q, setQ] = useState("");
  const [externalTip, setExternalTip] = useState<ExternalTip | null>(null);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [externalSearchMessage, setExternalSearchMessage] = useState("");
  const tip = t.tips[new Date().getDate() % t.tips.length];
  const query = q.trim();
  const hits = query ? t.kb.filter((k) => (k.q + k.a).toLowerCase().includes(query.toLowerCase())) : [];

  useEffect(() => {
    if (!query || hits.length) {
      setExternalTip(null);
      setIsSearchingOnline(false);
      setExternalSearchMessage("");
      return;
    }

    setIsSearchingOnline(true);
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setExternalTip(null);
      setExternalSearchMessage("");

      void (async () => {
        try {
          const params = new URLSearchParams({
            action: "query",
            generator: "search",
            gsrsearch: query,
            gsrnamespace: "0",
            gsrlimit: "1",
            prop: "extracts",
            exintro: "1",
            explaintext: "1",
            format: "json",
            origin: "*",
          });
          const response = await fetch(`https://${lang}.wikipedia.org/w/api.php?${params}`, { signal: controller.signal });
          if (!response.ok) throw new Error(`Wikipedia search failed with status ${response.status}`);

          const data = await response.json() as WikipediaSearchResponse;
          const page = Object.values(data.query?.pages ?? {})[0];
          if (!page?.extract?.trim()) {
            setExternalSearchMessage(t.noOnlineResult);
            return;
          }

          setExternalTip({
            title: page.title,
            extract: page.extract,
            url: `https://${lang}.wikipedia.org/?curid=${page.pageid}`,
          });
        } catch (error) {
          if (controller.signal.aborted) return;
          console.error("Online farming information search failed", error);
          setExternalSearchMessage(t.externalSearchError);
        } finally {
          if (!controller.signal.aborted) setIsSearchingOnline(false);
        }
      })();
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, hits.length, t.kb, t.externalSearchError, t.noOnlineResult, lang]);

  return (
    <Card>
      <h2 className="flex items-center gap-2 font-black"><Lightbulb className="h-5 w-5 text-accent" />{t.tipT}</h2>
      <p className="mt-2 text-sm">{tip.t}</p>
      <a href="#" onClick={(e) => e.preventDefault()} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-info underline"><BookOpen className="h-3.5 w-3.5" />{t.sourceLbl} {tip.s}</a>
      <div className="mt-3 flex items-center gap-2 rounded-full border border-border bg-card px-4">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.tipSearch} className="min-h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" />
      </div>
      {q.trim() && (
        <div className="mt-2 space-y-2" aria-live="polite">
          {hits.length ? hits.map((h) => <div key={h.q} className="rounded-2xl bg-secondary/70 p-3 text-sm"><b>{h.q}</b><p className="text-muted-foreground">{h.a}</p></div>)
            : isSearchingOnline ? <p className="text-xs text-muted-foreground">{t.searchingOnline}</p>
              : externalTip ? (
                <a href={externalTip.url} target="_blank" rel="noreferrer" className="flex gap-3 rounded-2xl bg-muted/60 p-3">
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-info" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black">{externalTip.title}</span>
                      <span className="shrink-0 rounded-full bg-card/60 px-2 py-0.5 text-[10px] text-muted-foreground">{t.externalBadge}</span>
                    </div>
                    <p className="text-sm">{externalTip.extract}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{t.externalSource}</p>
                  </div>
                </a>
              ) : <p className="text-xs text-muted-foreground">{externalSearchMessage || t.noResult}</p>}
        </div>
      )}
    </Card>
  );
}

function AudioActions({ t }: { t: TT }) {
  const [rec, setRec] = useState(false);
  const [file, setFile] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2 rounded-2xl bg-muted/60 p-3">
      <button onClick={() => { setRec(!rec); setFile(null); }} className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-4 text-sm font-bold text-primary-foreground ${rec ? "bg-sos animate-pulse" : "bg-meadow"}`}>
        {rec ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}{rec ? `${t.recording} — ${t.recStop}` : t.recLive}
      </button>
      <button onClick={() => ref.current?.click()} className="flex min-h-12 w-full items-center gap-3 rounded-xl border-2 border-dashed border-accent bg-card px-4 text-left">
        <Upload className="h-5 w-5 shrink-0" /><span><span className="block text-sm font-bold">{t.uploadAV}</span><span className="text-[11px] text-muted-foreground">{t.avTypes}</span></span>
      </button>
      <input ref={ref} type="file" accept="audio/*,video/*" className="hidden" onChange={(e) => { setFile(e.target.files?.[0]?.name ?? null); setRec(false); }} />
      {file && <p className="rounded-xl bg-secondary p-2 text-xs"><b>{t.selected}</b> {file} · {t.analyzing}</p>}
    </div>
  );
}

function HomeScreen({ t, go, lang }: { t: TT; go: Nav; lang: Lang }) {
  const [audio, setAudio] = useState(false);
  const sub = [
    { icon: Camera, l: t.scanImage, on: () => go("chat") },
    { icon: Mic, l: t.recordAudio, on: () => setAudio(!audio), active: audio },
    { icon: ScanLine, l: t.rxScanner, on: () => go("rx") },
    { icon: Bot, l: t.askBot, on: () => go("chat") },
  ];
  const grid = [
    { icon: Pill, title: t.drugInfo, sub: t.drugInfoSub, cls: "bg-secondary text-primary", on: () => go("drug") },
    { icon: Brain, title: t.contribute, sub: t.contributeSub, cls: "bg-sunrise text-accent-foreground", on: () => go("hub") },
    { icon: MessageSquare, title: t.feedback, sub: t.feedbackSub, cls: "bg-muted text-info", on: () => go("feedback") },
    { icon: ClipboardList, title: t.history, sub: t.export, cls: "bg-secondary text-primary", on: () => go("history") },
  ];
  return (
    <div className="space-y-5 pt-5">
      <Weather t={t} />

      <button onClick={() => go("chat")} className="flex w-full items-center gap-4 rounded-3xl bg-meadow p-5 text-left text-primary-foreground shadow-soft active:scale-[0.98]">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary-foreground/20"><Bot className="h-8 w-8" /></span>
        <span className="min-w-0"><span className="block text-lg font-black">{t.chatTitle}</span><span className="text-xs opacity-90">{t.botLangs}</span></span>
      </button>

      <Noticeboard t={t} />

      <Card>
        <div className="mb-3 flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-sunrise text-accent-foreground"><ScanLine className="h-5 w-5" /></span>
          <div><h2 className="font-black">{t.aiScanner}</h2><p className="text-[11px] text-muted-foreground">{t.aiScannerSub}</p></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {sub.map(({ icon: I, l, on, active }) => (
            <button key={l} onClick={on} className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl bg-secondary/70 p-2 text-center text-xs font-bold transition active:scale-95 ${active ? "ring-2 ring-accent" : ""}`}>
              <I className="h-5 w-5 text-primary" />{l}
            </button>
          ))}
        </div>
        {audio && <div className="mt-3"><AudioActions t={t} /></div>}
      </Card>

      <div className="grid grid-cols-2 gap-4">
        {grid.map(({ icon: I, title, sub, cls, on }) => (
          <button key={title} onClick={on} className="glass flex flex-col items-start gap-2 rounded-3xl p-4 text-left transition hover:-translate-y-0.5 active:scale-95">
            <span className={`grid h-11 w-11 place-items-center rounded-2xl ${cls}`}><I className="h-5 w-5" /></span>
            <span className="text-sm font-extrabold leading-tight">{title}</span>
            <span className="text-[11px] text-muted-foreground">{sub}</span>
          </button>
        ))}
      </div>

      <TipCard t={t} lang={lang} />

      <a href="tel:16358" className="flex items-center gap-3 rounded-3xl bg-sos p-4 text-destructive-foreground active:scale-[0.98]">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-destructive-foreground/20"><Phone className="h-5 w-5" /></span>
        <span className="min-w-0"><b className="block">{t.sos}</b><span className="flex items-center gap-1 text-xs opacity-90"><MapPin className="h-3 w-3 shrink-0" />{t.sosSub}</span></span>
      </a>
    </div>
  );
}

/* ---------- chat ---------- */
type Msg = { from: "me" | "bot"; text: string; src?: string; videos?: boolean; reference?: { label: string; url?: string } };
type ChatKnowledge = { title: string; answer: string };
type SpeechRecognitionConstructor = new () => {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function findLocalChatKnowledge(query: string, t: TT): ChatKnowledge | null {
  const entries: ChatKnowledge[] = [
    ...t.kb.map((entry) => ({ title: entry.q, answer: entry.a })),
    ...t.tips.map((entry) => ({ title: t.tipT, answer: entry.t })),
    ...t.notices.map((entry) => ({ title: entry.tag, answer: entry.text })),
  ];
  const normalizedQuery = query.toLocaleLowerCase();
  const exactMatch = entries.find((entry) => `${entry.title} ${entry.answer}`.toLocaleLowerCase().includes(normalizedQuery));
  if (exactMatch) return exactMatch;

  const words = normalizedQuery.split(/\s+/).filter((word) => word.length > 2);
  if (!words.length) return null;
  const threshold = Math.min(2, words.length);
  const matches = entries
    .map((entry) => ({
      entry,
      score: words.filter((word) => `${entry.title} ${entry.answer}`.toLocaleLowerCase().includes(word)).length,
    }))
    .filter((match) => match.score >= threshold)
    .sort((a, b) => b.score - a.score);
  return matches[0]?.entry ?? null;
}

function ChatScreen({ t, go, lang }: { t: TT; go: Nav; lang: Lang }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ from: "bot", text: t.chatHello }]);
  const [text, setText] = useState("");
  const [stage, setStage] = useState<null | "local" | "cloud">(null);
  const [rec, setRec] = useState(false);
  const [chatError, setChatError] = useState("");
  const imgRef = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const recognition = useRef<InstanceType<SpeechRecognitionConstructor> | null>(null);
  const transcript = useRef("");
  const requestId = useRef(0);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, stage]);
  useEffect(() => () => {
    requestId.current += 1;
    if (mediaRecorder.current) mediaRecorder.current.onstop = null;
    if (mediaRecorder.current?.state === "recording") mediaRecorder.current.stop();
    recognition.current?.stop();
    mediaStream.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const reply = async (kind: "file" | "audio" | "text", userText: string, query = userText) => {
    const currentRequest = ++requestId.current;
    setMsgs((m) => [...m, { from: "me", text: userText }]);
    setStage("local");
    setChatError("");
    const isCurrentRequest = () => requestId.current === currentRequest;

    try {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 350));
      if (!isCurrentRequest()) return;
      const localMatch = query ? findLocalChatKnowledge(query, t) : null;
      if (localMatch || kind === "audio" && !query.trim()) {
        setMsgs((m) => [...m, {
          from: "bot",
          text: localMatch ? `${localMatch.title}: ${localMatch.answer}` : t.botAudio,
          src: t.srcDb,
          videos: kind === "file" || kind === "text",
          reference: { label: t.chatLocalReference },
        }]);
        return;
      }

      setStage("cloud");
      const params = new URLSearchParams({
        action: "query",
        generator: "search",
        gsrsearch: query,
        gsrnamespace: "0",
        gsrlimit: "1",
        prop: "extracts",
        exintro: "1",
        explaintext: "1",
        format: "json",
        origin: "*",
      });
      const response = await fetch(`https://${lang}.wikipedia.org/w/api.php?${params}`, { signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error(`Online veterinary search failed with status ${response.status}`);
      const data = await response.json() as WikipediaSearchResponse;
      if (!isCurrentRequest()) return;

      const page = Object.values(data.query?.pages ?? {})[0];
      if (!page?.extract?.trim()) {
        setMsgs((m) => [...m, { from: "bot", text: t.chatNoOnlineResult, src: t.srcWeb }]);
        return;
      }
      setMsgs((m) => [...m, {
        from: "bot",
        text: page.extract ?? "",
        src: t.srcWeb,
        videos: kind !== "audio",
        reference: { label: page.title, url: `https://${lang}.wikipedia.org/?curid=${page.pageid}` },
      }]);
    } catch (error) {
      if (!isCurrentRequest()) return;
      console.error("Online veterinary information search failed", error);
      setChatError(t.chatOnlineError);
      setMsgs((m) => [...m, { from: "bot", text: t.chatOnlineError }]);
    } finally {
      if (isCurrentRequest()) setStage(null);
    }
  };

  const startRecording = async () => {
    setChatError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("Audio recording is not supported in this browser");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaStream.current = stream;
      mediaRecorder.current = recorder;
      audioChunks.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) audioChunks.current.push(event.data);
      };
      transcript.current = "";
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        mediaStream.current = null;
        setRec(false);
        const spokenQuery = transcript.current.trim();
        const recording = new Blob(audioChunks.current, { type: recorder.mimeType || "audio/webm" });
        audioChunks.current = [];
        if (recording.size) void reply("audio", spokenQuery || t.audioSent, spokenQuery);
      };

      const speechWindow = window as Window & {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      };
      const SpeechRecognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const speech = new SpeechRecognition();
        speech.lang = lang === "bn" ? "bn-BD" : lang === "hi" ? "hi-IN" : lang === "ur" ? "ur-PK" : "en-US";
        speech.interimResults = false;
        speech.onresult = (event) => {
          const result = event.results[event.results.length - 1];
          if (result?.[0]?.transcript) transcript.current = result[0].transcript;
        };
        speech.onerror = () => setChatError(t.chatRecordError);
        recognition.current = speech;
        speech.start();
      }

      recorder.start();
      setRec(true);
    } catch (error) {
      mediaStream.current?.getTracks().forEach((track) => track.stop());
      mediaStream.current = null;
      recognition.current?.stop();
      recognition.current = null;
      console.error("Voice recording could not be started", error);
      setChatError(t.chatRecordError);
    }
  };

  const toggleRecording = () => {
    if (mediaRecorder.current?.state === "recording") {
      recognition.current?.stop();
      mediaRecorder.current.stop();
      return;
    }
    void startRecording();
  };

  return (
    <div className="space-y-4">
      <Back t={t} go={go} title={t.chatTitle} />
      <p className="flex items-center gap-2 rounded-2xl bg-secondary p-3 text-xs font-bold text-secondary-foreground"><MessageCircle className="h-4 w-4 shrink-0" />{t.botLangs}</p>
      <div className="space-y-3" aria-live="polite">
        {msgs.map((m, i) => m.from === "me" ? (
          <div key={i} className="ml-auto max-w-[80%] rounded-3xl rounded-br-md bg-primary px-4 py-3 text-sm text-primary-foreground">{m.text}</div>
        ) : (
          <div key={i} className="flex gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sunrise text-accent-foreground"><Bot className="h-5 w-5" /></span>
            <div className="glass min-w-0 max-w-[85%] rounded-3xl rounded-tl-md p-4 text-sm">
              <p>{m.text}</p>
              {m.reference && (
                m.reference.url
                  ? <a href={m.reference.url} target="_blank" rel="noreferrer" className="mt-2 block text-xs font-bold text-info underline">{t.sourceLbl} {m.reference.label}</a>
                  : <span className="mt-2 block text-xs text-muted-foreground">{t.sourceLbl} {m.reference.label}</span>
              )}
              {m.videos && (
                <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                  <p className="text-xs font-black">{t.videos}</p>
                  {t.vidList.map((video) => (
                    <a key={video} href={`https://www.youtube.com/results?search_query=${encodeURIComponent(video)}`} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 rounded-xl bg-destructive/10 p-2 text-xs font-bold text-destructive"><PlayCircle className="h-4 w-4 shrink-0" />{video}</a>
                  ))}
                </div>
              )}
              {m.src && <span className="mt-3 inline-flex items-center gap-1 rounded-full border border-primary/30 bg-secondary px-2 py-0.5 text-[10px] font-bold text-primary"><ShieldCheck className="h-3 w-3" />{m.src}</span>}
              <p className="mt-3 rounded-xl border border-warning/50 bg-warning/10 p-2 text-[11px] font-semibold text-foreground">
                <strong>{t.chatDisclaimerTitle}: </strong>{t.chatDisclaimer}
              </p>
            </div>
          </div>
        ))}
        {stage && (
          <div className={`flex items-center gap-2 rounded-2xl p-3 text-xs font-bold transition-all ${stage === "cloud" ? "bg-info text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            {stage === "cloud" ? <Cloud className="h-4 w-4 animate-bounce" /> : <Loader2 className="h-4 w-4 animate-spin" />}
            {stage === "cloud" ? t.chatSearchOnline : t.localModel}
          </div>
        )}
        <div ref={end} />
      </div>
      <div className="glass sticky bottom-24 flex items-center gap-1.5 rounded-full p-1.5 pl-2">
        <button onClick={() => imgRef.current?.click()} aria-label={t.scanImage} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-secondary text-primary"><ImageIcon className="h-5 w-5" /></button>
        <input ref={imgRef} type="file" accept="image/*,audio/*,video/*" className="hidden" onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            const label = file.type.startsWith("image/") ? t.imgSent : t.chatAttachment;
            void reply("file", `${label}: ${file.name}`, file.name.replace(/\.[^.]+$/, ""));
          }
          e.target.value = "";
        }} />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t.chatPh}
          aria-label={t.chatPh}
          onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) { void reply("text", text); setText(""); } }}
          className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none" />
        <button onClick={toggleRecording} aria-label={t.recordAudio}
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-primary-foreground ${rec ? "bg-sos animate-pulse" : "bg-meadow"}`}>{rec ? <Square className="h-4 w-4" /> : <Mic className="h-5 w-5" />}</button>
        <button onClick={() => { if (text.trim()) { void reply("text", text); setText(""); } }} aria-label={t.chatSend} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sunrise text-accent-foreground"><Send className="h-5 w-5" /></button>
      </div>
      {chatError && <p role="alert" className="text-xs text-destructive">{chatError}</p>}
    </div>
  );
}

/* ---------- prescription scanner ---------- */
function RxScreen({ t, go }: { t: TT; go: Nav }) {
  const [state, setState] = useState<"idle" | "fetch" | "done">("idle");
  const ref = useRef<HTMLInputElement>(null);
  const start = () => { setState("fetch"); setTimeout(() => setState("done"), 2200); };
  return (
    <div className="space-y-4">
      <Back t={t} go={go} title={t.rxTitle} />
      <Card className="text-center">
        <p className="text-sm text-muted-foreground">{t.rxHint}</p>
        <BtnPrimary className="mt-4" onClick={() => ref.current?.click()}><Camera className="h-5 w-5" />{t.rxUpload}</BtnPrimary>
        <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { if (e.target.files?.[0]) start(); e.target.value = ""; }} />
      </Card>
      {state === "fetch" && <Card className="flex items-center gap-3 text-sm font-bold"><Loader2 className="h-5 w-5 animate-spin text-primary" />{t.rxFetching}</Card>}
      {state === "done" && (
        <>
          {t.rxResults.map((r) => (
            <Card key={r.trade} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-muted/60 p-3"><p className="text-[10px] font-bold text-muted-foreground">{t.tradeName}</p><p className="font-black">{r.trade}</p></div>
                <div className="rounded-2xl bg-secondary p-3"><p className="text-[10px] font-bold text-muted-foreground">{t.generic}</p><p className="font-black text-primary">{r.generic}</p></div>
              </div>
              <div className="rounded-2xl bg-muted/60 p-3 text-sm"><p className="text-[10px] font-bold text-muted-foreground">{t.dose}</p>{r.dose}</div>
              <div className="rounded-2xl border-2 border-warning p-3 text-sm">
                <p className="text-xs font-black">{t.withdrawal}</p>
                <p className="mt-1"><b>{t.local}:</b> {r.local}</p>
                <p className="mt-1 text-muted-foreground"><b>{t.intl}:</b> {r.intl}</p>
              </div>
            </Card>
          ))}
          <p className="rounded-2xl bg-muted p-3 text-xs text-muted-foreground">{t.rxSkipped}</p>
        </>
      )}
    </div>
  );
}

/* ---------- drug info ---------- */
function DrugScreen({ t, go }: { t: TT; go: Nav }) {
  const Row = ({ label, meat, eggs }: { label: string; meat: string; eggs: string }) => (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-2xl bg-card p-3 text-center"><p className="text-[11px] font-bold text-muted-foreground">{t.meat}</p><p className="text-2xl font-black">{meat}</p><p className="text-[11px]">{t.days}</p></div>
      <div className="rounded-2xl bg-card p-3 text-center"><p className="text-[11px] font-bold text-muted-foreground">{t.eggs}</p><p className="text-sm font-black">{eggs}</p><span className="sr-only">{label}</span></div>
    </div>
  );
  return (
    <div className="space-y-4">
      <Back t={t} go={go} title={t.drugInfo} />
      <Card>
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-warning/30 text-accent-foreground"><Pill className="h-6 w-6" /></span>
          <div className="min-w-0"><h2 className="font-black">{t.drugName}</h2><p className="text-xs text-muted-foreground">{t.drugClass}</p></div>
        </div>
        <h3 className="mt-5 text-sm font-black uppercase tracking-wide text-primary">{t.withdrawal}</h3>
        <div className="mt-2 rounded-3xl bg-meadow p-4 text-primary-foreground">
          <p className="mb-2 flex items-center gap-1 text-sm font-black"><MapPin className="h-4 w-4" />{t.local}</p>
          <div className="text-foreground"><Row label={t.local} meat="7" eggs={t.notEggs} /></div>
        </div>
        <div className="mt-3 rounded-3xl bg-muted p-4">
          <p className="mb-2 text-sm font-bold text-muted-foreground">🌐 {t.intl}</p>
          <Row label={t.intl} meat="5" eggs={t.notEggs} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{t.drugNote}</p>
      </Card>
    </div>
  );
}

/* ---------- data hub ---------- */
function HubScreen({ t, onPoints }: { t: TT; onPoints: () => void }) {
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [sev, setSev] = useState(1);
  const [online, setOnline] = useState(true);
  const [done, setDone] = useState(false);
  const items = [{ k: "img", icon: ImageIcon, l: t.upImg }, { k: "ac", icon: Mic, l: t.upAc }, { k: "gps", icon: MapPin, l: t.upGps }, { k: "voice", icon: MessageCircle, l: t.upVoice }];
  const lights = [{ c: "bg-success", l: t.safe }, { c: "bg-warning", l: t.wait }, { c: "bg-destructive", l: t.danger }];
  return (
    <div className="space-y-4 pt-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0"><h1 className="text-2xl font-black">{t.hub}</h1><p className="text-xs text-muted-foreground">{t.hubSub}</p></div>
        <button onClick={() => setOnline(!online)} className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-2 text-xs font-bold ${online ? "bg-secondary text-primary" : "bg-muted text-muted-foreground"}`}>
          {online ? <Cloud className="h-4 w-4" /> : <CloudOff className="h-4 w-4" />}{online ? t.synced : t.offline}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {items.map(({ k, icon: I, l }) => (
          <button key={k} onClick={() => setAdded({ ...added, [k]: !added[k] })}
            className={`glass flex min-h-28 flex-col items-center justify-center gap-2 rounded-3xl p-3 text-sm font-bold ${added[k] ? "ring-2 ring-primary" : ""}`}>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-primary">{added[k] ? <CheckCircle2 className="h-6 w-6" /> : <I className="h-6 w-6" />}</span>
            {l}{added[k] && <span className="text-[10px] text-primary">{t.added}</span>}
          </button>
        ))}
      </div>
      <Card className="space-y-4">
        <label className="block text-sm font-bold">{t.topic}<Select className="mt-1">{t.topics.map((x) => <option key={x}>{x}</option>)}</Select></label>
        <div>
          <p className="text-sm font-bold">{t.severity}</p>
          <div className="mt-2 flex justify-around rounded-3xl bg-foreground/90 p-3">
            {lights.map((x, i) => (
              <button key={i} onClick={() => setSev(i)} className="flex flex-col items-center gap-1 text-[11px] font-bold text-background">
                <span className={`h-12 w-12 rounded-full ${x.c} transition ${sev === i ? "scale-110 opacity-100 ring-4 ring-background/60" : "opacity-30"}`} />{x.l}
              </button>
            ))}
          </div>
        </div>
        <BtnPrimary onClick={() => { onPoints(); setDone(true); setAdded({}); setTimeout(() => setDone(false), 2000); }}>
          {done ? <><Star className="h-5 w-5" />{t.thanks}</> : t.submit}
        </BtnPrimary>
      </Card>
    </div>
  );
}

/* ---------- feedback ---------- */
function FeedbackScreen({ t, go }: { t: TT; go: Nav }) {
  const [sent, setSent] = useState(false);
  return (
    <div className="space-y-4">
      <Back t={t} go={go} title={t.fbTitle} />
      <Card className="space-y-3">
        <label className="block text-sm font-bold">{t.category}<Select className="mt-1">{t.categories.map((c) => <option key={c}>{c}</option>)}</Select></label>
        <label className="block text-sm font-bold">{t.message}
          <textarea rows={4} className="mt-1 w-full rounded-2xl border border-border bg-card p-4 outline-none focus:ring-2 focus:ring-ring" />
        </label>
        <BtnPrimary onClick={() => setSent(true)}>{sent ? <><CheckCircle2 className="h-5 w-5" />{t.saved}</> : <><Send className="h-5 w-5" />{t.send}</>}</BtnPrimary>
      </Card>
      <h2 className="pt-2 font-black">{t.resolved}</h2>
      {t.ideas.map((i) => (
        <div key={i.t} className="glass flex items-center gap-3 rounded-3xl p-4">
          <Lightbulb className="h-5 w-5 shrink-0 text-accent" />
          <div className="min-w-0 flex-1"><p className="text-sm font-bold">{i.t}</p><p className="text-xs text-muted-foreground">{i.by}</p></div>
          <span className="shrink-0 rounded-full bg-success px-2 py-0.5 text-[10px] font-bold text-primary-foreground">{t.resolvedTag}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- map ---------- */
const spots = [
  { x: 30, y: 22, s: 80, d: "nd" }, { x: 50, y: 30, s: 60, d: "cocci" }, { x: 62, y: 48, s: 70, d: "ai" },
  { x: 40, y: 70, s: 50, d: "cocci" }, { x: 75, y: 80, s: 35, d: "nd" }, { x: 55, y: 58, s: 40, d: "ib" },
] as const;

function MapScreen({ t }: { t: TT }) {
  const [f, setF] = useState("all");
  const [vet, setVet] = useState(false);
  const shown = spots.filter((s) => f === "all" || s.d === f);
  return (
    <div className="space-y-4 pt-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 text-2xl font-black">{t.mapN}</h1>
        <button onClick={() => setVet(!vet)} className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-2 text-[11px] font-bold ${vet ? "bg-info text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          {vet ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}{t.vetView}
        </button>
      </div>
      <p className="flex items-center gap-2 rounded-2xl bg-secondary p-3 text-xs font-bold text-secondary-foreground"><ShieldCheck className="h-4 w-4 shrink-0" />{t.anonym}</p>
      <Select value={f} onChange={(e) => setF(e.target.value)} aria-label={t.filter}>
        <option value="all">{t.filter}: {t.all}</option>
        {(Object.keys(t.diseases) as (keyof TT["diseases"])[]).map((k) => <option key={k} value={k}>{t.diseases[k]}</option>)}
      </Select>
      <div className="glass relative aspect-[3/4] overflow-hidden rounded-3xl bg-secondary">
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
          <path d="M22 4 L48 6 L60 14 L72 10 L80 24 L76 40 L86 52 L82 70 L92 96 L70 88 L56 94 L46 82 L32 86 L24 70 L14 58 L20 40 L12 24 Z" fill="var(--card)" stroke="var(--primary)" strokeWidth="0.6" opacity="0.8" />
        </svg>
        {shown.map((s, i) => (
          <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${s.x}%`, top: `${s.y}%` }}>
            <div className="animate-pulse rounded-full blur-md" style={{ width: s.s, height: s.s, background: "radial-gradient(circle, var(--destructive), var(--accent) 50%, transparent 70%)" }} />
          </div>
        ))}
        <div className="glass absolute bottom-3 left-3 right-3 flex justify-between rounded-2xl p-3 text-xs font-bold">
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-destructive" />{t.high}</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-accent" />{t.medium}</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-warning" />{t.low}</span>
        </div>
      </div>
      <Card>
        <h2 className="mb-3 font-black">{t.districtT}</h2>
        <div className="space-y-3">
          {t.districts.map((d) => (
            <div key={d.d}>
              <div className="flex justify-between text-sm"><span className="font-bold">{d.d} <span className="text-xs font-normal text-muted-foreground">· {d.dz}</span></span><span className="font-black">{d.p}%</span></div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-sunrise" style={{ width: `${d.p * 2.5}%` }} /></div>
            </div>
          ))}
        </div>
      </Card>
      {vet && (
        <Card className="animate-in fade-in slide-in-from-bottom-2">
          <p className="mb-3 flex items-center gap-2 text-sm font-black text-info"><Unlock className="h-4 w-4" />{t.vetOn}</p>
          <div className="grid grid-cols-2 gap-2">
            {[[t.reports, "1,284"], [t.mortality, "4.2%"], [t.amrIdx, "0.68"], [t.trend, "▲ 12%"]].map(([l, v]) => (
              <div key={l} className="rounded-2xl bg-muted/60 p-3"><p className="text-[11px] font-bold text-muted-foreground">{l}</p><p className="text-xl font-black">{v}</p></div>
            ))}
          </div>
          <div className="mt-3 flex h-20 items-end gap-1.5">
            {[30, 45, 38, 60, 52, 70, 82].map((h, i) => <div key={i} className="flex-1 rounded-t-lg bg-meadow" style={{ height: `${h}%` }} />)}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ---------- history ---------- */
function HistoryScreen({ t }: { t: TT }) {
  const colors = ["bg-destructive", "bg-warning", "bg-success", "bg-success"];
  return (
    <div className="space-y-4 pt-5">
      <div className="flex items-center justify-between gap-2">
        <h1 className="min-w-0 text-2xl font-black">{t.history}</h1>
        <div className="flex shrink-0 gap-2">
          <button onClick={() => typeof window !== "undefined" && window.print()} aria-label={t.exportPdf} title={t.exportPdf}
            className="grid h-11 w-11 place-items-center rounded-full bg-destructive/15 text-destructive"><FileDown className="h-5 w-5" /></button>
          <button className="flex min-h-11 items-center gap-1.5 rounded-full bg-sunrise px-3 text-xs font-bold text-accent-foreground shadow-soft"><Download className="h-4 w-4" />{t.export}</button>
        </div>
      </div>
      {t.logs.map((l, i) => (
        <div key={i} className="glass flex items-center gap-3 rounded-3xl p-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{l.date}</p>
            <p className="font-extrabold">{l.dx}</p>
            <p className="truncate text-sm text-muted-foreground">{l.sym}</p>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold text-primary-foreground ${colors[i]}`}>{l.st}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- team ---------- */
// ✏️ Edit contact links here
const LEAD_LINKS = { email: "mailto:you@example.com", whatsapp: "https://wa.me/8801000000000", linkedin: "#", facebook: "#" };
function Socials({ links, t, small }: { links: typeof LEAD_LINKS; t: TT; small?: boolean }) {
  const items = [
    { href: links.email, icon: Mail, label: t.email, cls: "text-primary" },
    { href: links.whatsapp, icon: MessageCircle, label: t.whatsapp, cls: "text-success" },
    { href: links.linkedin, icon: Linkedin, label: t.linkedin, cls: "text-info" },
    { href: links.facebook, icon: Facebook, label: t.facebook, cls: "text-info" },
  ];
  const s = small ? "h-9 w-9" : "h-11 w-11";
  return (
    <div className="flex gap-2">
      {items.map(({ href, icon: I, label, cls }) => (
        <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label} className={`grid ${s} place-items-center rounded-full bg-secondary ${cls} transition hover:scale-110`}><I className="h-4 w-4" /></a>
      ))}
    </div>
  );
}
function InfoBlock({ icon: I, title, text }: { icon: typeof Briefcase; title: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-2xl bg-muted/60 p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><I className="h-5 w-5" /></span>
      <div className="min-w-0"><p className="text-sm font-extrabold">{title}</p><p className="text-sm text-muted-foreground">{text}</p></div>
    </div>
  );
}

function TeamScreen({ t }: { t: TT }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-5 pt-5">
      <h1 className="text-2xl font-black">{t.team}</h1>

      <div className="glass overflow-hidden rounded-3xl">
        <div className="h-20 bg-meadow" />
        <div className="-mt-14 flex flex-col items-center px-6 pb-5 text-center">
          <div className="rounded-full bg-sunrise p-1"><img src={leadImg.url} alt={t.leadName} className="h-28 w-28 rounded-full border-4 border-card object-cover" /></div>
          <span className="mt-3 rounded-full bg-sunrise px-3 py-0.5 text-xs font-bold text-accent-foreground">{t.leadBadge}</span>
          <h2 className="mt-2 text-2xl font-black">{t.leadName}</h2>
          <p className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{t.hometownT}: {t.hometown}</p>
          <div className="mt-4"><Socials links={LEAD_LINKS} t={t} /></div>
        </div>
        <div className="space-y-3 px-5 pb-5">
          <InfoBlock icon={Briefcase} title={t.rolesT} text={t.roles} />
          <InfoBlock icon={GraduationCap} title={t.academicT} text={t.academic} />
        </div>
      </div>

      <Card>
        <h2 className="text-lg font-black text-primary">{t.aboutT}</h2>
        <p className="text-sm text-muted-foreground">{t.briefTitle} · {t.briefUni}</p>
        <ul className="mt-3 space-y-2">
          {t.brief.map(([e, k, v]) => <li key={k} className="rounded-2xl bg-muted/60 p-3 text-sm"><span className="mr-1">{e}</span><b>{k}:</b> {v}</li>)}
        </ul>
        <button onClick={() => setOpen(!open)} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-meadow font-bold text-primary-foreground shadow-soft">
          {open ? t.close : t.readMore}<ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div className="mt-4 space-y-4 text-sm leading-relaxed animate-in fade-in">
            {t.intro.map((p, i) => <p key={i}>{p}</p>)}
            <p className="font-extrabold">{t.focusT}</p>
            {t.focus.map(([h, p]) => (
              <div key={h} className="rounded-2xl border-l-4 border-primary bg-secondary/60 p-3"><p className="font-extrabold">{h}</p><p className="mt-1 text-muted-foreground">{p}</p></div>
            ))}
            <p className="italic">{t.outro}</p>
          </div>
        )}
      </Card>

      <h2 className="pt-1 text-lg font-black">{t.membersT}</h2>
      <div className="glass overflow-hidden rounded-3xl">
        <div className="h-14 bg-sunrise" />
        <div className="-mt-10 flex flex-col items-center px-6 pb-5 text-center">
          <div className="grid h-24 w-24 place-items-center rounded-full border-4 border-card bg-secondary text-primary shadow-soft">
            <Users className="h-10 w-10" />
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">{t.photoSoon}</p>
          <span className="mt-2 rounded-full bg-secondary px-3 py-0.5 text-xs font-bold text-primary">{t.coBadge}</span>
          <h3 className="mt-1 text-xl font-black">{t.coName}</h3>
          <p className="text-sm font-bold text-primary">{t.coRole}</p>
        </div>
        <div className="px-5 pb-5"><InfoBlock icon={GraduationCap} title={t.academicT} text={t.coAcad} /></div>
      </div>

      <div className="relative overflow-hidden rounded-3xl bg-meadow p-6 text-center text-primary-foreground shadow-soft">
        <Heart className="mx-auto h-8 w-8" />
        <h2 className="mt-2 text-lg font-black">{t.ackT}</h2>
        <p className="mt-2 text-sm leading-relaxed opacity-95">{t.ack}</p>
      </div>
    </div>
  );
}

/* ---------- nav ---------- */
function BottomNav({ screen, go, t }: { screen: Screen; go: Nav; t: TT }) {
  const items = [
    { k: "home" as Screen, icon: Home, l: t.home }, { k: "map" as Screen, icon: Map, l: t.mapN },
    { k: "history" as Screen, icon: ClipboardList, l: t.histN }, { k: "hub" as Screen, icon: Brain, l: t.contribN },
    { k: "team" as Screen, icon: Users, l: t.teamN },
  ];
  return (
    <nav className="glass fixed bottom-3 left-1/2 z-30 flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 justify-around rounded-full p-1.5">
      {items.map(({ k, icon: I, l }) => (
        <button key={k} onClick={() => go(k)}
          className={`flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center rounded-full px-1 text-[10px] font-bold leading-tight transition ${screen === k ? "bg-meadow text-primary-foreground" : "text-muted-foreground"}`}>
          <I className="h-5 w-5 shrink-0" /><span className="truncate max-w-full">{l}</span>
        </button>
      ))}
    </nav>
  );
}
