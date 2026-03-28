export class Template {
    id?: string;
    name?: string;
    description?: string;
    state?: string;
    type?: string;
    size?: number;
    path?: string;
    can_be_removed?: boolean = true;

    created_by?: {
        first_name: string;
        last_name: string;
    };
    updated_by?: {
        first_name: string;
        last_name: string;
    };

    created_at?: Date;
    updated_at?: Date;
}



