import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  HostListener,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, switchMap, tap } from 'rxjs/operators';
import { CommandItem, CommandGroup } from '../../models/command-palette.model';
import { CommandPaletteService } from '../../services/command-palette.service';

@Component({
  selector: 'app-command-palette',
  templateUrl: './command-palette.component.html',
  styleUrls: ['./command-palette.component.scss'],
  standalone: false,
})
export class CommandPaletteComponent implements OnInit, OnDestroy {
  searchControl = new FormControl('');
  groups: CommandGroup[] = [];
  selectedIndex = 0;
  isSearching = false;

  private staticCommands: CommandItem[] = [];
  private entityResults: CommandItem[] = [];
  private searchSubject = new Subject<string>();
  private subscriptions: Subscription[] = [];

  @ViewChild('searchInput') searchInput: ElementRef<HTMLInputElement>;
  @ViewChild('resultsList') resultsList: ElementRef<HTMLDivElement>;

  constructor(
    private dialogRef: MatDialogRef<CommandPaletteComponent>,
    private commandPaletteService: CommandPaletteService
  ) {}

  ngOnInit(): void {
    this.staticCommands = this.commandPaletteService.getStaticCommands();
    this.buildGroups('');

    // Local filtering on every keystroke
    this.subscriptions.push(
      this.searchControl.valueChanges.subscribe((query: string) => {
        const q = (query || '').trim();
        this.buildGroups(q);
        this.selectedIndex = 0;

        // Trigger remote search for 2+ chars
        if (q.length >= 2) {
          this.searchSubject.next(q);
        } else {
          this.entityResults = [];
          this.buildGroups(q);
        }
      })
    );

    // Debounced remote entity search
    this.subscriptions.push(
      this.searchSubject
        .pipe(
          debounceTime(300),
          tap(() => (this.isSearching = true)),
          switchMap((query) => this.commandPaletteService.searchEntities(query))
        )
        .subscribe((results) => {
          this.entityResults = results;
          this.isSearching = false;
          this.buildGroups((this.searchControl.value || '').trim());
        })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
  }

  @HostListener('keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    const totalItems = this.getTotalItems();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedIndex = (this.selectedIndex + 1) % Math.max(totalItems, 1);
        this.scrollToSelected();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.selectedIndex = (this.selectedIndex - 1 + Math.max(totalItems, 1)) % Math.max(totalItems, 1);
        this.scrollToSelected();
        break;
      case 'Enter':
        event.preventDefault();
        this.executeSelected();
        break;
      case 'Escape':
        event.preventDefault();
        this.dialogRef.close();
        break;
    }
  }

  executeItem(item: CommandItem): void {
    this.dialogRef.close();
    this.commandPaletteService.execute(item);
  }

  getItemIndex(groupIndex: number, itemIndex: number): number {
    let idx = 0;
    for (let g = 0; g < groupIndex; g++) {
      idx += this.groups[g].items.length;
    }
    return idx + itemIndex;
  }

  private buildGroups(query: string): void {
    const q = query.toLowerCase();
    let filtered: CommandItem[];

    if (q.length === 0) {
      filtered = this.staticCommands;
    } else {
      filtered = this.staticCommands.filter((item) => {
        const haystack = [item.label, item.description || '', ...(item.keywords || [])].join(' ').toLowerCase();
        return haystack.includes(q);
      });
    }

    const groupMap = new Map<string, CommandItem[]>();

    // Static items
    for (const item of filtered) {
      const key = item.category;
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(item);
    }

    // Entity results
    for (const item of this.entityResults) {
      const key = item.category;
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(item);
    }

    const categoryLabels: Record<string, string> = {
      navigation: 'Pages',
      action: 'Actions',
      lead: 'Leads',
      client: 'Clients',
      claim: 'Claims',
    };

    const categoryOrder = ['action', 'navigation', 'lead', 'client', 'claim'];

    this.groups = categoryOrder
      .filter((cat) => groupMap.has(cat))
      .map((cat) => ({
        category: cat as any,
        label: categoryLabels[cat] || cat,
        items: groupMap.get(cat)!,
      }));
  }

  private getTotalItems(): number {
    return this.groups.reduce((sum, g) => sum + g.items.length, 0);
  }

  private executeSelected(): void {
    let idx = 0;
    for (const group of this.groups) {
      for (const item of group.items) {
        if (idx === this.selectedIndex) {
          this.executeItem(item);
          return;
        }
        idx++;
      }
    }
  }

  private scrollToSelected(): void {
    setTimeout(() => {
      const container = this.resultsList?.nativeElement;
      if (!container) return;
      const selected = container.querySelector('.command-item.selected') as HTMLElement;
      if (selected) {
        selected.scrollIntoView({ block: 'nearest' });
      }
    });
  }
}
