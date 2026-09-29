import { dataTable } from "./data-table.js";
import type { DataTable, DataTableInput } from "./data-table.js";

/**
 * Bundled sample tables: small, fixed and deterministic, so the instrument works with no asset
 * store. They are illustrative samples (values were generated once from simple seasonal and
 * random models and then frozen here), not measurements from a real source.
 *
 * Every sample has the same shape: three continuous columns (the first is the natural time or
 * ordering column) and two categorical columns, with explicit missing values (`null`) in at least
 * one continuous and one categorical column. The instrument addresses columns by that position
 * ("first measure", "second category"), so any sample can stand in for any other.
 */
export const sampleInputs: readonly DataTableInput[] = [
  {
    id: "harbour", title: "Harbour log",
    // 48 half-hourly readings over one day: tide height, wind speed, and derived classes.
    // Wind and sea state are missing during a sensor dropout (rows 27 to 31 and 41).
    rowIds: ["t00:00","t00:30","t01:00","t01:30","t02:00","t02:30","t03:00","t03:30","t04:00","t04:30","t05:00","t05:30","t06:00","t06:30","t07:00","t07:30","t08:00","t08:30","t09:00","t09:30","t10:00","t10:30","t11:00","t11:30","t12:00","t12:30","t13:00","t13:30","t14:00","t14:30","t15:00","t15:30","t16:00","t16:30","t17:00","t17:30","t18:00","t18:30","t19:00","t19:30","t20:00","t20:30","t21:00","t21:30","t22:00","t22:30","t23:00","t23:30"],
    columns: [
      { name: "hour", kind: "continuous", unit: "h",
        values: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12,
          12.5, 13, 13.5, 14, 14.5, 15, 15.5, 16, 16.5, 17, 17.5, 18, 18.5, 19, 19.5, 20, 20.5, 21, 21.5, 22, 22.5,
          23, 23.5] },
      { name: "height", kind: "continuous", unit: "m",
        values: [0.51, 0.48, 0.55, 0.69, 0.88, 1.09, 1.29, 1.48, 1.66, 1.84, 2.03, 2.23, 2.44, 2.63, 2.8, 2.9, 2.92,
          2.82, 2.62, 2.32, 1.95, 1.55, 1.16, 0.84, 0.61, 0.5, 0.49, 0.57, 0.73, 0.92, 1.12, 1.32, 1.51, 1.69,
          1.87, 2.06, 2.26, 2.47, 2.67, 2.83, 2.92, 2.91, 2.8, 2.58, 2.26, 1.88, 1.48, 1.1] },
      { name: "wind", kind: "continuous", unit: "kn",
        values: [5.9, 5.6, 3.8, 1.7, 1.5, 1.7, 3.6, 4.8, 4.4, 2.8, 1.5, 1.8, 3.8, 6.1, 7.2, 6.5, 5.2, 4.8, 6.1, 8.6,
          10.7, 11.1, 10, 8.8, 8.9, 10.6, 12.9, null, null, null, null, null, 12.2, 13.7, 13.6, 11.8, 9.5, 8.3,
          8.9, 10.2, 10.8, null, 7.2, 5, 4.4, 5.4, 6.6, 6.6] },
      { name: "tide", kind: "categorical", categories: ["rising","falling"],
        values: ["falling", "rising", "rising", "rising", "rising", "rising", "rising", "rising", "rising", "rising",
          "rising", "rising", "rising", "rising", "rising", "rising", "falling", "falling", "falling", "falling",
          "falling", "falling", "falling", "falling", "falling", "falling", "rising", "rising", "rising", "rising",
          "rising", "rising", "rising", "rising", "rising", "rising", "rising", "rising", "rising", "rising",
          "rising", "falling", "falling", "falling", "falling", "falling", "falling", "falling"] },
      { name: "sea", kind: "categorical", categories: ["calm","moderate","rough"],
        values: ["calm", "calm", "calm", "calm", "calm", "calm", "calm", "calm", "calm", "calm", "calm", "calm", "calm",
          "calm", "moderate", "calm", "calm", "calm", "calm", "moderate", "moderate", "rough", "moderate",
          "moderate", "moderate", "moderate", "rough", null, null, null, null, null, "rough", "rough", "rough",
          "rough", "moderate", "moderate", "moderate", "moderate", "moderate", null, "moderate", "calm", "calm",
          "calm", "calm", "calm"] },
    ],
  },
  {
    id: "orchard", title: "Orchard parcels",
    // 30 parcels: planting year, size, harvest per hectare (unrecorded for some), crop and soil.
    rowIds: ["parcel-01","parcel-02","parcel-03","parcel-04","parcel-05","parcel-06","parcel-07","parcel-08","parcel-09","parcel-10","parcel-11","parcel-12","parcel-13","parcel-14","parcel-15","parcel-16","parcel-17","parcel-18","parcel-19","parcel-20","parcel-21","parcel-22","parcel-23","parcel-24","parcel-25","parcel-26","parcel-27","parcel-28","parcel-29","parcel-30"],
    columns: [
      { name: "planted", kind: "continuous", unit: "year",
        values: [1974, 1996, 1977, 2019, 1981, 2000, 1999, 1995, 1983, 2008, 1982, 1992, 2015, 2002, 1986, 1992, 1983,
          1974, 2019, 2001, 1996, 2002, 2001, 2003, 1978, 1974, 1989, 1978, 1986, 2003] },
      { name: "area", kind: "continuous", unit: "ha",
        values: [2.8, 3.3, 2, 1.8, 6.7, 0.4, 4, 1.2, 4.2, 4.3, 1.6, 6.1, 7.9, 0.5, 4.9, 4.7, 1.6, 0.4, 1.2, 1.3, 1.4,
          1.9, 3.8, 1.1, 0.8, 0.5, 1.5, 0.5, 1.1, 0.4] },
      { name: "yield", kind: "continuous", unit: "t/ha",
        values: [null, 11.7, 10.1, 9.1, 6.1, 11.6, 9.9, 7, 9.8, 12.2, 5.7, 7.8, 3.9, null, 9.4, 8, 10.5, 9.7, 9.5, 7, 4,
          null, 6.2, null, 6.5, null, null, 8.4, 2.7, 11.4] },
      { name: "crop", kind: "categorical", categories: ["apple","pear","plum","cherry","quince"],
        values: ["apple", "plum", "cherry", "cherry", "apple", "quince", "cherry", "cherry", "plum", "apple", "apple",
          "quince", "cherry", "cherry", "cherry", "cherry", "quince", "cherry", "pear", "plum", "plum", "cherry",
          "plum", "apple", "quince", "pear", "plum", "cherry", "plum", "quince"] },
      { name: "soil", kind: "categorical", categories: ["clay","loam","chalk"],
        values: ["loam", null, "loam", "loam", null, "chalk", "loam", "chalk", "loam", "loam", "chalk", "loam", "loam",
          "loam", "loam", "clay", "clay", null, "chalk", "chalk", "loam", "chalk", "loam", "clay", null, "chalk",
          "chalk", null, "loam", "clay"] },
    ],
  },
  {
    id: "loans", title: "Library loans",
    // Twelve months for each of three genres, genre after genre; a few late shares and two seasons are unrecorded.
    rowIds: ["fic-01","fic-02","fic-03","fic-04","fic-05","fic-06","fic-07","fic-08","fic-09","fic-10","fic-11","fic-12","sci-01","sci-02","sci-03","sci-04","sci-05","sci-06","sci-07","sci-08","sci-09","sci-10","sci-11","sci-12","trv-01","trv-02","trv-03","trv-04","trv-05","trv-06","trv-07","trv-08","trv-09","trv-10","trv-11","trv-12"],
    columns: [
      { name: "month", kind: "continuous", unit: "month",
        values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9,
          10, 11, 12] },
      { name: "loans", kind: "continuous", unit: "loans",
        values: [300, 245, 225, 178, 157, 189, 222, 261, 321, 336, 364, 364, 122, 153, 160, 179, 172, 144, 112, 90, 62,
          65, 73, 87, 22, 13, 22, 41, 69, 97, 111, 118, 123, 103, 75, 42] },
      { name: "late", kind: "continuous", unit: "share",
        values: [0.12, 0.171, 0.103, 0.214, 0.218, 0.105, 0.192, 0.159, 0.211, 0.051, null, 0.143, 0.081, 0.203, 0.146,
          0.152, 0.148, 0.191, 0.075, 0.105, 0.085, 0.096, 0.197, 0.199, 0.097, 0.15, 0.196, 0.153, 0.089, 0.139,
          0.225, 0.137, 0.231, null, null, 0.114] },
      { name: "genre", kind: "categorical", categories: ["fiction","science","travel"],
        values: ["fiction", "fiction", "fiction", "fiction", "fiction", "fiction", "fiction", "fiction", "fiction",
          "fiction", "fiction", "fiction", "science", "science", "science", "science", "science", "science",
          "science", "science", "science", "science", "science", "science", "travel", "travel", "travel", "travel",
          "travel", "travel", "travel", "travel", "travel", "travel", "travel", "travel"] },
      { name: "season", kind: "categorical", categories: ["winter","spring","summer","autumn"],
        values: ["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "autumn", "autumn",
          "autumn", null, "winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "autumn",
          "autumn", "autumn", "winter", null, "winter", "spring", "spring", "spring", "summer", "summer", "summer",
          "autumn", "autumn", "autumn", "winter"] },
    ],
  },
];

export const sampleIds: readonly string[] = sampleInputs.map((input) => input.id);

const cache = new Map<string, DataTable>();
/** The frozen bundled table, or an error naming the available ids. */
export function sampleTable(id: string): DataTable {
  let table = cache.get(id);
  if (!table) {
    const input = sampleInputs.find((item) => item.id === id);
    if (!input) throw new Error(`Unknown sample table "${id}"; available: ${sampleIds.join(", ")}`);
    table = dataTable(input);
    cache.set(id, table);
  }
  return table;
}
