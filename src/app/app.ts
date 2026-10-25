import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Papa from 'papaparse';

type Row = Record<string, string>;
@Component({ selector: 'app-root', standalone: true, imports: [CommonModule, FormsModule], templateUrl: './app.html', styleUrl: './app.css' })
export class App implements OnInit {
  loading = true; error = ''; loaded = false;
  batting: Row[] = []; bowling: Row[] = []; teams: Row[] = []; matches: Row[] = [];
  selectedPlayer = ''; researchNote = 'This dashboard explores player, team and match patterns in the supplied T20 ball-by-ball dataset.';
  ngOnInit(): void { void this.loadData(); }
  async loadData() {
    this.loading = true; this.error = '';
    try {
      const [bat, bowl, team, match] = await Promise.all([
        this.readCsv('research-data/batting_stats.csv', ['player','team','matches','runs','balls_faced']),
        this.readCsv('research-data/bowling_stats.csv', ['player','team','matches','wickets','runs_conceded','balls_bowled']),
        this.readCsv('research-data/team_stats.csv', ['team','matches','wins','losses']),
        this.readCsv('research-data/match_results.csv', ['date','team1','team2','venue','result'])
      ]);
      this.batting = bat; this.bowling = bowl; this.teams = team; this.matches = match;
      this.selectedPlayer = this.batting[0]?.['player'] ?? ''; this.loaded = true;
      console.info('[Cricket Dashboard] CSV files loaded', { batting:bat.length, bowling:bowl.length, teams:team.length, matches:match.length });
    } catch (e) { this.error = e instanceof Error ? e.message : 'Could not load research data.'; console.error('[Cricket Dashboard]', e); }
    finally { this.loading = false; }
  }
  private async readCsv(path: string, required: string[]): Promise<Row[]> {
    // Angular's <base href> keeps this URL correct on GitHub Pages project sites.
    const url = new URL(path, document.baseURI).toString();
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not load ${path} (HTTP ${response.status}). Check public/research-data and the deployed base path.`);
    const text = await response.text();
    const parsed = Papa.parse<Row>(text, { header: true, skipEmptyLines: 'greedy', transformHeader: h => h.trim() });
    if (parsed.errors.length) console.warn(`[Cricket Dashboard] CSV parsing warnings in ${path}`, parsed.errors.slice(0, 3));
    const headers = parsed.meta.fields ?? [];
    const missing = required.filter(h => !headers.includes(h));
    if (missing.length) throw new Error(`${path} is missing required columns: ${missing.join(', ')}`);
    const rows = parsed.data.filter(r => Object.values(r).some(v => String(v ?? '').trim() !== ''));
    if (!rows.length) throw new Error(`${path} contains no data rows.`);
    return rows;
  }
  num(row: Row, key: string): number { const n = Number(row[key]); return Number.isFinite(n) ? n : 0; }
  average(row: Row): string { const outs = Math.max(0, this.num(row,'innings') - this.num(row,'not_outs')); return outs ? (this.num(row,'runs') / outs).toFixed(2) : '—'; }
  strikeRate(row: Row): string { const balls = this.num(row,'balls_faced'); return balls ? (this.num(row,'runs') / balls * 100).toFixed(2) : '—'; }
  economy(row: Row): string { const balls = this.num(row,'balls_bowled'); return balls ? (this.num(row,'runs_conceded') / (balls / 6)).toFixed(2) : '—'; }
  bowlingAverage(row: Row): string { const wickets = this.num(row,'wickets'); return wickets ? (this.num(row,'runs_conceded') / wickets).toFixed(2) : '—'; }
  bowlingStrike(row: Row): string { const wickets = this.num(row,'wickets'); return wickets ? (this.num(row,'balls_bowled') / wickets).toFixed(2) : '—'; }
  winPct(row: Row): string { const matches = this.num(row,'matches'); return matches ? (this.num(row,'wins') / matches * 100).toFixed(1) : '0.0'; }
  get topBatter(): Row | undefined { return this.batting[0]; }
  get topBowler(): Row | undefined { return [...this.bowling].sort((a,b)=>this.num(b,'wickets')-this.num(a,'wickets'))[0]; }
  get selected(): Row | undefined { return this.batting.find(p=>p['player']===this.selectedPlayer); }
  get maxRuns(): number { return Math.max(1,...this.teams.map(t=>this.num(t,'matches'))); }
  track(_: number, row: Row): string { return `${row['player'] ?? row['team'] ?? row['date']}-${row['team'] ?? row['result'] ?? ''}`; }
}
