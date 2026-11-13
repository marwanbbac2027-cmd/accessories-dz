'use strict';

// Reference data: the 58 wilayas (Arabic + French names).
const WILAYAS = [
  [1, 'أدرار', 'Adrar'], [2, 'الشلف', 'Chlef'], [3, 'الأغواط', 'Laghouat'],
  [4, 'أم البواقي', 'Oum El Bouaghi'], [5, 'باتنة', 'Batna'], [6, 'بجاية', 'Béjaïa'],
  [7, 'بسكرة', 'Biskra'], [8, 'بشار', 'Béchar'], [9, 'البليدة', 'Blida'],
  [10, 'البويرة', 'Bouira'], [11, 'تمنراست', 'Tamanrasset'], [12, 'تبسة', 'Tébessa'],
  [13, 'تلمسان', 'Tlemcen'], [14, 'تيارت', 'Tiaret'], [15, 'تيزي وزو', 'Tizi Ouzou'],
  [16, 'الجزائر', 'Alger'], [17, 'الجلفة', 'Djelfa'], [18, 'جيجل', 'Jijel'],
  [19, 'سطيف', 'Sétif'], [20, 'سعيدة', 'Saïda'], [21, 'سكيكدة', 'Skikda'],
  [22, 'سيدي بلعباس', 'Sidi Bel Abbès'], [23, 'عنابة', 'Annaba'], [24, 'قالمة', 'Guelma'],
  [25, 'قسنطينة', 'Constantine'], [26, 'المدية', 'Médéa'], [27, 'مستغانم', 'Mostaganem'],
  [28, 'المسيلة', "M'Sila"], [29, 'معسكر', 'Mascara'], [30, 'ورقلة', 'Ouargla'],
  [31, 'وهران', 'Oran'], [32, 'البيض', 'El Bayadh'], [33, 'إليزي', 'Illizi'],
  [34, 'برج بوعريريج', 'Bordj Bou Arréridj'], [35, 'بومرداس', 'Boumerdès'],
  [36, 'الطارف', 'El Tarf'], [37, 'تندوف', 'Tindouf'], [38, 'تيسمسيلت', 'Tissemsilt'],
  [39, 'الوادي', 'El Oued'], [40, 'خنشلة', 'Khenchela'], [41, 'سوق أهراس', 'Souk Ahras'],
  [42, 'تيبازة', 'Tipaza'], [43, 'ميلة', 'Mila'], [44, 'عين الدفلى', 'Aïn Defla'],
  [45, 'النعامة', 'Naâma'], [46, 'عين تموشنت', 'Aïn Témouchent'], [47, 'غرداية', 'Ghardaïa'],
  [48, 'غليزان', 'Relizane'], [49, 'تيميمون', 'Timimoun'],
  [50, 'برج باجي مختار', 'Bordj Badji Mokhtar'], [51, 'أولاد جلال', 'Ouled Djellal'],
  [52, 'بني عباس', 'Béni Abbès'], [53, 'عين صالح', 'In Salah'], [54, 'عين قزام', 'In Guezzam'],
  [55, 'تقرت', 'Touggourt'], [56, 'جانت', 'Djanet'], [57, "المغير", "El M'Ghair"],
  [58, 'المنيعة', 'El Meniaa'],
].map(([code, name_ar, name_fr]) => ({ code, name_ar, name_fr }));

// Placeholder delivery fees (DZD). These are NOT real rates: the owner must
// set real fees per wilaya in the delivery_settings table (or via the admin
// dashboard once built). Home delivery is priced higher than pickup.
const DEFAULT_DELIVERY = {
  home: 700,
  pickup: 400,
};

// Seed catalog (sample products the owner replaces later). No photos are
// included; the frontend draws category-based placeholders.
const SEED_CATEGORIES = [
  { slug: 'watches', name_ar: 'ساعات', name_fr: 'Montres' },
  { slug: 'bracelets', name_ar: 'أساور', name_fr: 'Bracelets' },
  { slug: 'necklaces', name_ar: 'قلادات', name_fr: 'Colliers' },
  { slug: 'rings', name_ar: 'خواتم', name_fr: 'Bagues' },
  { slug: 'mens', name_ar: 'إكسسوارات رجالية', name_fr: 'Accessoires hommes' },
  { slug: 'womens', name_ar: 'إكسسوارات نسائية', name_fr: 'Accessoires femmes' },
  { slug: 'phone', name_ar: 'إكسسوارات الهاتف', name_fr: 'Accessoires téléphone' },
  { slug: 'bags', name_ar: 'حقائب ومحافظ', name_fr: 'Sacs & portefeuilles' },
  { slug: 'other', name_ar: 'أخرى', name_fr: 'Autres' },
];



module.exports = { WILAYAS, DEFAULT_DELIVERY, SEED_CATEGORIES };
