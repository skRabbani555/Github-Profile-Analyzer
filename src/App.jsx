import React, { useMemo, useState } from "react";
import axios from "axios";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale } from "chart.js";
import { Doughnut, Bar } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale);

const GH = axios.create({
  baseURL: "https://api.github.com",
  headers: { Accept: "application/vnd.github+json" },
});

// Attach token if provided in .env (VITE_GITHUB_TOKEN)
const token = import.meta.env.VITE_GITHUB_TOKEN;
if (token) GH.defaults.headers.common["Authorization"] = `Bearer ${token}`;

const fmt = new Intl.NumberFormat();
const fmtDate = (s) => new Date(s).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'2-digit' });

export default function App(){
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [repos, setRepos] = useState([]);
  const [langAgg, setLangAgg] = useState({});
  const [review, setReview] = useState("");

  async function analyze(){
    if(!username) return;
    setLoading(true); setError(""); setUser(null); setRepos([]); setLangAgg({}); setReview("");
    try{
      const { data: u } = await GH.get(`/users/${encodeURIComponent(username)}`);
      setUser(u);

      // Fetch up to 100 repos (own, non-fork for clarity)
      const { data: rs } = await GH.get(`/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`);
      const own = rs.filter(r => !r.fork);
      setRepos(own);

      // Language aggregation: fetch languages for top 30 repos by size to reduce calls
      const topForLang = [...own].sort((a,b)=>(b.size||0)-(a.size||0)).slice(0,30);
      const agg = {};
      // fetch in small batches to avoid bursts
      const groups = topForLang.reduce((arr, r, i) => { (arr[Math.floor(i/5)] ||= []).push(r); return arr; }, []);
      for (const g of groups){
        await Promise.all(g.map(async (r) => {
          try{
            const { data } = await GH.get(r.languages_url);
            for (const [k,v] of Object.entries(data)){
              agg[k] = (agg[k]||0) + v;
            }
          }catch{}
        }));
      }
      setLangAgg(agg);

      // Compute totals
      const totalStars = own.reduce((s,r)=>s+r.stargazers_count,0);
      const totalForks = own.reduce((s,r)=>s+r.forks_count,0);

      // Recent activity: use Events API (last 300 events max), count PushEvents in last 30 days
      let pushCount = 0;
      try{
        const { data: events } = await GH.get(`/users/${encodeURIComponent(username)}/events?per_page=100`);
        const cutoff = Date.now() - 30*24*60*60*1000;
        for (const ev of events){
          if (ev.type === "PushEvent" && new Date(ev.created_at).getTime() >= cutoff){
            pushCount += (ev.payload?.commits?.length || 0);
          }
        }
      } catch {}

      // Generate detailed profile review
      const paragraph = buildReview({ user: u, repos: own, langAgg: agg, stars: totalStars, forks: totalForks, pushes30d: pushCount });
      setReview(paragraph);

    }catch(e){
      const msg = e?.response?.data?.message || e.message || "Unknown error";
      setError(msg);
    }finally{
      setLoading(false);
    }
  }

  const doughnutData = useMemo(()=> ({
    labels: Object.keys(langAgg),
    datasets: [{ data: Object.values(langAgg).map(v => Math.round(v/1024)) }] // KiB
  }), [langAgg]);

  const topStarRepos = useMemo(()=> [...repos].sort((a,b)=>b.stargazers_count-a.stargazers_count).slice(0,8), [repos]);
  const barData = useMemo(()=> ({
    labels: topStarRepos.map(r=>r.name),
    datasets: [{ label: "Stars", data: topStarRepos.map(r=>r.stargazers_count) }]
  }), [topStarRepos]);

  return (
    <div className="container">
      <div className="header">
        <img src="/favicon.svg" width="28" height="28" alt="logo" />
        <h1>GitHub Profile Analyzer & Reviewer</h1>
      </div>

      <div className={"card" + (loading ? " loading": "")}>
        <div className="input-group">
          <input placeholder="Enter GitHub username (e.g., torvalds, octocat)" value={username} onChange={e=>setUsername(e.target.value)} />
          <button onClick={analyze}>Analyze</button>
        </div>
        <div className="small" style={{marginTop:8}}>Tip: Add a token in <code>.env</code> as <code>VITE_GITHUB_TOKEN</code> to avoid rate limits.</div>
        {error && <div className="error" style={{marginTop:12}}>{error}</div>}
      </div>

      {user && (
        <div className="row" style={{marginTop:16}}>
          <div className="card">
            <div style={{display:'flex', gap:16, alignItems:'center'}}>
              <img src={user.avatar_url} alt="avatar" width="96" height="96" style={{borderRadius:12}} />
              <div>
                <div style={{fontSize:22, fontWeight:700}}>{user.name || user.login}</div>
                <div className="small"><a href={user.html_url} target="_blank" rel="noreferrer">@{user.login}</a> • Joined {fmtDate(user.created_at)}</div>
                <div className="small">{[user.location, user.company].filter(Boolean).join(" • ")}</div>
                <div className="small">{user.bio}</div>
              </div>
            </div>
            <div className="stat-grid" style={{marginTop:16}}>
              <div className="stat"><div className="small">Public Repos</div><div className="k">{fmt.format(user.public_repos)}</div></div>
              <div className="stat"><div className="small">Followers</div><div className="k">{fmt.format(user.followers)}</div></div>
              <div className="stat"><div className="small">Total Stars</div><div className="k">{fmt.format(repos.reduce((s,r)=>s+r.stargazers_count,0))}</div></div>
              <div className="stat"><div className="small">Total Forks</div><div className="k">{fmt.format(repos.reduce((s,r)=>s+r.forks_count,0))}</div></div>
            </div>
          </div>

          <div className="card">
            <div className="section-title"><b>Top Languages</b></div>
            {Object.keys(langAgg).length ? <Doughnut data={doughnutData} /> : <div className="small">No language data yet.</div>}
          </div>
        </div>
      )}

      {user && (
        <div className="row" style={{marginTop:16}}>
          <div className="card">
            <div className="section-title"><b>Top Repositories by Stars</b></div>
            {topStarRepos.length ? <Bar data={barData} options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true }}}} /> : <div className="small">No repositories found.</div>}
            <div className="small" style={{marginTop:8}}>Only non-fork repos are considered for charts.</div>
          </div>

          <div className="card">
            <div className="section-title"><b>Repositories</b></div>
            <table className="table">
              <thead><tr><th>Name</th><th>⭐</th><th>🍴</th><th>Lang</th><th>Updated</th><th>Description</th></tr></thead>
              <tbody>
                {repos.slice(0,20).map(r=>(
                  <tr key={r.id}>
                    <td><a href={r.html_url} target="_blank" rel="noreferrer">{r.name}</a></td>
                    <td>{fmt.format(r.stargazers_count)}</td>
                    <td>{fmt.format(r.forks_count)}</td>
                    <td>{r.language || ""}</td>
                    <td>{fmtDate(r.updated_at)}</td>
                    <td>{r.description || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="small">Showing up to 20 repos. Adjust in code as needed.</div>
          </div>
        </div>
      )}

      {review && (
        <div className="card" style={{marginTop:16}}>
          <div className="section-title"><b>Automated Profile Review</b></div>
          <p style={{whiteSpace:'pre-wrap', marginTop:4}}>{review}</p>
        </div>
      )}

      <div className="footer">Built with Vite + React + Chart.js • Public GitHub REST API • {new Date().getFullYear()}</div>
    </div>
  );
}

// Heuristic profile review generator (detailed paragraph)
function buildReview({ user, repos, langAgg, stars, forks, pushes30d }){
  const lines = [];
  const langs = Object.entries(langAgg).sort((a,b)=>b[1]-a[1]).map(([k])=>k);
  const topLangs = langs.slice(0,3);

  const active = pushes30d >= 20 ? "highly active" : pushes30d >= 5 ? "moderately active" : "relatively quiet";
  const starClass = stars >= 200 ? "strong community traction" : stars >= 50 ? "healthy interest" : "modest visibility";

  const latestUpdate = repos.length ? new Date(Math.max(...repos.map(r=>new Date(r.updated_at).getTime()))) : null;
  const staleCount = repos.filter(r => Date.now() - new Date(r.updated_at).getTime() > 180*24*60*60*1000).length;

  const readmeChecks = repos.slice(0,10); // sample few repos
  let missingReadmes = 0;
  // Note: we don't fetch readmes here to save requests; we estimate from description absence
  missingReadmes = readmeChecks.filter(r => !r.description).length;

  lines.push(`${user.name || user.login} showcases ${repos.length} public repositories with ${stars} stars and ${forks} forks in total. Primary languages skew toward ${topLangs.join(", ") || "a diverse stack"}, indicating day‑to‑day work across ${langs.length || 0} distinct technologies. Over the last 30 days the account appears ${active} with ~${pushes30d} commits detected via push events.`);

  if (latestUpdate){
    lines.push(`Recent activity includes updates through ${latestUpdate.toLocaleDateString(undefined, { year:'numeric', month:'short', day:'2-digit' })}, though ${staleCount} repos look inactive for 6+ months. Consider archiving or tagging legacy projects to clarify what’s current.`);
  }

  if (missingReadmes > 0){
    lines.push(`Several repositories (${missingReadmes} in the recent sample) lack descriptions/README-style context. Adding concise READMEs with setup steps, architecture notes, and screenshots would improve discoverability and recruiter comprehension.`);
  }

  if (stars < 20 && repos.length >= 5){
    lines.push(`Stars are on the lower side for the portfolio size; adding demo links (GitHub Pages, Render, or Netlify), writing short blog posts, and pinning the top projects can boost engagement.`);
  }

  if (user.bio){
    lines.push(`The profile bio communicates intent; consider elevating it with a one‑line value proposition (e.g., “Building data‑driven systems with React + Python | open to SDE roles”).`);
  } else {
    lines.push(`No profile bio detected—add a clear one‑liner about your focus, stack, and role interests to make the profile skimmable for recruiters.`);
  }

  if (user.location){
    lines.push(`Location is set to ${user.location}; ensure it aligns with your target job markets or add “Remote-friendly”.`);
  }

  lines.push(`Recommended next steps: pin 6 flagship repos (recent, strongly documented, with live demos), add project banners or GIFs to READMEs, and include a CONTRIBUTING.md where collaboration is welcome. Where possible, add tests and CI badges to signal engineering rigor.`);

  return lines.join("\n\n");
}
