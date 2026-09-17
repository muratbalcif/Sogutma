export type MoneyPrice = {
  amount: string;
  currency: string;
  type: string;
};

export type ProductImage = {
  id: string;
  url: string;
  alt: string | null;
  sortOrder: number;
  isPrimary: boolean;
};

export type ProductListItem = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  slug: string;
  description: string | null;
  brand: { id: string; name: string; slug: string; logo: string | null };
  category: { id: string; name: string; slug: string };
  images: ProductImage[];
  price?: MoneyPrice | null;
  compareAtPrice?: MoneyPrice | null;
  stock?: { available: boolean; quantity: number };
  onCampaign?: boolean;
};

export type ProductDetail = ProductListItem & {
  attributes: Array<{ id: string; name: string; value: string; sortOrder: number }>;
  compatibility: Array<{
    id: string;
    manufacturer: string;
    model: string;
    modelYear: number | null;
    notes: string | null;
  }>;
};

export type Paginated<T> = {
  items: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  children?: CategoryNode[];
};

export type Banner = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  mobileImageUrl: string | null;
  linkType: string;
  linkValue: string | null;
  sortOrder: number;
};

export type SiteConfig = {
  siteName: string;
  supportEmail: string;
  supportPhone: string;
  address: string;
  privacyUrl: string;
  kvkkUrl: string;
  termsUrl: string;
  bankTransferInfo: {
    bankName: string;
    iban: string;
    accountName: string;
  };
};

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  userType: string;
  status: string;
  roles: string[];
  permissions: string[];
};

export type CartResponse = {
  id: string;
  items: Array<{
    productId: string;
    quantity: number;
    product: ProductListItem;
    unitPrice: string;
    lineTotal: string;
    currency: string;
  }>;
  subtotal: string;
  taxAmount?: string;
  discountAmount?: string;
  total: string;
  currency: string;
};
