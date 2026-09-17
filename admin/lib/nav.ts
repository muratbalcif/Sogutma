export type NavItem = {
  href: string;
  label: string;
  permission?: string | string[];
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  {
    href: "/catalog",
    label: "Katalog",
    permission: ["product.read", "category.read", "brand.read"],
  },
  { href: "/products", label: "Ürünler", permission: "product.read" },
  { href: "/categories", label: "Kategoriler", permission: "category.read" },
  { href: "/brands", label: "Markalar", permission: "brand.read" },
  { href: "/inventory", label: "Stok", permission: "stock.read" },
  { href: "/pricing", label: "Fiyatlandırma", permission: "pricing.read" },
  { href: "/orders", label: "Siparişler", permission: "order.read" },
  { href: "/customers", label: "Müşteriler", permission: "customer.read" },
  { href: "/payments", label: "Ödemeler", permission: "payment.read" },
  {
    href: "/bank-transfers",
    label: "Havale Bildirimleri",
    permission: "bank_transfer.read",
  },
  { href: "/accounting", label: "Muhasebe", permission: "accounting.read" },
  { href: "/campaigns", label: "Kampanyalar", permission: "campaign.read" },
  { href: "/banners", label: "Bannerlar", permission: "banner.read" },
  {
    href: "/notifications",
    label: "Bildirimler",
    permission: "notification.read",
  },
  { href: "/settings", label: "Ayarlar" },
];
