import { FlaskConical } from 'lucide-react';
import type { Shampoo } from './types';
export function ProductImage({product}:{product:Pick<Shampoo,'name'|'photo'>}){return product.photo?<img className="product-photo" src={product.photo} alt={`${product.name} 제품 사진`} loading="lazy"/>:<span className="product-photo product-photo-empty"><FlaskConical size={30}/><small>사진 없음</small></span>;}
