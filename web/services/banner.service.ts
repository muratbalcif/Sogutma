import { catalogService } from "./catalog.service";

export const bannerService = {
  listActive: () => catalogService.banners(),
};
