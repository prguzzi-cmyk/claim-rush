import { Category } from "./category.model";

export class Product {
    name: string
    id: string;
    category_id: string;
    category_name: string;
    original_price: number;
    price: number;
    product_image?: string;
    created_at?: Date;
    updated_at?: Date;
    category?: Category;
    description:string
  }
  