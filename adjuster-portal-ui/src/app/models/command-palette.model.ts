export type CommandCategory = 'navigation' | 'action' | 'lead' | 'client' | 'claim';

export interface CommandItem {
  id: string;
  label: string;
  category: CommandCategory;
  icon: string;
  description?: string;
  keywords?: string[];
  route?: string;
  action?: () => void;
  entityId?: string;
  entityType?: 'lead' | 'client' | 'claim';
  refString?: string;
  sideTitle?: string;
}

export interface CommandGroup {
  category: CommandCategory;
  label: string;
  items: CommandItem[];
}
