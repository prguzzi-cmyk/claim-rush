import { Component, OnInit, OnDestroy } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';
import { AiSalesAgentService, SalesScript, ScriptStage, ClaimType } from '../ai-sales-agent.service';

@Component({
  selector: 'app-sales-script-manager',
  templateUrl: './sales-script-manager.component.html',
  styleUrls: ['./sales-script-manager.component.scss'],
  standalone: false,
})
export class SalesScriptManagerComponent implements OnInit, OnDestroy {
  scripts: SalesScript[] = [];
  selectedScript: SalesScript | null = null;
  editingStageIndex: number | null = null;
  filterType: ClaimType | 'all' = 'all';
  private sub: Subscription;

  claimTypes: { value: ClaimType | 'all'; label: string; icon: string }[] = [
    { value: 'all', label: 'All Types', icon: 'list' },
    { value: 'fire', label: 'Fire', icon: 'whatshot' },
    { value: 'water', label: 'Water', icon: 'water_drop' },
    { value: 'storm', label: 'Storm', icon: 'thunderstorm' },
    { value: 'vandalism', label: 'Vandalism', icon: 'broken_image' },
  ];

  constructor(
    private service: AiSalesAgentService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.sub = this.service.getScripts().subscribe(s => this.scripts = s);
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  get filteredScripts(): SalesScript[] {
    if (this.filterType === 'all') return this.scripts;
    return this.scripts.filter(s => s.claimType === this.filterType);
  }

  selectScript(script: SalesScript): void {
    this.selectedScript = { ...script, stages: script.stages.map(s => ({ ...s, responseOptions: [...s.responseOptions] })) };
    this.editingStageIndex = null;
  }

  editStage(index: number): void {
    this.editingStageIndex = this.editingStageIndex === index ? null : index;
  }

  updateStagePrompt(index: number, prompt: string): void {
    if (!this.selectedScript) return;
    this.selectedScript.stages[index].prompt = prompt;
  }

  addResponseOption(index: number): void {
    if (!this.selectedScript) return;
    this.selectedScript.stages[index].responseOptions.push('New option');
  }

  removeResponseOption(stageIndex: number, optionIndex: number): void {
    if (!this.selectedScript) return;
    this.selectedScript.stages[stageIndex].responseOptions.splice(optionIndex, 1);
  }

  addStage(): void {
    if (!this.selectedScript) return;
    this.selectedScript.stages.push({
      label: 'New Stage',
      prompt: 'Enter the AI prompt for this stage...',
      responseOptions: ['Option 1', 'Option 2'],
    });
    this.editingStageIndex = this.selectedScript.stages.length - 1;
  }

  removeStage(index: number): void {
    if (!this.selectedScript) return;
    this.selectedScript.stages.splice(index, 1);
    this.editingStageIndex = null;
  }

  saveScript(): void {
    if (!this.selectedScript) return;
    this.selectedScript.lastModified = new Date().toISOString();
    this.service.saveScript(this.selectedScript);
    this.snackBar.open(`Script "${this.selectedScript.name}" saved`, 'OK', { duration: 3000 });
  }

  toggleActive(): void {
    if (!this.selectedScript) return;
    this.selectedScript.isActive = !this.selectedScript.isActive;
  }

  getClaimIcon(type: string): string {
    const m: Record<string, string> = { fire: 'whatshot', water: 'water_drop', storm: 'thunderstorm', vandalism: 'broken_image' };
    return m[type] || 'help';
  }

  formatDate(ts: string): string {
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  trackByIndex(index: number): number { return index; }
}
