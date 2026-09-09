/**
 * Canonical geography for Egypt. Seeded by prisma/seed.ts and used by the
 * place importer to attach branches to governorates/cities.
 */

export interface GovernorateSeed {
  slug: string;
  nameEn: string;
  nameAr: string;
}

export interface CitySeed {
  slug: string;
  nameEn: string;
  nameAr: string;
  latitude?: number;
  longitude?: number;
}

export const GOVERNORATES: GovernorateSeed[] = [
  { slug: 'cairo', nameEn: 'Cairo', nameAr: 'القاهرة' },
  { slug: 'giza', nameEn: 'Giza', nameAr: 'الجيزة' },
  { slug: 'alexandria', nameEn: 'Alexandria', nameAr: 'الإسكندرية' },
  { slug: 'qalyubia', nameEn: 'Qalyubia', nameAr: 'القليوبية' },
  { slug: 'port-said', nameEn: 'Port Said', nameAr: 'بورسعيد' },
  { slug: 'suez', nameEn: 'Suez', nameAr: 'السويس' },
  { slug: 'damietta', nameEn: 'Damietta', nameAr: 'دمياط' },
  { slug: 'dakahlia', nameEn: 'Dakahlia', nameAr: 'الدقهلية' },
  { slug: 'sharqia', nameEn: 'Sharqia', nameAr: 'الشرقية' },
  { slug: 'monufia', nameEn: 'Monufia', nameAr: 'المنوفية' },
  { slug: 'gharbia', nameEn: 'Gharbia', nameAr: 'الغربية' },
  { slug: 'beheira', nameEn: 'Beheira', nameAr: 'البحيرة' },
  { slug: 'kafr-el-sheikh', nameEn: 'Kafr El Sheikh', nameAr: 'كفر الشيخ' },
  { slug: 'ismailia', nameEn: 'Ismailia', nameAr: 'الإسماعيلية' },
  { slug: 'faiyum', nameEn: 'Faiyum', nameAr: 'الفيوم' },
  { slug: 'beni-suef', nameEn: 'Beni Suef', nameAr: 'بني سويف' },
  { slug: 'minya', nameEn: 'Minya', nameAr: 'المنيا' },
  { slug: 'asyut', nameEn: 'Asyut', nameAr: 'أسيوط' },
  { slug: 'sohag', nameEn: 'Sohag', nameAr: 'سوهاج' },
  { slug: 'qena', nameEn: 'Qena', nameAr: 'قنا' },
  { slug: 'luxor', nameEn: 'Luxor', nameAr: 'الأقصر' },
  { slug: 'aswan', nameEn: 'Aswan', nameAr: 'أسوان' },
  { slug: 'red-sea', nameEn: 'Red Sea', nameAr: 'البحر الأحمر' },
  { slug: 'new-valley', nameEn: 'New Valley', nameAr: 'الوادي الجديد' },
  { slug: 'matrouh', nameEn: 'Matrouh', nameAr: 'مطروح' },
  { slug: 'north-sinai', nameEn: 'North Sinai', nameAr: 'شمال سيناء' },
  { slug: 'south-sinai', nameEn: 'South Sinai', nameAr: 'جنوب سيناء' },
];

export const DAKAHLIA_CITIES: CitySeed[] = [
  { slug: 'mansoura', nameEn: 'Mansoura', nameAr: 'المنصورة', latitude: 31.0409, longitude: 31.3785 },
  { slug: 'talkha', nameEn: 'Talkha', nameAr: 'طلخا', latitude: 31.0541, longitude: 31.3787 },
  { slug: 'mit-ghamr', nameEn: 'Mit Ghamr', nameAr: 'ميت غمر', latitude: 30.9298, longitude: 31.2528 },
  { slug: 'belqas', nameEn: 'Belqas', nameAr: 'بلقاس', latitude: 31.2157, longitude: 31.3524 },
  { slug: 'dekernes', nameEn: 'Dekernes', nameAr: 'دكرنس', latitude: 30.8347, longitude: 31.4789 },
  { slug: 'aga', nameEn: 'Aga', nameAr: 'أجا', latitude: 30.9667, longitude: 31.4833 },
  { slug: 'sherbin', nameEn: 'Sherbin', nameAr: 'شربين', latitude: 31.0228, longitude: 31.526 },
  { slug: 'manzala', nameEn: 'Manzala', nameAr: 'المنزلة', latitude: 31.1788, longitude: 31.6186 },
  { slug: 'sinbillawein', nameEn: 'Sinbillawein', nameAr: 'سنبلاوين', latitude: 30.9906, longitude: 31.5356 },
  { slug: 'nabaruh', nameEn: 'Nabaruh', nameAr: 'نبروه', latitude: 30.9894, longitude: 31.6517 },
  { slug: 'mit-salsil', nameEn: 'Mit Salsil', nameAr: 'ميت سلسيل', latitude: 30.9486, longitude: 31.3364 },
  { slug: 'menyet-el-nasr', nameEn: 'Menyet El Nasr', nameAr: 'منية النصر', latitude: 30.9153, longitude: 31.3114 },
  { slug: 'gamsa', nameEn: 'Gamsa', nameAr: 'جامصة', latitude: 31.4933, longitude: 31.6394 },
];

/** Cities per governorate slug. Cities for other governorates are created on demand by the importer. */
export const GOVERNORATE_CITIES: Record<string, CitySeed[]> = {
  dakahlia: DAKAHLIA_CITIES,
};

export interface Bbox {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** Bounding boxes used for Foursquare/Overture bbox queries, per governorate slug. */
export const GOVERNORATE_BBOXES: Record<string, Bbox> = {
  dakahlia: { south: 30.6, west: 30.95, north: 31.68, east: 32.02 },
};
